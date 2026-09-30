# local-leads

Small SPA that allows users to find local business leads with lots of filters to choose from.

## Purpose

Local Leads is a lead-generation tool for freelancers. You type a locality (e.g. **Leiria**), pick the
kinds of businesses you care about, and the app lists the local shops and companies found there with the
data you would normally copy by hand from Google Maps: **name, phone/mobile, email, website and address**.

The filters are built around outreach: they let you quickly spot businesses **without a phone**, **without
a mobile number**, **without email**, **without a website** or **without any contact data at all** — the
ones most likely to need help with their online presence.

The long-term goal is to automate the outreach itself: select leads and send them emails built from
reusable templates to promote freelancing services. **This first version focuses on search and filtering;
email sending and templates are planned for a later phase.**

## Features

- Landing page with a scroll-driven parallax story: a 3D globe (d3-geo + world-atlas) spins to Portugal,
  zooms into Leiria and turns into a city map where leads drop in as pins.
- Search by locality with a configurable radius (1–20 km) and business categories.
- Two data sources:
  - **OpenStreetMap** (default, free, no API key) — geocoding via Nominatim, businesses via Overpass.
  - **Google Places API (New)** (optional) — enabled when an API key is set. Google does not expose emails.
- Filters: free text, business type, phone (with / without / without mobile), email, website and
  "without any contact data".
- Summary tiles that double as filter shortcuts.
- CSV export of the filtered leads.
- Reusable `<app-loader>` spinner (inline, block or overlay) for any list that loads data.
- English and Portuguese UI (`public/i18n/en.json`, `public/i18n/pt.json`).

## Getting started

```bash
npm ci
npm start        # http://localhost:4200
npm test         # unit tests (Vitest)
npm run build    # production build in dist/
```

To enable Google Places, set `googlePlacesApiKey` in `src/environments/environment.ts` and restrict the key
by HTTP referrer in the Google Cloud Console. Do not commit real keys.

## Project structure

```
src/app/
  app.routes.ts  # "/" landing page, "/search" lead finder (both lazy-loaded)
  components/<name>/<name>.component.{ts,html,scss}   # one folder per component
  models/        # Lead, search criteria, filters
  services/      # search state, geocoding, translations
    providers/   # data sources (OpenStreetMap, Google Places) behind a common interface
  pipes/         # translate pipe
  utils/         # pure helpers (filtering, phones, CSV)
public/i18n/     # translation files, same keys in every language
```

## Notes

- Data completeness depends on the source. OpenStreetMap often lacks phones/emails for small businesses;
  Google Places has better phone/website coverage but no emails.
- Respect each provider's usage policy and GDPR when contacting businesses.
