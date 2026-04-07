# FYI News Release System — Setup Guide

This project is a **React (Vite)** frontend with a **Node/Express** backend for fact-checking (OpenAI, Hugging Face, **NewsData.io**, optional Supabase pgvector). Follow the steps in order.

---

## 1. Prerequisites

1. Install **[Node.js](https://nodejs.org/)** (LTS recommended; includes `npm`).
2. Clone or download this repository and open a terminal in the project root folder.

---

## 2. Install dependencies

From the **project root**:

```bash
npm install
```

The backend has its own dependencies. Install them once:

```bash
cd backend
npm install
cd ..
```

---

## 3. Frontend environment (Supabase auth & data)

The app uses **Supabase** in the browser for authentication and articles. You need the **anon** key (safe for the client — never put the service role key in `VITE_*` variables).

1. Create a free project at **[Supabase](https://supabase.com/dashboard)** (sign up / sign in).
2. Open **Project Settings → API**: [Supabase API settings](https://supabase.com/dashboard/project/_/settings/api).
3. Copy:
   - **Project URL**
   - **anon public** key

4. In the **project root**, copy the example env file and edit it:

```bash
copy .env.example .env
```

(On macOS/Linux: `cp .env.example .env`.)

5. Set in `.env`:

| Variable | Where to get it |
|----------|-----------------|
| `VITE_SUPABASE_URL` | Supabase **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon public** key |

---

## 4. Backend environment (API keys & server)

The Express server loads secrets from **`backend/.env`** (not committed to git).

1. Copy the backend example:

```bash
copy backend\.env.example backend\.env
```

(On macOS/Linux: `cp backend/.env.example backend/.env`.)

2. Set **`PORT=10000`** (or another port; Vite’s dev proxy expects `10000` by default — see `vite.config.ts`).

3. Fill in the keys you need (see table below).

### Where to get each API key

| Purpose | Environment variable | Get your key |
|--------|----------------------|--------------|
| **Supabase** (server-side DB, optional list articles & pgvector RPC) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | [Supabase Dashboard → Project Settings → API](https://supabase.com/dashboard/project/_/settings/api) — use **service_role** only on the server, never in the frontend. |
| **OpenAI** (fact-check with **GPT-4o mini**, optional claim fallback, embeddings for pgvector rerank) | `OPENAI_API_KEY` | [OpenAI API keys](https://platform.openai.com/api-keys) |
| **Hugging Face** (preferred **claim extraction** via Inference API) | `HF_TOKEN` or `HUGGINGFACE_API_KEY` | [Hugging Face — Access Tokens](https://huggingface.co/settings/tokens) |
| **NewsData.io** (**real-world news** evidence search for fact-checking) | `NEWSDATA_API_KEY` | [NewsData.io — dashboard / API key](https://newsdata.io/) · [Documentation](https://newsdata.io/documentation) |

**Notes:**

- **Claim extraction** order: Hugging Face first (if `HF_TOKEN` is set), then OpenAI, then a local skeleton.
- **Fact-check reasoning** uses OpenAI when `OPENAI_API_KEY` is set (`OPENAI_FACTCHECK_MODEL` defaults to `gpt-4o-mini`).
- Without `NEWSDATA_API_KEY`, evidence search uses Google News RSS; add a key for NewsData.io-backed retrieval.

---

## 5. Optional: pgvector in Supabase

To let the backend retrieve **similar text chunks** from your database (see `backend/db/pgvector.sql`):

1. In Supabase, open **SQL Editor**: [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql).
2. Paste and run the contents of **`backend/db/pgvector.sql`** (adjust `vector(1536)` if you change embedding model/dimensions).
3. In **`backend/.env`**, set:

   - `PGVECTOR_MATCH_RPC=match_document_chunks`
   - Optionally `PGVECTOR_EMBEDDING_DIM=1536` (must match your embedding vectors, e.g. OpenAI `text-embedding-3-small`).

---

## 6. Run the app

### Development (frontend + hot reload)

Terminal 1 — API server (from project root):

```bash
npm start
```

Terminal 2 — Vite dev server (proxies `/api` to the backend — see `vite.config.ts`):

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Production-style (single process serving built UI)

```bash
npm run build
npm start
```

Then open `http://localhost:10000` (or your `PORT`).

---

## 7. Quick API check

With the server running:

```bash
curl http://localhost:10000/api/health
```

You should see `{"ok":true}`.

---

## 8. Summary checklist

- [ ] `npm install` in project root **and** `backend/`
- [ ] Root `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] `backend/.env` with **NewsData.io**, **OpenAI**, and/or **Hugging Face** (depending on features you want)
- [ ] Optional: **Supabase service role** + optional **pgvector** SQL
- [ ] `npm start` + `npm run dev` for local development

For variable names and defaults, see **`backend/.env.example`**.
