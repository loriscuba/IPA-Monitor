import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { demo, demoAttiva } from "./demo";

export type Tipo = "sito" | "supabase" | "funzioni" | "github" | "metriche";

export type Controllo = {
  creato_il: string;
  app_id: string;
  tipo: Tipo;
  oggetto: string;
  ok: boolean;
  latenza_ms: number | null;
  dati: any;
};

export type App = {
  id: string;
  nome: string;
  repo: string | null;
  supabase_ref: string | null;
  /** Solo in modalità demo: prodotto comprato dal cliente, logo e località. */
  prodotto?: string;
  logo?: string;
  citta?: string;
};

export type Livello = "ok" | "attenzione" | "critico" | "assente";

/** La raccolta gira ogni 10 minuti: oltre 25 minuti senza dati la consideriamo ferma. */
export const MINUTI_DATI_VECCHI = 25;
const AGGIORNA_OGNI_MS = 60_000;

/** Carica una query e la ricarica ogni minuto. */
export function useDati<T>(carica: () => Promise<T>, dipendenze: unknown[] = []) {
  const [dati, setDati] = useState<T | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const f = useCallback(carica, dipendenze);

  useEffect(() => {
    let vivo = true;
    const giro = () =>
      f().then(
        (d) => vivo && (setDati(d), setErrore(null)),
        (e) => vivo && setErrore(e instanceof Error ? e.message : String(e)),
      );
    giro();
    const t = setInterval(giro, AGGIORNA_OGNI_MS);
    // Sul telefono l'app resta sospesa in background: quando torna in primo piano ricarica subito.
    const visibile = () => document.visibilityState === "visible" && giro();
    document.addEventListener("visibilitychange", visibile);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", visibile);
    };
  }, [f]);

  return { dati, errore };
}

async function esegui<T>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as T;
}

export const caricaApp = () =>
  demoAttiva() ? demo.app() : esegui<App[]>(supabase.from("app").select("id, nome, repo, supabase_ref").eq("attiva", true).order("nome"));

export type LinkUtile = { gruppo: string; nome: string; url: string };

export const caricaLink = (appId: string) =>
  demoAttiva() ? demo.link() : esegui<LinkUtile[]>(supabase.from("link").select("gruppo, nome, url").eq("app_id", appId).order("ordine"));

/** Link ricavati da repo e progetto Supabase, più quelli registrati in ipamonitor.link. */
export function linkUtili(app: App, siti: Controllo[], extra: LinkUtile[]): LinkUtile[] {
  const l: LinkUtile[] = siti.map((s) => ({ gruppo: "Siti online", nome: s.dati?.nome ?? s.oggetto, url: s.oggetto }));
  if (app.repo) {
    const g = `https://github.com/${app.repo}`;
    l.push(
      { gruppo: "GitHub", nome: "Repository", url: g },
      { gruppo: "GitHub", nome: "Pull request", url: `${g}/pulls` },
      { gruppo: "GitHub", nome: "Actions", url: `${g}/actions` },
      { gruppo: "GitHub", nome: "Issue", url: `${g}/issues` },
    );
  }
  if (app.supabase_ref) {
    const s = `https://supabase.com/dashboard/project/${app.supabase_ref}`;
    l.push(
      { gruppo: "Supabase", nome: "Panoramica", url: s },
      { gruppo: "Supabase", nome: "Tabelle", url: `${s}/editor` },
      { gruppo: "Supabase", nome: "SQL", url: `${s}/sql/new` },
      { gruppo: "Supabase", nome: "Utenti", url: `${s}/auth/users` },
      { gruppo: "Supabase", nome: "Edge Function", url: `${s}/functions` },
      { gruppo: "Supabase", nome: "Log", url: `${s}/logs/explorer` },
    );
  }
  return [...l, ...extra];
}

export const caricaUltimo = (appId?: string) => {
  if (demoAttiva()) return demo.ultimo(appId);
  let q = supabase.from("ultimo_stato").select("creato_il, app_id, tipo, oggetto, ok, latenza_ms, dati");
  if (appId) q = q.eq("app_id", appId);
  return esegui<Controllo[]>(q);
};

/** Storico delle ultime 24 ore dei controlli con latenza (siti). */
export const caricaStorico = (appId: string) =>
  demoAttiva() ? demo.storico(appId) : esegui<Controllo[]>(
    supabase
      .from("controlli")
      .select("creato_il, app_id, tipo, oggetto, ok, latenza_ms, dati")
      .eq("app_id", appId)
      .eq("tipo", "sito")
      .gte("creato_il", new Date(Date.now() - 24 * 3600_000).toISOString())
      .order("creato_il"),
  );

export type Connessione = {
  chiave: string;
  nome: string | null;
  ruolo: string | null;
  ultimo_login: string | null;
  ultima_attivita: string | null;
  letto_il: string;
};

/** Online = un segnale dall'app negli ultimi 3 minuti (le app ne mandano uno al minuto a pagina visibile). */
export const MINUTI_ONLINE = 3;
export const online = (c: Connessione) => !!c.ultima_attivita && minutiFa(c.ultima_attivita) <= MINUTI_ONLINE;

export const caricaConnessioni = (appId: string) =>
  demoAttiva() ? demo.connessioni(appId) : esegui<Connessione[]>(
    supabase
      .from("connessioni")
      .select("chiave, nome, ruolo, ultimo_login, ultima_attivita, letto_il")
      .eq("app_id", appId)
      .order("ultima_attivita", { ascending: false, nullsFirst: false }),
  );

/** Un controllo KO su siti o database è critico; su deploy, funzioni e metriche è un avviso. */
export function livelloControllo(c: Controllo): Livello {
  if (c.ok) return "ok";
  return c.tipo === "sito" || c.tipo === "supabase" ? "critico" : "attenzione";
}

const PESO: Record<Livello, number> = { assente: 0, ok: 1, attenzione: 2, critico: 3 };
export const peggiore = (livelli: Livello[]): Livello =>
  livelli.reduce<Livello>((a, b) => (PESO[b] > PESO[a] ? b : a), "assente");

export const minutiFa = (iso: string) => (Date.now() - new Date(iso).getTime()) / 60_000;

export function quando(iso: string | null | undefined): string {
  if (!iso) return "mai";
  const d = new Date(iso);
  if (d.getFullYear() < 2000) return "mai";
  if (iso.length === 10) return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" }); // solo data
  const min = (Date.now() - d.getTime()) / 60_000;
  if (min < 1) return "adesso";
  if (min < 60) return `${Math.round(min)} min fa`;
  if (min < 24 * 60) return `${Math.round(min / 60)} h fa`;
  return d.toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Testo leggibile per un controllo KO. */
export function descriviProblema(c: Controllo): string {
  const d = c.dati ?? {};
  if (d.errore) return String(d.errore);
  switch (c.tipo) {
    case "sito":
      return `${d.nome ?? c.oggetto}: risponde HTTP ${d.status}`;
    case "github":
      return `${c.oggetto.replace(/^workflow:/, "")}: ${d.esito ?? d.stato}`;
    case "supabase":
      if (c.oggetto === "errori_api_10min") return `${d.errori} errori 5xx negli ultimi 10 minuti`;
      if (Array.isArray(d)) {
        const giu = d.filter((s: { healthy: boolean }) => !s.healthy).map((s: { name: string }) => s.name);
        return `Servizi non sani: ${giu.join(", ")}`;
      }
      return c.oggetto;
    case "funzioni":
      return `Edge Function ${c.oggetto}: ${d.status}`;
    case "metriche":
      if (Number(d.mail_errori_24h) > 0) return `${d.mail_errori_24h} mail in errore nelle ultime 24 h`;
      return "Metriche con anomalie";
  }
}

export const nomeWorkflow = (c: Controllo) => c.oggetto.replace(/^workflow:/, "");
