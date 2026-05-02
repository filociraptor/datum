# Datum

A production-ready PWA task manager built for civil engineers. Manage projects, track tasks, store project links (drawings, specs, permits), and stay on top of contacts — all in a fast, offline-capable app.

## Tech stack

- **Vite + React + TypeScript** — fast build, strict types
- **Tailwind CSS** — utility-first styling
- **Supabase** — Postgres database, row-level security, magic-link auth
- **vite-plugin-pwa** — service worker, offline support, installable
- **Vercel** — zero-config deployment

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Copy **Project URL** and **anon public key** from *Settings → API*

### 3. Fill in environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Run the database migration

```bash
# If you have the Supabase CLI installed:
supabase login
supabase link --project-ref <your-project-ref>
supabase db push

# Or paste supabase/migrations/20240101000000_initial.sql
# directly into the Supabase SQL editor.
```

### 5. Configure magic-link redirect URL

In Supabase Dashboard → *Authentication → URL Configuration*:

- **Site URL**: `https://your-vercel-domain.vercel.app` (or `http://localhost:5173` for local dev)
- **Redirect URLs**: add `https://your-vercel-domain.vercel.app/**`

### 6. Add PWA icons

Place two PNG files in `public/`:

| File | Size |
|------|------|
| `icon-192.png` | 192×192 px |
| `icon-512.png` | 512×512 px |

The `public/icon.svg` file is the source — convert it with ImageMagick, Inkscape, or any online SVG→PNG tool.

### 7. Run locally

```bash
npm run dev
```

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in *Vercel → Settings → Environment Variables*.

---

## Database schema

| Table | Description |
|-------|-------------|
| `projects` | Civil engineering projects with client and contact |
| `contacts` | People associated with projects |
| `project_links` | URLs, drawings, specs, permit links |
| `tasks` | Actionable items with due dates, estimates, and waiting-on tracking |

All tables are protected by Postgres row-level security — users can only access their own rows.
