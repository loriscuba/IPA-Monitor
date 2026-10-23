import type { App, Connessione, Controllo, LinkUtile } from "./dati";

/**
 * Modalità demo: prodotti (BeachIn, GymIN) con sotto i clienti che li hanno comprati.
 * Tutti i dati sono inventati e generati qui: in demo non si legge né si scrive nulla su Supabase.
 */
const CHIAVE = "ipa-demo";

let attiva = (() => {
  try {
    return localStorage.getItem(CHIAVE) === "1";
  } catch {
    return false;
  }
})();

export const demoAttiva = () => attiva;

export function impostaDemo(v: boolean) {
  attiva = v;
  try {
    localStorage.setItem(CHIAVE, v ? "1" : "0");
  } catch {
    /* solo per comodità: senza storage la demo vale per la sessione */
  }
}

export const PRODOTTI = ["BeachIn", "GymIN"] as const;

const CLIENTI: App[] = [
  { id: "demo-lido-dei-pini", nome: "Lido dei Pini", prodotto: "BeachIn", citta: "Savona", logo: "demo/lido-dei-pini.png", repo: null, supabase_ref: null },
  { id: "demo-bagno-oasi", nome: "Bagno l'Oasi", prodotto: "BeachIn", citta: "Chiavari", logo: "demo/bagno-oasi.jpg", repo: null, supabase_ref: null },
  { id: "demo-bagni-test", nome: "Bagni Test", prodotto: "BeachIn", citta: "Ambiente di prova", logo: "demo/bagni-test.svg", repo: null, supabase_ref: null },
  { id: "demo-kinesia", nome: "Kinesia", prodotto: "GymIN", citta: "Palestra", logo: "demo/kinesia.png", repo: null, supabase_ref: null },
];

const min = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const SERVIZI = ["db", "auth", "rest", "realtime", "storage"];

type Sito = { nome: string; url: string; ms: number; giu?: number };
type Profilo = {
  siti: Sito[];
  deploy: { esito: string; ore: number; commit: string };
  servizioGiu?: string;
  errori5xx: number;
  funzioni: { nome: string; status: number }[];
  metriche: Record<string, unknown>;
  metricheKo?: boolean;
  utenti: [string, string, number | null, number][]; // nome, ruolo, minuti dall'ultima attività, ore dall'ultimo login
};

const PROFILI: Record<string, Profilo> = {
  // Tutto in ordine: il cliente di riferimento.
  "demo-lido-dei-pini": {
    siti: [
      { nome: "Gestionale", url: "https://lidodeipini.beachin.app", ms: 182 },
      { nome: "App clienti", url: "https://lidodeipini.beachin.app/clienti", ms: 214 },
      { nome: "Menu", url: "https://lidodeipini.beachin.app/menu", ms: 167 },
    ],
    deploy: { esito: "success", ore: 5, commit: "a41f9c2" },
    errori5xx: 0,
    funzioni: [{ nome: "invia-push", status: 200 }, { nome: "assistente", status: 200 }],
    metriche: { comande_oggi: 86, comande_in_attesa: 2, ultima_comanda: min(4), richieste_ristorante_aperte: 3, richieste_eventi_aperte: 1, push_iscrizioni: 412, ultimo_push: min(95) },
    utenti: [["Marco (titolare)", "Gestionale", 1, 3], ["Giulia", "Bar", 2, 6], ["Andrea", "Spiaggia", 18, 7], ["Sara", "Cucina", 240, 26]],
  },
  // Tutto in ordine anche qui.
  "demo-bagno-oasi": {
    siti: [
      { nome: "Gestionale", url: "https://oasi.beachin.app", ms: 241 },
      { nome: "App clienti", url: "https://oasi.beachin.app/clienti", ms: 263 },
    ],
    deploy: { esito: "success", ore: 30, commit: "77be014" },
    errori5xx: 0,
    funzioni: [{ nome: "invia-push", status: 200 }, { nome: "assistente", status: 200 }],
    metriche: { comande_oggi: 41, comande_in_attesa: 1, ultima_comanda: min(12), richieste_ristorante_aperte: 2, richieste_eventi_aperte: 0, push_iscrizioni: 158, ultimo_push: min(180) },
    utenti: [["Roberta (titolare)", "Gestionale", 2, 2], ["Luca", "Bar", 35, 9]],
  },
  // Ambiente di prova con problemi seri: gestionale giù e deploy fallito.
  "demo-bagni-test": {
    siti: [
      { nome: "Gestionale", url: "https://test.beachin.app", ms: 0, giu: 502 },
      { nome: "App clienti", url: "https://test.beachin.app/clienti", ms: 398 },
    ],
    deploy: { esito: "failure", ore: 1, commit: "e03d5aa" },
    servizioGiu: "realtime",
    errori5xx: 37,
    funzioni: [{ nome: "invia-push", status: 200 }],
    metriche: { comande_oggi: 3, comande_in_attesa: 0, ultima_comanda: min(70), richieste_ristorante_aperte: 0, richieste_eventi_aperte: 0, push_iscrizioni: 5, ultimo_push: min(60 * 50) },
    utenti: [["Tester", "Gestionale", 50, 1]],
  },
  // GymIN: palestra con mail in errore e accessi da controllare.
  "demo-kinesia": {
    siti: [
      { nome: "Gestionale", url: "https://kinesia.gymin.app", ms: 205 },
      { nome: "Ingresso", url: "https://kinesia.gymin.app/ingresso", ms: 152 },
    ],
    deploy: { esito: "success", ore: 20, commit: "3c9d1e7" },
    errori5xx: 0,
    funzioni: [{ nome: "report-serale", status: 200 }, { nome: "invia-mail", status: 200 }],
    metriche: {
      abbonamenti_attivi: 312,
      abbonamenti_in_scadenza_7g: 18,
      accessi_oggi: 127,
      ultimo_accesso: min(3),
      accessi_negati_24h: 4,
      accessi_da_verificare: 2,
      pagamenti_da_verificare: 0,
      mail_errori_24h: 3,
      ultima_mail_inviata: min(40),
      ultimo_import: min(60 * 9),
      ultimo_report_serale: min(60 * 11),
      ultima_modifica: min(6),
    },
    metricheKo: true,
    utenti: [["Elena (reception)", "Gestionale", 1, 4], ["Paolo (istruttore)", "Gestionale", 9, 5], ["Tornello", "Ingresso", 1, 72]],
  },
};

function controlli(id: string): Controllo[] {
  const p = PROFILI[id];
  const c = (tipo: Controllo["tipo"], oggetto: string, ok: boolean, dati: unknown, latenza_ms: number | null = null, m = 2): Controllo => ({
    creato_il: min(m),
    app_id: id,
    tipo,
    oggetto,
    ok,
    latenza_ms,
    dati,
  });
  return [
    ...p.siti.map((s) => c("sito", s.url, !s.giu, { nome: s.nome, status: s.giu ?? 200 }, s.giu ? null : s.ms)),
    c("github", "workflow:Deploy", p.deploy.esito === "success", { esito: p.deploy.esito, stato: "completed", il: min(p.deploy.ore * 60), commit: p.deploy.commit }),
    c("supabase", "salute", !p.servizioGiu, SERVIZI.map((name) => ({ name, healthy: name !== p.servizioGiu })), 310),
    c("supabase", "errori_api_10min", p.errori5xx < 10, { errori: p.errori5xx }),
    ...p.funzioni.map((f) => c("funzioni", f.nome, f.status < 400, { status: f.status })),
    c("metriche", "riepilogo", !p.metricheKo, { letto_il: min(2), ...p.metriche }),
  ];
}

/** 24 ore di controlli dei siti ogni 10 minuti, con un po' di rumore e qualche buco. */
function storico(id: string): Controllo[] {
  const p = PROFILI[id];
  let seme = id.length * 7919;
  const caso = () => ((seme = (seme * 16807) % 2147483647) / 2147483647);
  const out: Controllo[] = [];
  for (const s of p.siti) {
    const base = s.ms || 260;
    for (let m = 24 * 60; m >= 2; m -= 10) {
      const giu = (s.giu && m < 45) || caso() < 0.008;
      out.push({
        creato_il: min(m),
        app_id: id,
        tipo: "sito",
        oggetto: s.url,
        ok: !giu,
        latenza_ms: giu ? null : Math.round(base * (0.75 + caso() * 0.5) + (caso() < 0.04 ? base : 0)),
        dati: { nome: s.nome, status: giu ? s.giu ?? 503 : 200 },
      });
    }
  }
  return out;
}

function connessioni(id: string): Connessione[] {
  return PROFILI[id].utenti.map(([nome, ruolo, attivita, login], i) => ({
    chiave: `${id}-${i}`,
    nome,
    ruolo,
    ultimo_login: min(login * 60),
    ultima_attivita: attivita == null ? null : min(attivita),
    letto_il: min(1),
  }));
}

const pronto = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 150));

export const demo = {
  app: () => pronto(CLIENTI),
  ultimo: (appId?: string) => pronto((appId ? [appId] : CLIENTI.map((a) => a.id)).filter((i) => PROFILI[i]).flatMap(controlli)),
  storico: (appId: string) => pronto(PROFILI[appId] ? storico(appId) : []),
  connessioni: (appId: string) => pronto(PROFILI[appId] ? connessioni(appId) : []),
  link: () => pronto<LinkUtile[]>([]),
};
