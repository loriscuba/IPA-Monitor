# IPA Monitor: come collegarsi a Supabase

_Analisi del 22/10/2026 su GymIN, BeachIn e sui progetti Supabase dell'account._

## Situazione attuale

| Dove | Cosa contiene | Accesso dalle app |
|---|---|---|
| **Supabase Cloud "Demo IPA"** (`exchjppslwhbnbzuhfqs`, eu-west-1) | Progetto condiviso tra demo, uno schema per app: `beachin` (17 tabelle), `drinkin` (5), `japan` (1) | BeachIn: chiave anon, nessuna sessione Auth, RLS aperta (demo). 4 Edge Function `beachin-*` |
| **Supabase Cloud "GymIN"** (`aprufgirtymgadzmzjbk`, eu-west-1) | Schema `public` (18 tabelle) + `test` (16). Ha già tabelle di log utili: `audit_log`, `import_log`, `mail_log`, `accessi_log`, `report_serali` | Staff con Supabase Auth + RLS; il mailer Node usa la service_role. Edge Function `report-serale`, `send-mail` |
| **Supabase self-hosted BeachIn produzione** (VM Oracle `prod-db`, `api-141-148-241-169.sslip.io`) | Stesso schema `beachin` | Solo dal workflow "Deploy". **Non** visibile dalla Management API di Supabase |

Vincolo importante: l'organizzazione ha già **2 progetti gratuiti attivi** (il massimo del piano Free), quindi un terzo progetto "IPA Monitor" richiederebbe il piano a pagamento. Lo schema separato dentro "Demo IPA" segue invece lo stesso schema già usato per BeachIn/DrinkIn.

## Opzioni

**A. Management API di Supabase (token personale)**
Stato dei progetti, log API/DB/Edge Function, elenco funzioni, advisor di sicurezza. Nessuna modifica alle app.
Contro: copre solo i progetti cloud (non la produzione self-hosted); il token ha pieni poteri sull'account, quindi deve stare solo lato server (segreto di una Edge Function), mai nel browser.

**B. Ruolo di sola lettura per ogni database**
In ogni DB una vista `monitor.riepilogo` (es. ultimo accesso, mail fallite, comande di oggi, ultimo import) e un ruolo `monitor_ro` con `SELECT` solo su quella vista. Il collettore la legge con una stringa di connessione dedicata.
Pro: metriche "di business" precise, funziona anche sul self-hosted. Contro: una credenziale per DB, da aggiornare se cambia lo schema.

**C. Tabella eventi centrale (push)**
Ogni app manda eventi (errore, deploy, login, mail inviata...) a un endpoint `ipa-ingest` con una chiave per app, che scrive in `ipamonitor.eventi`. Si può fare senza toccare il frontend: trigger SQL + `pg_net` sulle tabelle di log già esistenti (es. `audit_log`, `mail_log`).
Pro: formato unico, quasi in tempo reale, funziona ovunque. Contro: va aggiunto in ogni app (una migrazione per progetto).

**D. Service role key nel cruscotto** — sconsigliata: salta ogni RLS e, se finisce nel frontend, espone tutti i dati.

## Raccomandazione

Approccio a strati, tutto dentro un nuovo schema **`ipamonitor`** nel progetto "Demo IPA":

1. **Collettore programmato** (Edge Function `ipa-collect` lanciata da `pg_cron` ogni 10 minuti) che usa:
   - Management API per salute, log ed Edge Function dei 2 progetti cloud (opzione A);
   - un ping HTTP agli URL di deploy (Pages, Cloudflare, Vercel, produzione);
   - l'API GitHub per workflow, PR e commit (token in sola lettura).
   Salva istantanee in `ipamonitor.stato` / `ipamonitor.controlli`.
2. **Metriche delle app** con l'opzione B: vista `monitor.riepilogo` + ruolo `monitor_ro` in GymIN, in Demo IPA (schema `beachin`) e nella produzione self-hosted.
3. **Cruscotto** che legge solo lo schema `ipamonitor`, con login Supabase Auth riservato a Loris (RLS sull'email). Nessuna chiave degli altri progetti nel browser.
4. **In un secondo momento** l'opzione C per gli eventi critici in tempo reale (errori, mail fallite), partendo dai trigger su `audit_log` / `mail_log` di GymIN.

Tutti i segreti (token Management API, token GitHub, stringhe `monitor_ro`) vanno nei Secrets delle Edge Function, mai nel repo.

## Da decidere

- Quali metriche contano per ogni app (proposta iniziale sopra, nel punto 2).
- Se includere lo schema `test` di GymIN e le altre demo (`drinkin`, `japan`).
- Se la produzione BeachIn va monitorata subito (serve aprire l'accesso dal collettore alla VM `prod-db`).
