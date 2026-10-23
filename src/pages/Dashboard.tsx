import { Link } from "react-router-dom";
import { Stato } from "../components/Stato";
import { type App, type Controllo, caricaApp, caricaUltimo, descriviProblema, livelloControllo, peggiore, quando, useDati } from "../dati";
import { riassumi } from "../riassunto";
import { PRODOTTI, demoAttiva } from "../demo";

export function Dashboard() {
  const { dati, errore } = useDati(() => Promise.all([caricaApp(), caricaUltimo()]));

  if (errore) return <p className="errore">Impossibile leggere i dati: {errore}</p>;
  if (!dati) return <p className="muto">Caricamento…</p>;
  const [app, controlli] = dati;
  if (!app.length) return <p className="muto">Nessuna app configurata (o utente non autorizzato).</p>;

  return (
    <>
      <h1>Dashboard</h1>
      {demoAttiva() ? (
        PRODOTTI.map((p) => {
          const clienti = app.filter((a) => a.prodotto === p);
          return (
            <section key={p} className="prodotto">
              <div className="prodotto-testa">
                <h2>{p}</h2>
                <span className="muto piccolo">{clienti.length === 1 ? "1 cliente" : `${clienti.length} clienti`}</span>
                <Stato livello={peggiore(clienti.map((a) => riassumi(controlli.filter((c) => c.app_id === a.id)).livello))} />
              </div>
              <Griglia app={clienti} controlli={controlli} />
            </section>
          );
        })
      ) : (
        <Griglia app={app} controlli={controlli} />
      )}
    </>
  );
}

function Griglia({ app, controlli }: { app: App[]; controlli: Controllo[] }) {
  return (
    <div className="griglia">
      {app.map((a) => (
        <Card key={a.id} app={a} controlli={controlli.filter((c) => c.app_id === a.id)} />
      ))}
    </div>
  );
}

function Card({ app, controlli }: { app: App; controlli: Controllo[] }) {
  const r = riassumi(controlli);
  const online = r.siti.filter((s) => s.ok).length;
  const latenze = r.siti.filter((s) => s.ok && s.latenza_ms != null).map((s) => s.latenza_ms!);
  const ultimoDeploy = r.workflow
    .filter((w) => /deploy/i.test(w.oggetto))
    .sort((a, b) => String(b.dati?.il).localeCompare(String(a.dati?.il)))[0];

  return (
    <Link to={`/progetto/${app.id}`} className="card">
      <div className="card-testa">
        <div className="card-nome">
          {app.logo && <img className="logo-cliente" src={app.logo} alt="" />}
          <div>
            <h2>{app.nome}</h2>
            {app.citta && <span className="muto piccolo">{app.citta}</span>}
          </div>
        </div>
        <Stato livello={r.livello} />
      </div>

      <dl className="righe">
        <dt>Web</dt>
        <dd>
          {r.siti.length ? (
            <>
              <Stato livello={peggiore(r.siti.map(livelloControllo))} testo={`${online}/${r.siti.length} online`} />
              {latenze.length > 0 && <span className="muto"> · {Math.max(...latenze)} ms</span>}
            </>
          ) : (
            <span className="muto">nessun sito</span>
          )}
        </dd>
        <dt>Database</dt>
        <dd>
          {r.salute || r.metriche ? (
            <Stato livello={r.database} testo={r.database === "ok" ? "Operativo" : r.database === "critico" ? "Problemi" : "Attenzione"} />
          ) : (
            <span className="muto">non ancora collegato</span>
          )}
        </dd>
        <dt>Deploy</dt>
        <dd>
          {ultimoDeploy ? (
            <>
              {ultimoDeploy.dati?.esito ?? ultimoDeploy.dati?.stato} <span className="muto">· {quando(ultimoDeploy.dati?.il)}</span>
            </>
          ) : (
            <span className="muto">—</span>
          )}
        </dd>
        <dt>PR aperte</dt>
        <dd>{r.pr ? r.pr.totale : <span className="muto">—</span>}</dd>
      </dl>

      {r.problemi.length > 0 && (
        <ul className="problemi">
          {r.problemi.slice(0, 3).map((c) => (
            <li key={c.tipo + c.oggetto} className={`problema-${livelloControllo(c)}`}>
              {descriviProblema(c)}
            </li>
          ))}
          {r.problemi.length > 3 && <li className="muto">e altri {r.problemi.length - 3}…</li>}
        </ul>
      )}

      <p className="piccolo muto card-piede">
        {r.datiVecchi ? "⚠ Raccolta ferma: ultimo dato " : "Aggiornato "}
        {quando(r.aggiornato)}
      </p>
    </Link>
  );
}
