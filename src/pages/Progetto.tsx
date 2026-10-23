import { Link, useParams } from "react-router-dom";
import { Latenza } from "../components/Latenza";
import { Stato } from "../components/Stato";
import {
  type App,
  type Connessione,
  type Controllo,
  type Livello,
  type LinkUtile,
  caricaApp,
  caricaConnessioni,
  caricaLink,
  caricaStorico,
  caricaUltimo,
  descriviProblema,
  linkUtili,
  livelloControllo,
  nomeWorkflow,
  online,
  peggiore,
  quando,
  useDati,
} from "../dati";
import { riassumi } from "../riassunto";

export function Progetto() {
  const { id = "" } = useParams();
  const { dati, errore } = useDati(
    () => Promise.all([caricaApp(), caricaUltimo(id), caricaStorico(id), caricaConnessioni(id), caricaLink(id)]),
    [id],
  );

  if (errore) return <p className="errore">Impossibile leggere i dati: {errore}</p>;
  if (!dati) return <p className="muto">Caricamento…</p>;
  const [elenco, controlli, storico, connessioni, extra] = dati;
  const app = elenco.find((a) => a.id === id);
  if (!app) return <p>Progetto non trovato. <Link to="/">Torna alla Dashboard</Link></p>;
  const r = riassumi(controlli);

  return (
    <>
      <p className="briciole">
        <Link to="/">Dashboard</Link> / {app.prodotto && `${app.prodotto} / `}
        {app.nome}
      </p>
      <div className="titolo-progetto">
        {app.logo && <img className="logo-cliente" src={app.logo} alt="" />}
        <h1>Monitoring {app.nome}</h1>
        <Stato livello={r.livello} />
      </div>
      <p className="muto piccolo">
        {r.datiVecchi ? "⚠ La raccolta sembra ferma: ultimo dato " : "Ultima raccolta "}
        {quando(r.aggiornato)} · si aggiorna da sola ogni minuto
        {app.repo && (
          <>
            {" · "}
            <a href={`https://github.com/${app.repo}`} target="_blank" rel="noreferrer">
              {app.repo}
            </a>
          </>
        )}
      </p>

      {r.problemi.length > 0 && (
        <section className={`pannello avviso avviso-${peggiore(r.problemi.map(livelloControllo))}`}>
          <h2>Da guardare</h2>
          <ul className="problemi">
            {r.problemi.map((c) => (
              <li key={c.tipo + c.oggetto} className={`problema-${livelloControllo(c)}`}>
                {descriviProblema(c)} <span className="muto">· {quando(c.creato_il)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="colonne">
        <section className="pannello">
          <Testata titolo="Parte web" livello={r.web} />
          <h3>Siti</h3>
          {r.siti.length ? (
            r.siti.map((s) => <Sito key={s.oggetto} sito={s} storico={storico.filter((p) => p.oggetto === s.oggetto)} />)
          ) : (
            <p className="muto">Nessun sito registrato per questo progetto.</p>
          )}
          <h3>Deploy e workflow</h3>
          {r.workflow.length ? (
            <table>
              <tbody>
                {r.workflow.map((w) => (
                  <tr key={w.oggetto}>
                    <td>
                      <a href={w.dati?.url} target="_blank" rel="noreferrer">
                        {nomeWorkflow(w)}
                      </a>
                    </td>
                    <td>
                      <Stato livello={livelloControllo(w)} testo={w.dati?.esito ?? w.dati?.stato} />
                    </td>
                    <td className="muto destra">
                      <code>{w.dati?.commit}</code> · {quando(w.dati?.il)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muto">Nessun workflow su main.</p>
          )}
          {r.pr && (
            <p className="piccolo">
              <a href={`https://github.com/${app.repo}/pulls`} target="_blank" rel="noreferrer">
                {r.pr.totale} PR aperte
              </a>
              {r.pr.bozze > 0 && <span className="muto"> ({r.pr.bozze} in bozza)</span>}
            </p>
          )}
        </section>

        <section className="pannello">
          <Testata titolo="Database" livello={r.salute || r.metriche ? r.database : "assente"} />
          <h3>Servizi Supabase</h3>
          {r.salute ? <Servizi salute={r.salute} erroriApi={r.erroriApi} /> : <Manca cosa="il segreto SUPABASE_PAT nella funzione ipa-collect" />}
          {r.funzioni.length > 0 && (
            <>
              <h3>Edge Function</h3>
              <ul className="etichette">
                {r.funzioni.map((f) => (
                  <li key={f.oggetto}>
                    <Stato livello={livelloControllo(f)} testo={f.oggetto} />
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3>Dati dell'app</h3>
          {r.metriche ? (
            r.metriche.ok || !r.metriche.dati?.errore ? (
              <Metriche gymin={eGymin(app)} m={r.metriche} />
            ) : (
              <p className="errore">{descriviProblema(r.metriche)}</p>
            )
          ) : (
            <Manca cosa={eGymin(app) ? "il segreto GYMIN_MONITOR_DB_URL (vedi docs/ATTIVAZIONE.md, punto 3)" : "la vista di riepilogo"} />
          )}
        </section>
      </div>

      <LinkUtili link={linkUtili(app, r.siti, extra)} />
      <Utenti connessioni={connessioni} />
    </>
  );
}

function LinkUtili({ link }: { link: LinkUtile[] }) {
  const gruppi = [...new Set(link.map((l) => l.gruppo))];
  return (
    <section className="pannello link-utili">
      <h2>Link utili</h2>
      <div className="link-gruppi">
        {gruppi.map((g) => (
          <div key={g}>
            <h3>{g}</h3>
            <ul className="etichette">
              {link
                .filter((l) => l.gruppo === g)
                .map((l) => (
                  <li key={l.url}>
                    <a className="link-chip" href={l.url} target="_blank" rel="noreferrer" title={l.url}>
                      {l.nome}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Utenti({ connessioni }: { connessioni: Connessione[] }) {
  const attivi = connessioni.filter(online);
  const letto = connessioni.reduce<string | null>((a, c) => (!a || c.letto_il > a ? c.letto_il : a), null);
  return (
    <section className="pannello">
      <div className="pannello-testa">
        <h2>Utenti</h2>
        <Stato livello={attivi.length ? "ok" : "assente"} testo={`${attivi.length} online`} />
      </div>
      {connessioni.length ? (
        <table>
          <thead>
            <tr>
              <th>Utente</th>
              <th>Dove</th>
              <th>Ultima connessione</th>
              <th className="destra">Ultima attività</th>
            </tr>
          </thead>
          <tbody>
            {connessioni.map((c) => (
              <tr key={c.chiave}>
                <td>
                  {online(c) ? "🟢 " : ""}
                  {c.nome ?? "—"}
                </td>
                <td className="muto">{c.ruolo ?? "—"}</td>
                <td>{quando(c.ultimo_login)}</td>
                <td className="muto destra">{online(c) ? "online" : quando(c.ultima_attivita)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muto">Nessun utente registrato finora.</p>
      )}
      {letto && <p className="piccolo muto">Letto {quando(letto)} · online = attivo negli ultimi 3 minuti</p>}
    </section>
  );
}

function Testata({ titolo, livello }: { titolo: string; livello: Livello }) {
  return (
    <div className="pannello-testa">
      <h2>{titolo}</h2>
      <Stato livello={livello} />
    </div>
  );
}

function Manca({ cosa }: { cosa: string }) {
  return <p className="muto piccolo">Non ancora collegato: serve {cosa}.</p>;
}

function Sito({ sito, storico }: { sito: Controllo; storico: Controllo[] }) {
  const disponibilita = storico.length ? (storico.filter((p) => p.ok).length / storico.length) * 100 : null;
  return (
    <div className="sito">
      <div className="sito-testa">
        <div>
          <strong>{sito.dati?.nome}</strong>{" "}
          <a href={sito.oggetto} target="_blank" rel="noreferrer" className="piccolo">
            {sito.oggetto.replace(/^https?:\/\//, "")}
          </a>
        </div>
        <Stato livello={livelloControllo(sito)} testo={sito.ok ? `${sito.latenza_ms} ms` : descriviProblema(sito)} />
      </div>
      <Latenza punti={storico} />
      {disponibilita != null && (
        <p className="piccolo muto">
          Disponibilità 24 h: {disponibilita.toFixed(disponibilita === 100 ? 0 : 1)}% su {storico.length} controlli
        </p>
      )}
    </div>
  );
}

function Servizi({ salute, erroriApi }: { salute: Controllo; erroriApi: Controllo | null }) {
  const servizi = Array.isArray(salute.dati) ? (salute.dati as { name: string; healthy: boolean; status?: string }[]) : [];
  return (
    <>
      {salute.dati?.errore && <p className="errore">{salute.dati.errore}</p>}
      <ul className="etichette">
        {servizi.map((s) => (
          <li key={s.name}>
            <Stato livello={s.healthy ? "ok" : "critico"} testo={NOMI_SERVIZI[s.name] ?? s.name} />
          </li>
        ))}
      </ul>
      {salute.latenza_ms != null && <p className="piccolo muto">Risposta della Management API in {salute.latenza_ms} ms</p>}
      {erroriApi && (
        <p className="piccolo">
          {erroriApi.dati?.errore ? (
            <span className="errore">Log non leggibili: {erroriApi.dati.errore}</span>
          ) : (
            <>Errori 5xx ultimi 10 min: <strong>{erroriApi.dati?.errori ?? 0}</strong></>
          )}
        </p>
      )}
    </>
  );
}

const NOMI_SERVIZI: Record<string, string> = {
  db: "Database",
  auth: "Auth",
  rest: "API REST",
  realtime: "Realtime",
  storage: "Storage",
};

type Voce = { chiave: string; nome: string; data?: boolean; soglia?: Livello };

// GymIN: le colonne di monitor.riepilogo (PR GymIN#86). "soglia" = livello quando il valore è > 0.
const VOCI_GYMIN: Voce[] = [
  { chiave: "abbonamenti_attivi", nome: "Abbonamenti attivi" },
  { chiave: "abbonamenti_in_scadenza_7g", nome: "In scadenza entro 7 giorni" },
  { chiave: "accessi_oggi", nome: "Accessi oggi" },
  { chiave: "ultimo_accesso", nome: "Ultimo accesso", data: true },
  { chiave: "accessi_negati_24h", nome: "Accessi negati (24 h)", soglia: "attenzione" },
  { chiave: "accessi_da_verificare", nome: "Accessi da verificare", soglia: "attenzione" },
  { chiave: "pagamenti_da_verificare", nome: "Pagamenti da verificare", soglia: "attenzione" },
  { chiave: "mail_errori_24h", nome: "Mail in errore (24 h)", soglia: "critico" },
  { chiave: "ultima_mail_inviata", nome: "Ultima mail inviata", data: true },
  { chiave: "ultimo_import", nome: "Ultimo import", data: true },
  { chiave: "ultimo_report_serale", nome: "Ultimo report serale", data: true },
  { chiave: "ultima_modifica", nome: "Ultima modifica ai dati", data: true },
];

/** In demo i clienti GymIN hanno le stesse metriche dell'app GymIN. */
const eGymin = (a: App) => a.id === "gymin" || a.prodotto === "GymIN";

const ISO = /^\d{4}-\d{2}-\d{2}/;

function Metriche({ gymin, m }: { gymin: boolean; m: Controllo }) {
  const d = (m.dati ?? {}) as Record<string, unknown>;
  const voci: Voce[] =
    gymin
      ? VOCI_GYMIN
      : Object.keys(d)
          .filter((k) => k !== "letto_il")
          .map((k) => ({ chiave: k, nome: k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), data: ISO.test(String(d[k])) }));

  return (
    <dl className="metriche">
      {voci.map((v) => {
        const val = d[v.chiave];
        const allarme = v.soglia && Number(val) > 0 ? v.soglia : null;
        return (
          <div key={v.chiave} className={allarme ? `metrica metrica-${allarme}` : "metrica"}>
            <dt>{v.nome}</dt>
            <dd>
              {allarme && <span aria-hidden>{allarme === "critico" ? "✕ " : "! "}</span>}
              {val == null ? "—" : v.data ? quando(String(val)) : String(val)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
