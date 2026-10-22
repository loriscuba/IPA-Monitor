-- IPA Monitor: schema `ipamonitor` nel progetto Supabase "Demo IPA" (exchjppslwhbnbzuhfqs).
-- Il collettore (Edge Function `ipa-collect`) scrive i controlli; il cruscotto li legge.
-- Lettura consentita solo agli utenti elencati in ipamonitor.utenti (riempita a mano, non nel repo).

create schema if not exists ipamonitor;

create table if not exists ipamonitor.app (
  id            text primary key,          -- es. 'gymin', 'beachin'
  nome          text not null,
  repo          text,                      -- owner/nome su GitHub
  supabase_ref  text,                      -- progetto Supabase Cloud
  attiva        boolean not null default true
);

create table if not exists ipamonitor.siti (
  id      bigint generated always as identity primary key,
  app_id  text not null references ipamonitor.app(id) on delete cascade,
  nome    text not null,                   -- es. 'GitHub Pages'
  url     text not null unique
);

create table if not exists ipamonitor.controlli (
  id          bigint generated always as identity primary key,
  creato_il   timestamptz not null default now(),
  app_id      text references ipamonitor.app(id) on delete cascade,
  tipo        text not null check (tipo in ('sito', 'supabase', 'funzioni', 'github', 'metriche')),
  oggetto     text not null,               -- url, servizio, workflow, nome vista...
  ok          boolean not null,
  latenza_ms  integer,
  dati        jsonb
);
create index if not exists idx_controlli_ultimo on ipamonitor.controlli (app_id, tipo, oggetto, creato_il desc);
create index if not exists idx_controlli_data on ipamonitor.controlli (creato_il);

create table if not exists ipamonitor.utenti (
  email text primary key
);

-- Ultimo controllo per ogni (app, tipo, oggetto)
create or replace view ipamonitor.ultimo_stato with (security_invoker = true) as
select distinct on (app_id, tipo, oggetto) *
from ipamonitor.controlli
order by app_id, tipo, oggetto, creato_il desc;

create or replace function ipamonitor.autorizzato() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from ipamonitor.utenti where email = (auth.jwt() ->> 'email'));
$$;

alter table ipamonitor.app       enable row level security;
alter table ipamonitor.siti      enable row level security;
alter table ipamonitor.controlli enable row level security;
alter table ipamonitor.utenti    enable row level security;

create policy lettura on ipamonitor.app       for select to authenticated using (ipamonitor.autorizzato());
create policy lettura on ipamonitor.siti      for select to authenticated using (ipamonitor.autorizzato());
create policy lettura on ipamonitor.controlli for select to authenticated using (ipamonitor.autorizzato());

revoke all on schema ipamonitor from public, anon;
revoke all on all tables in schema ipamonitor from public, anon, authenticated;
revoke all on function ipamonitor.autorizzato() from public, anon;
grant usage on schema ipamonitor to authenticated;
grant select on ipamonitor.app, ipamonitor.siti, ipamonitor.controlli, ipamonitor.ultimo_stato to authenticated;
grant execute on function ipamonitor.autorizzato() to authenticated;

insert into ipamonitor.app (id, nome, repo, supabase_ref) values
  ('gymin',   'GymIN',   'loriscuba/GymIN',   'aprufgirtymgadzmzjbk'),
  ('beachin', 'BeachIn', 'loriscuba/BeachIn', 'exchjppslwhbnbzuhfqs')
on conflict (id) do nothing;

insert into ipamonitor.siti (app_id, nome, url) values
  ('beachin', 'GitHub Pages',     'https://loriscuba.github.io/BeachIn/'),
  ('beachin', 'Cloudflare Pages', 'https://beachin.pages.dev/')
on conflict (url) do nothing;

-- Pianificazione: raccolta ogni 10 minuti, pulizia dei controlli oltre 30 giorni.
-- Il segreto condiviso con la funzione sta nel Vault (`ipamonitor_cron_secret`), creato a parte.
create extension if not exists pg_cron;

select cron.schedule('ipamonitor-raccolta', '*/10 * * * *', $cron$
  select net.http_post(
    url     := 'https://exchjppslwhbnbzuhfqs.supabase.co/functions/v1/ipa-collect',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ipamonitor_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000);
$cron$);

select cron.schedule('ipamonitor-pulizia', '15 3 * * *',
  $cron$ delete from ipamonitor.controlli where creato_il < now() - interval '30 days' $cron$);
