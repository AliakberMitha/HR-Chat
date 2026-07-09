# HR Talent Chat

An admin uploads an HR Excel export once; everyone else opens the chat link and asks questions
against it in a ChatGPT-style interface, to find the right person for the right task. Runs on
Vercel with only two small serverless functions for admin auth + publishing — everything else
(Excel parsing, search indexing, the Gemini calls) happens in the browser.

## How it works

1. **Upload page** (`/`) — admin-only (password gated). Drop an `.xlsx`/`.xls` file; it's parsed
   in a Web Worker (so the UI never freezes), then gzip-compressed and uploaded directly from the
   browser to **Vercel Blob** storage (bypassing serverless function size limits, since HR exports
   can be tens of MB). A small "pointer" record (blob URL + row/column counts) is then published
   so every user's chat page knows where the current dataset lives.
2. **Chat page** (`/chat`) — open to anyone with the link, no login. On load it fetches the
   published dataset (downloading + decompressing it once, then caching in IndexedDB so repeat
   visits are instant unless the admin publishes a newer file). Each question is first matched
   locally against a full-text search index built over the data to pull the ~60 most relevant
   records — this is what makes it scale to 190k+ rows without blowing past an LLM context window.
   Those matched records, plus your question, are sent to the Gemini API, which streams back an
   answer. Click **Show details** under any answer to see exactly which records were used.

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
- **A Vercel Blob store**, linked to this project (needed for both local dev and deployment):
  1. Push this repo to a Vercel project (`vercel link` if you haven't deployed yet).
  2. In the Vercel dashboard → your project → **Storage** → **Create Database** → **Blob**.
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

This architecture is Vercel-specific (Vercel Blob + Vercel Functions). Porting to Netlify would
mean swapping `@vercel/blob` for Netlify Blobs and rewriting the three `/api` functions as Netlify
Functions — the client-side app wouldn't need to change.

### ⚠️ About the Gemini API key

`VITE_GEMINI_API_KEY` is baked into the JavaScript bundle at build time and is visible to anyone
who opens browser dev tools on the deployed site — the chat calls Gemini directly from the browser
with no backend proxy. To limit exposure, restrict the key by **HTTP referrer** to your deployed
domain in Google AI Studio.

## Access control

- **Upload page:** gated by `ADMIN_PASSWORD`, checked server-side in `/api/admin-login`. On
  success the browser gets a signed, 12-hour session token (`sessionStorage`) that's required by
  the two publish endpoints. This is a shared-passphrase gate, not real per-user accounts — fine
  for "one admin/small ops team," not a substitute for proper auth if you need named users or
  audit trails.
- **Chat page:** open to anyone with the URL. There's no per-user login, so treat the deployed URL
  as internal-only (e.g. shared within Head Office) rather than public, since the dataset itself is
  sensitive HR data.

## Data & privacy notes

- `Mobile` and `Email` columns are deliberately excluded from what's sent to Gemini — they're
  only ever shown locally in the **Show details** table.
- The published dataset blob is stored with `access: 'public'` in Vercel Blob (required so every
  user's browser can fetch it directly) — its URL is unguessable but not access-controlled, so
  don't rely on it as a secrecy boundary beyond "not indexed/linked publicly."
- Each browser caches the last-downloaded dataset in IndexedDB to avoid re-downloading on every
  visit; it's compared against the published version's timestamp and refreshed automatically when
  the admin publishes a new file.

## Tech stack

React + TypeScript + Vite, Tailwind CSS v4, Framer Motion, SheetJS (`xlsx`, patched build from the
SheetJS CDN — the npm-published `xlsx` package has unpatched CVEs), FlexSearch for in-browser
full-text search, Zustand for UI state, idb-keyval for IndexedDB caching, react-markdown for
rendering answers, `@vercel/blob` for shared dataset storage, and three Vercel serverless functions
(`api/admin-login.ts`, `api/dataset-upload.ts`, `api/dataset-set-current.ts`, `api/dataset.ts`) for
admin auth and publishing.
