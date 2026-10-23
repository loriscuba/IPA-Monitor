-- 0004: link utili per progetto (hosting, deploy, pannelli esterni) mostrati nella pagina Monitoring.
-- GitHub, Supabase Cloud e siti controllati sono ricavati dall'app: qui solo quello che non si può dedurre.
create table if not exists ipamonitor.link (
  id      bigint generated always as identity primary key,
  app_id  text not null references ipamonitor.app(id) on delete cascade,
  gruppo  text not null,                   -- es. 'Hosting e deploy'
  nome    text not null,
  url     text not null,
  ordine  int not null default 0,
  unique (app_id, url)
);

alter table ipamonitor.link enable row level security;
create policy lettura on ipamonitor.link for select to authenticated using (ipamonitor.autorizzato());
revoke all on ipamonitor.link from public, anon;
grant select on ipamonitor.link to authenticated;

insert into ipamonitor.link (app_id, gruppo, nome, url, ordine) values
  ('beachin', 'Hosting e deploy', 'Produzione (VM Oracle)',          'https://158-178-144-127.sslip.io',                                   10),
  ('beachin', 'Hosting e deploy', 'API Supabase produzione',         'https://api-141-148-241-169.sslip.io',                               20),
  ('beachin', 'Hosting e deploy', 'Cloudflare Pages',                'https://dash.cloudflare.com/?to=/:account/pages/view/beachin',       30),
  ('beachin', 'Hosting e deploy', 'Workflow Deploy produzione',      'https://github.com/loriscuba/BeachIn/actions/workflows/deploy.yml',  40),
  ('beachin', 'Hosting e deploy', 'Workflow Rollback',               'https://github.com/loriscuba/BeachIn/actions/workflows/rollback.yml', 50),
  ('beachin', 'Hosting e deploy', 'Vercel (anteprime branch)',       'https://vercel.com/dashboard',                                       60),
  ('beachin', 'Hosting e deploy', 'Oracle Cloud',                    'https://cloud.oracle.com/compute/instances',                         70),
  ('gymin',   'Hosting e deploy', 'Workflow Backup DB',              'https://github.com/loriscuba/GymIN/actions/workflows/backup-db.yml', 10),
  ('gymin',   'Hosting e deploy', 'Workflow Test deploy',            'https://github.com/loriscuba/GymIN/actions/workflows/test-deploy.yml', 20),
  ('gymin',   'Hosting e deploy', 'Oracle Cloud',                    'https://cloud.oracle.com/compute/instances',                         30)
on conflict (app_id, url) do nothing;
