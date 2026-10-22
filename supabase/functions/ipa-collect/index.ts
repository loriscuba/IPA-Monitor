// IPA Monitor: collettore lanciato da pg_cron ogni 10 minuti.
// Controlla siti, salute dei progetti Supabase, Edge Function, GitHub Actions e metriche delle app,
// e scrive una riga per controllo in ipamonitor.controlli.
//
// Segreti (Supabase → Edge Functions → Secrets), tutti facoltativi: senza, quel controllo viene saltato.
//   SUPABASE_PAT          token personale per la Management API (api.supabase.com)
//   GITHUB_TOKEN          token GitHub in sola lettura (Actions + Pull requests)
//   GYMIN_MONITOR_DB_URL  stringa di connessione del ruolo monitor_ro sul DB di GymIN
import postgres from "npm:postgres@3.4.5";

type Controllo = {
  app_id: string;
  tipo: "sito" | "supabase" | "funzioni" | "github" | "metriche";
  oggetto: string;
  ok: boolean;
  latenza_ms?: number | null;
  dati?: unknown;
};

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2 });
const PAT = Deno.env.get("SUPABASE_PAT");
const GH = Deno.env.get("GITHUB_TOKEN");
const GYMIN_DB = Deno.env.get("GYMIN_MONITOR_DB_URL");

async function cronometra<T>(f: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const r = await f();
  return [r, Math.round(performance.now() - t0)];
}

function errore(e: unknown) {
  return { errore: e instanceof Error ? e.message : String(e) };
}

async function controllaSito(app_id: string, nome: string, url: string): Promise<Controllo> {
  try {
    const [res, ms] = await cronometra(() =>
      fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000) })
    );
    await res.body?.cancel();
    return { app_id, tipo: "sito", oggetto: url, ok: res.ok, latenza_ms: ms, dati: { nome, status: res.status } };
  } catch (e) {
    return { app_id, tipo: "sito", oggetto: url, ok: false, dati: { nome, ...errore(e) } };
  }
}

async function api(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`.slice(0, 300));
  return res.json();
}

async function controllaSupabase(app_id: string, ref: string): Promise<Controllo[]> {
  if (!PAT) return [];
  const h = { Authorization: `Bearer ${PAT}` };
  const base = `https://api.supabase.com/v1/projects/${ref}`;
  const out: Controllo[] = [];

  try {
    const [servizi, ms] = await cronometra(() =>
      api(`${base}/health?services=auth&services=db&services=realtime&services=rest&services=storage`, h)
    );
    const ok = (servizi as { healthy: boolean }[]).every((s) => s.healthy);
    out.push({ app_id, tipo: "supabase", oggetto: "salute", ok, latenza_ms: ms, dati: servizi });
  } catch (e) {
    out.push({ app_id, tipo: "supabase", oggetto: "salute", ok: false, dati: errore(e) });
  }

  try {
    const fine = new Date();
    const inizio = new Date(fine.getTime() - 10 * 60_000);
    const q = new URLSearchParams({
      sql: "select count(*) as errori from edge_logs cross join unnest(metadata) as m " +
        "cross join unnest(m.response) as r where r.status_code >= 500",
      iso_timestamp_start: inizio.toISOString(),
      iso_timestamp_end: fine.toISOString(),
    });
    const r = await api(`${base}/analytics/endpoints/logs.all?${q}`, h);
    const errori = Number(r?.result?.[0]?.errori ?? 0);
    out.push({ app_id, tipo: "supabase", oggetto: "errori_api_10min", ok: errori === 0, dati: { errori } });
  } catch (e) {
    out.push({ app_id, tipo: "supabase", oggetto: "errori_api_10min", ok: false, dati: errore(e) });
  }

  try {
    const funzioni = await api(`${base}/functions`, h) as {
      slug: string; status: string; version: number; updated_at: number;
    }[];
    for (const f of funzioni) {
      out.push({
        app_id, tipo: "funzioni", oggetto: f.slug, ok: f.status === "ACTIVE",
        dati: { status: f.status, versione: f.version, aggiornata_il: f.updated_at },
      });
    }
  } catch (e) {
    out.push({ app_id, tipo: "funzioni", oggetto: "elenco", ok: false, dati: errore(e) });
  }
  return out;
}

async function controllaGithub(app_id: string, repo: string): Promise<Controllo[]> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "ipa-monitor" };
  if (GH) h.Authorization = `Bearer ${GH}`;
  const out: Controllo[] = [];
  try {
    const { workflow_runs } = await api(
      `https://api.github.com/repos/${repo}/actions/runs?branch=main&per_page=20`, h,
    );
    const visti = new Set<string>();
    for (const run of workflow_runs ?? []) {
      if (visti.has(run.name)) continue; // solo l'ultima esecuzione di ogni workflow
      visti.add(run.name);
      const ok = run.status !== "completed" || ["success", "skipped", "neutral"].includes(run.conclusion);
      out.push({
        app_id, tipo: "github", oggetto: `workflow:${run.name}`, ok,
        dati: { stato: run.status, esito: run.conclusion, commit: run.head_sha?.slice(0, 7), url: run.html_url, il: run.updated_at },
      });
    }
    const pr = await api(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=100`, h);
    out.push({
      app_id, tipo: "github", oggetto: "pr_aperte", ok: true,
      dati: { totale: pr.length, bozze: pr.filter((p: { draft: boolean }) => p.draft).length },
    });
  } catch (e) {
    out.push({ app_id, tipo: "github", oggetto: "api", ok: false, dati: errore(e) });
  }
  return out;
}

async function metricheBeachin(): Promise<Controllo> {
  try {
    const [r] = await sql`select * from beachin.monitor_riepilogo`;
    return { app_id: "beachin", tipo: "metriche", oggetto: "riepilogo", ok: true, dati: r };
  } catch (e) {
    return { app_id: "beachin", tipo: "metriche", oggetto: "riepilogo", ok: false, dati: errore(e) };
  }
}

async function metricheGymin(): Promise<Controllo[]> {
  if (!GYMIN_DB) return [];
  const db = postgres(GYMIN_DB, { prepare: false, max: 1, connect_timeout: 10 });
  try {
    const [r] = await db`select * from monitor.riepilogo`;
    const ok = Number(r.mail_errori_24h) === 0;
    return [{ app_id: "gymin", tipo: "metriche", oggetto: "riepilogo", ok, dati: r }];
  } catch (e) {
    return [{ app_id: "gymin", tipo: "metriche", oggetto: "riepilogo", ok: false, dati: errore(e) }];
  } finally {
    await db.end();
  }
}

Deno.serve(async (req) => {
  const [{ segreto } = { segreto: null }] = await sql`
    select decrypted_secret as segreto from vault.decrypted_secrets where name = 'ipamonitor_cron_secret'`;
  if (!segreto || req.headers.get("x-cron-secret") !== segreto) {
    return new Response("non autorizzato", { status: 401 });
  }

  const app = await sql`select id, repo, supabase_ref from ipamonitor.app where attiva`;
  const siti = await sql`select s.app_id, s.nome, s.url from ipamonitor.siti s join ipamonitor.app a on a.id = s.app_id where a.attiva`;

  // I progetti Supabase sono condivisi tra più app: la salute si controlla una volta per progetto.
  const refFatti = new Set<string>();
  const lavori: Promise<Controllo | Controllo[]>[] = [
    ...siti.map((s) => controllaSito(s.app_id, s.nome, s.url)),
    ...app.filter((a) => a.repo).map((a) => controllaGithub(a.id, a.repo)),
    ...app.filter((a) => a.supabase_ref && !refFatti.has(a.supabase_ref) && refFatti.add(a.supabase_ref))
      .map((a) => controllaSupabase(a.id, a.supabase_ref)),
    metricheBeachin(),
    metricheGymin(),
  ];
  const controlli = (await Promise.all(lavori)).flat();

  if (controlli.length) {
    const righe = controlli.map((c) => ({ ...c, latenza_ms: c.latenza_ms ?? null, dati: c.dati == null ? null : sql.json(c.dati as postgres.JSONValue) }));
    await sql`insert into ipamonitor.controlli ${sql(righe, "app_id", "tipo", "oggetto", "ok", "latenza_ms", "dati")}`;
  }
  return Response.json({ controlli: controlli.length, ko: controlli.filter((c) => !c.ok).length });
});
