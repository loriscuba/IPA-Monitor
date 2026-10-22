# IPA Monitor

Cruscotto che monitora le attività delle mie applicazioni web.

## Obiettivo

Raccogliere in un unico posto lo stato e l'attività delle app web, ad esempio:

- **GymIN**
- **BeachIn**

## Cosa monitorare (prima bozza)

- Disponibilità dei deploy (GitHub Pages, Cloudflare Pages, Vercel, produzione)
- Ultimi deploy e stato dei workflow GitHub Actions
- Pull request e commit recenti per ogni repository
- Attività del database (Supabase) e delle Edge Function

## Parte web

React + Vite + TypeScript, Supabase JS. Legge solo lo schema `ipamonitor` del progetto **Demo IPA**
(chiave pubblicabile; i dati degli altri progetti li scrive il collettore `ipa-collect`).
Accesso con email e password, consentito solo alle email in `ipamonitor.utenti`.

- **Dashboard** (`#/`): una card per progetto con stato, web, database, deploy, PR aperte ed errori.
- **Monitoring** (`#/progetto/<id>`): parte web (siti con latenza e disponibilità 24 h, workflow)
  e database (servizi Supabase, Edge Function, metriche dell'app).

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
```

Prerequisiti su Demo IPA: `ipamonitor` tra gli *Exposed schemas* (Settings → Data API).
Pubblicazione: GitHub Pages da `.github/workflows/pages.yml` (Settings → Pages → Source: GitHub Actions).
