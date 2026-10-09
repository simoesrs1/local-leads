# local-leads

Small SPA that allows users to find local business leads with lots of filters to choose from.

## Purpose

Local Leads is a lead-generation tool for freelancers. You type a locality (e.g. **Leiria**), pick the
kinds of businesses you care about, and the app lists the local shops and companies found there with the
data you would normally copy by hand from Google Maps: **name, phone/mobile, email, website and address**.

The filters are built around outreach: they let you quickly spot businesses **without a phone**, **without
a mobile number**, **without email**, **without a website** or **without any contact data at all** — the
ones most likely to need help with their online presence.

It also automates the outreach itself: select leads in the results grid and send them personalised emails
built from reusable templates to promote your freelancing services, with a **test mode** that redirects
every email to your own inbox so you can check everything first.

## Features

- Landing page with a scroll-driven parallax story: a 3D globe (d3-geo + world-atlas) spins to Portugal,
  zooms into the visitor's location (browser geolocation, if allowed; Leiria otherwise) and turns into a
  city map where leads drop in as pins.
- Search by locality with a configurable radius (1–20 km) and business categories.
- Two data sources:
  - **OpenStreetMap** (default, free, no API key) — geocoding via Nominatim, businesses via Overpass.
  - **Google Places API (New)** (optional) — enabled when an API key is set. Google does not expose emails.
- Filters: free text, business type, phone (with / without / without mobile), email, website and
  "without any contact data".
- Summary tiles that double as filter shortcuts.
- CSV export of the filtered leads.
- **Bulk email with templates**:
  - multi-select leads in the results grid and send them all one email each, with progress and a stop button;
  - templates with placeholders such as `{{nome_cliente}}`, edited with a live preview;
  - a variables window where each label ("Nome Cliente" → `{{nome_cliente}}`) is bound to a lead field
    (name, type, email, phone, website, address, searched locality) or to a fixed text;
  - settings page for the SMTP account (presets for Gmail / Microsoft 365, connection test);
  - **test mode** (on by default): every email goes to your own address with a `[TESTE]` subject.
    It is enforced by the server, so the browser cannot bypass it.
- Reusable `<app-loader>` spinner (inline, block or overlay) for any list that loads data.
- English and Portuguese UI (`public/i18n/en.json`, `public/i18n/pt.json`).

## Getting started

```bash
npm ci
npm run dev           # email server (port 3000) + Angular app on http://localhost:4200
npm start             # Angular app only (search works, email features need the server)
npm run server        # email server only
npm test              # Angular unit tests (Vitest)
npm run test:server   # email server tests (node:test)
npm run build         # production build in dist/
```

### Email server

Browsers cannot talk SMTP, and the email password must not live in the front end, so emails are sent by a
small Node server in `server/` (Express + Nodemailer). `ng serve` proxies `/api` to it (`proxy.conf.json`).

- It listens on `127.0.0.1` only, so the credentials are not reachable from the network.
- Settings, templates and variables are stored as JSON in `server/data/` (git-ignored). The settings
  file is written with `0600` permissions and the password is never sent back to the browser.
- For Gmail, enable 2-step verification and create an **app password**; use it instead of your normal
  password.

To enable Google Places, set `googlePlacesApiKey` in `src/environments/environment.ts` and restrict the key
by HTTP referrer in the Google Cloud Console. Do not commit real keys.

## Project structure

```
src/app/
  app.routes.ts  # "/" landing, "/search" lead finder, "/templates", "/settings" (lazy-loaded)
  components/<name>/<name>.component.{ts,html,scss}   # one folder per component
  models/        # Lead, search criteria, filters, email types (shared with server/)
  services/      # search state, geocoding, translations
    providers/   # data sources (OpenStreetMap, Google Places) behind a common interface
  pipes/         # translate pipe
  utils/         # pure helpers (filtering, phones, CSV, template rendering)
public/i18n/     # translation files, same keys in every language
server/          # email API: settings, templates, variables, sending (test mode enforced here)
```

## Notes

- Data completeness depends on the source. OpenStreetMap often lacks phones/emails for small businesses;
  Google Places has better phone/website coverage but no emails.
- Respect each provider's usage policy and GDPR when contacting businesses: keep an opt-out line in your
  templates (the default one has it) and send in small batches — the app waits 1.5 s between emails.
