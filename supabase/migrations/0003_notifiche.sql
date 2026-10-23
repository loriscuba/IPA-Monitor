-- Notifiche push delle criticità sull'app IPA Monitor installata (Web Push, standard del browser).
-- Le chiavi VAPID le crea il collettore al primo avvio: la privata in Vault ('ipamonitor_vapid'),
-- la pubblica in ipamonitor.impostazioni, letta dall'app per iscriversi.

create table if not exists ipamonitor.impostazioni (
  chiave text primary key,
  valore text not null
);

-- Un dispositivo iscritto alle notifiche. benvenuto_il null = notifica di prova ancora da mandare.
create table if not exists ipamonitor.iscrizioni_push (
  endpoint      text primary key,
  p256dh        text not null,
  auth          text not null,
  email         text not null default (auth.jwt() ->> 'email'),
  dispositivo   text,
  creato_il     timestamptz not null default now(),
  benvenuto_il  timestamptz
);

-- Criticità aperte: un controllo KO per due raccolte di fila genera la notifica, il ritorno a OK la chiude.
create table if not exists ipamonitor.avvisi (
  app_id       text not null,
  tipo         text not null,
  oggetto      text not null,
  aperto_il    timestamptz not null default now(),
  notificato   boolean not null default false,
  primary key (app_id, tipo, oggetto)
);

alter table ipamonitor.impostazioni    enable row level security;
alter table ipamonitor.iscrizioni_push enable row level security;
alter table ipamonitor.avvisi          enable row level security;

create policy lettura on ipamonitor.impostazioni for select to authenticated using (ipamonitor.autorizzato());
create policy lettura on ipamonitor.avvisi       for select to authenticated using (ipamonitor.autorizzato());
create policy proprie on ipamonitor.iscrizioni_push for all to authenticated
  using (ipamonitor.autorizzato() and email = auth.jwt() ->> 'email')
  with check (ipamonitor.autorizzato() and email = auth.jwt() ->> 'email');

revoke all on ipamonitor.impostazioni, ipamonitor.iscrizioni_push, ipamonitor.avvisi from public, anon, authenticated;
grant select on ipamonitor.impostazioni, ipamonitor.avvisi to authenticated;
grant select, insert, update, delete on ipamonitor.iscrizioni_push to authenticated;
