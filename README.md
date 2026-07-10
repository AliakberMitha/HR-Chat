# HR Talent Chat

An admin uploads an HR Excel export once; everyone else opens the chat link and asks questions
against it in a ChatGPT-style interface — including precise counts, ratios, breakdowns, and
averages, not just "find me a person" style search. Runs on Vercel with a handful of small
serverless functions for admin auth + publishing — Excel parsing, search indexing, and the
per-question exact computation all happen in the browser.

## How it works

1. **Upload page** (`/`) — admin-only (password gated). Drop an `.xlsx`/`.xls` file; it's parsed
   in a Web Worker (so the UI never freezes), then gzip-compressed and uploaded in ~1MB chunks to
   our own `/api/dataset-upload-chunk` (same-origin, using the server-side Blob SDK directly — no
   client tokens, no cross-origin requests). A small "pointer" record (chunk URLs + counts) is then
   published so every user's chat page knows where the current dataset lives.
2. **Person-centric data model** — the source Excel has one row per (person × organizational-role)
   combination, since a person can hold several Umoor/Team/Level assignments at once. On upload,
   rows are grouped by ITSID into one profile per person, with their static attributes (skills,
   badges, feedback scores, etc.) taken once and their multiple role assignments collected into a
   list. This is what makes "how many people..." questions come out correct instead of
   over-counting anyone with more than one role.
3. **Chat page** (`/chat`) — open to anyone with the link, no login. On load it downloads the
   published dataset chunks and rebuilds the person profiles (caching in IndexedDB so repeat visits
   are instant unless the admin publishes a newer file). Each question goes through two Gemini
   calls:
   - **Query planning** — a small, cheap call classifies the question's intent (count / breakdown /
     average / find-a-person) and extracts keywords, filters, a group-by field, or a metric field,
     as strict JSON (Gemini's structured-output / JSON-schema mode).
   - **Local exact execution** — that plan is run directly against the full in-memory dataset
     (linear scan, no sampling) to get an exact total count, group breakdown, or average — this is
     the part that makes numeric answers trustworthy rather than an LLM eyeballing a sample.
   - **Answer generation** — the exact numbers, plus a relevant sample of individual records (either
     a full-text-search-ranked sample for "find the best person" questions, or a plain filtered
     sample for count/breakdown/average questions), are sent to Gemini to phrase the final streamed
     answer. Click **Show details** under any answer to see the exact totals/breakdown and which
     records were used.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values below
```

You'll need:

- **`VITE_GEMINI_API_KEY`** — from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
- **`ADMIN_PASSWORD`** — whatever passphrase admins should use to sign in on the upload page.
- **`ADMIN_SESSION_SECRET`** — a random string for signing admin session tokens:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **A Vercel Blob store**, linked to this project, created with **Public** access (private stores
  can't deliver blobs via direct URL, which the chat page relies on — access mode can't be changed
  after creation, so if you picked Private by mistake you'll need to delete and recreate the store):
  1. Push this repo to a Vercel project (`vercel link` if you haven't deployed yet).
  2. In the Vercel dashboard → your project → **Storage** → **Create Database** → **Blob** → Public.
  3. Run `vercel env pull .env.local` — this adds `BLOB_READ_WRITE_TOKEN` automatically.

Then run the full app (frontend + the `/api` functions) locally with:

```bash
npm run dev:full
```

(`npm run dev` alone only starts the Vite frontend — the upload/chat data-fetching calls hit
`/api/*`, which only `vercel dev` serves locally.)

## Deploying to Vercel

- **Framework:** auto-detected (Vite). **Build command:** `npm run build`. **Output:** `dist`.
- Add `VITE_GEMINI_API_KEY`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` as Environment Variables
  in the project dashboard (`BLOB_READ_WRITE_TOKEN` is added automatically when you create the
  Blob store above). Redeploy after adding them.
- Routing uses a hash router (`/#/chat`), so no rewrite rules are needed.
- **Vercel's GitHub integration must have access to this repo** (Project → Settings → Git). If it
  was set up against a different/auto-created repo, pushes here won't trigger deploys — reconnect
  it under Settings → Git, granting the GitHub App access to this repo if prompted.

This architecture is Vercel-specific (Vercel Blob + Vercel Functions). Porting to Netlify would
mean swapping `@vercel/blob` for Netlify Blobs and rewriting the `/api` functions as Netlify
Functions — the client-side app wouldn't need to change.

### ⚠️ About the Gemini API key

`VITE_GEMINI_API_KEY` is baked into the JavaScript bundle at build time and is visible to anyone
who opens browser dev tools on the deployed site — the chat calls Gemini directly from the browser
with no backend proxy. To limit exposure, restrict the key by **HTTP referrer** to your deployed
domain in Google AI Studio.

## Access control

- **Upload page:** gated by `ADMIN_PASSWORD`, checked server-side in `/api/admin-login`. On
  success the browser gets a signed, 12-hour session token (`sessionStorage`) that's required by
  the publish endpoints. This is a shared-passphrase gate, not real per-user accounts — fine for
  "one admin/small ops team," not a substitute for proper auth if you need named users or audit
  trails.
- **Chat page:** open to anyone with the URL. There's no per-user login, so treat the deployed URL
  as internal-only (e.g. shared within Head Office) rather than public, since the dataset itself is
  sensitive HR data.

## Data & privacy notes

- `Mobile` and `Email` columns are deliberately excluded from what's sent to Gemini — they're
  only ever shown locally in the **Show details** table.
- The dataset chunk blobs are stored with `access: 'public'` in Vercel Blob (required so every
  user's browser can fetch them directly) — their URLs are unguessable but not access-controlled,
  so don't rely on that as a secrecy boundary beyond "not indexed/linked publicly."
- Each browser caches the last-downloaded dataset in IndexedDB to avoid re-downloading on every
  visit; it's compared against the published version's timestamp and refreshed automatically when
  the admin publishes a new file.

## Tech stack

React + TypeScript + Vite, Tailwind CSS v4, Framer Motion, SheetJS (`xlsx`, patched build from the
SheetJS CDN — the npm-published `xlsx` package has unpatched CVEs), FlexSearch for in-browser
full-text search, Zustand for UI state, idb-keyval for IndexedDB caching, react-markdown for
rendering answers, `@vercel/blob` for shared dataset storage, and four Vercel serverless functions
(`api/admin-login.ts`, `api/dataset-upload-chunk.ts`, `api/dataset-set-current.ts`,
`api/dataset.ts`) for admin auth and publishing.
