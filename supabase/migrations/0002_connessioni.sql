-- Utenti online: il collettore, lanciato ogni minuto con {"solo":"utenti"}, copia qui le viste utenti delle app
-- (GymIN monitor.utenti via monitor_ro, BeachIn beachin.monitor_utenti). Una riga per utente/dispositivo.
-- Online = ultima_attivita negli ultimi 3 minuti (le app mandano un segnale al minuto a pagina visibile).

create table if not exists ipamonitor.connessioni (
  app_id           text not null references ipamonitor.app(id) on delete cascade,
  chiave           text not null,          -- id utente Auth (GymIN) o id dispositivo (BeachIn)
  nome             text,                   -- email staff, utente demo o 'visitatore'
  ruolo            text,                   -- 'staff' o area dell'app (gestionale, comandapp, adminapp, menu, sito)
  ultimo_login     timestamptz,
  ultima_attivita  timestamptz,
  letto_il         timestamptz not null default now(),
  primary key (app_id, chiave)
);

alter table ipamonitor.connessioni enable row level security;
create policy lettura on ipamonitor.connessioni for select to authenticated using (ipamonitor.autorizzato());
revoke all on ipamonitor.connessioni from public, anon, authenticated;
grant select on ipamonitor.connessioni to authenticated;

select cron.schedule('ipamonitor-utenti', '* * * * *', $cron$
  select net.http_post(
    url     := 'https://exchjppslwhbnbzuhfqs.supabase.co/functions/v1/ipa-collect',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ipamonitor_cron_secret')),
    body    := '{"solo":"utenti"}'::jsonb,
    timeout_milliseconds := 20000);
$cron$);
