# IPA Monitor: passi per attivare la raccolta

Già fatto su **Demo IPA**: schema `ipamonitor`, la vista `beachin.monitor_riepilogo`, la Edge Function `ipa-collect` e la pianificazione ogni 10 minuti (pg_cron). La tua email è già tra gli utenti autorizzati a leggere.

## 1. Segreto della pianificazione (obbligatorio)
Supabase → progetto **Demo IPA** → SQL Editor:

```sql
select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'ipamonitor_cron_secret');
```

Da questo momento la raccolta parte da sola: siti BeachIn, GitHub Actions/PR (se i repo sono pubblici) e metriche BeachIn.

## 2. Segreti della funzione (facoltativi, ognuno attiva un controllo)
Demo IPA → Edge Functions → Secrets:

| Nome | Dove si prende | Attiva |
|---|---|---|
| `MANAGEMENT_API_TOKEN` (o `SUPABASE-PAT`) | supabase.com → Account → Access Tokens | salute progetti, errori API, stato Edge Function |
| `GITHUB_TOKEN` | GitHub → token fine-grained, sola lettura su GymIN e BeachIn (Actions, Pull requests) | GitHub se i repo sono privati |
| `GYMIN_MONITOR_DB_URL` | vedi punto 3 | metriche GymIN |

## 3. GymIN (dopo il merge della PR GymIN #86)
1. Applicare la migrazione `20261022120000_monitor_riepilogo.sql` sul progetto GymIN.
2. SQL Editor di GymIN: `alter role monitor_ro with login password '<password-lunga>';`
3. Segreto `GYMIN_MONITOR_DB_URL` = `postgresql://monitor_ro.aprufgirtymgadzmzjbk:<password>@<host-pooler>:6543/postgres`
   (host del pooler: GymIN → Connect → Transaction pooler).

## 4. Siti di GymIN
Non ho trovato l'indirizzo pubblico di GymIN. Per aggiungerlo:

```sql
insert into ipamonitor.siti (app_id, nome, url) values ('gymin', 'Sito', 'https://...');
```

## 5. Utenti online
1. Migrazione GymIN `20261022150000_monitor_utenti.sql` (PR su GymIN): vista `monitor.utenti` + segnale dall'app staff.
2. BeachIn: migrazione `0010_monitor_utenti.sql`, già applicata sul Demo.
3. SQL Editor di Demo IPA: il job che aggiorna `ipamonitor.connessioni` ogni minuto, cioè il blocco
   `cron.schedule('ipamonitor-utenti', ...)` di `supabase/migrations/0002_connessioni.sql`.

## Verifica
```sql
select * from ipamonitor.ultimo_stato order by app_id, tipo, oggetto;
select app_id, nome, ruolo, ultimo_login, ultima_attivita from ipamonitor.connessioni order by ultima_attivita desc;
```
