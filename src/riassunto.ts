import {
  type Controllo,
  type Livello,
  MINUTI_DATI_VECCHI,
  livelloControllo,
  minutiFa,
  peggiore,
} from "./dati";

export type Riassunto = {
  livello: Livello;
  aggiornato: string | null;
  datiVecchi: boolean;
  siti: Controllo[];
  workflow: Controllo[];
  salute: Controllo | null;
  erroriApi: Controllo | null;
  funzioni: Controllo[];
  metriche: Controllo | null;
  pr: { totale: number; bozze: number } | null;
  problemi: Controllo[];
  web: Livello;
  database: Livello;
};

/** Raggruppa l'ultimo stato di un'app nelle due aree che contano: parte web e database. */
export function riassumi(controlli: Controllo[]): Riassunto {
  const di = (t: Controllo["tipo"]) => controlli.filter((c) => c.tipo === t);
  const uno = (t: Controllo["tipo"], o: string) => controlli.find((c) => c.tipo === t && c.oggetto === o) ?? null;

  const siti = di("sito").sort((a, b) => String(a.dati?.nome).localeCompare(String(b.dati?.nome)));
  const github = di("github");
  const workflow = github.filter((c) => c.oggetto.startsWith("workflow:"));
  const salute = uno("supabase", "salute");
  const erroriApi = uno("supabase", "errori_api_10min");
  const funzioni = di("funzioni");
  const metriche = uno("metriche", "riepilogo");
  const prC = uno("github", "pr_aperte");

  const aggiornato = controlli.reduce<string | null>((m, c) => (!m || c.creato_il > m ? c.creato_il : m), null);
  const datiVecchi = aggiornato != null && minutiFa(aggiornato) > MINUTI_DATI_VECCHI;

  const web = peggiore([...siti, ...workflow].map(livelloControllo));
  const database = peggiore([salute, erroriApi, metriche, ...funzioni].filter(Boolean).map((c) => livelloControllo(c!)));
  const problemi = controlli.filter((c) => !c.ok).sort((a, b) => (livelloControllo(a) === "critico" ? -1 : 0) - (livelloControllo(b) === "critico" ? -1 : 0));

  let livello = peggiore([web, database, ...github.map(livelloControllo)]);
  if (datiVecchi && livello !== "critico") livello = "attenzione";

  return {
    livello,
    aggiornato,
    datiVecchi,
    siti,
    workflow,
    salute,
    erroriApi,
    funzioni,
    metriche,
    pr: prC ? { totale: Number(prC.dati?.totale ?? 0), bozze: Number(prC.dati?.bozze ?? 0) } : null,
    problemi,
    web,
    database,
  };
}
