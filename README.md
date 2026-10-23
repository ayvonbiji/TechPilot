# IT Engineer Companion

A private, long-term work organiser and technical learning platform for IT support work.
Plan tasks, document troubleshooting from symptoms to verified fix, keep a command library,
write a daily work log, generate honest daily and weekly reports, and track the skills and
certifications on your path into networking, systems administration, cloud and security.

Everything you save belongs to your account alone, enforced by Row Level Security in the database.

## Features

| Area | What you can do |
|---|---|
| **Dashboard** | Greeting and date, tasks due today and overdue, pending/in-progress/completed counts, 7-day productivity chart, recent troubleshooting, skills in progress, quick actions. All figures come from your saved data. |
| **My tasks** | Create, edit, delete; priority and status; due dates with overdue highlighting; one-click complete; search, filter by status/priority/due/category, five sort orders; completion notes and statistics. |
| **Troubleshooting** | Knowledge base across 11 categories with symptoms, causes, diagnostic steps, commands, solution, verification, lessons and tags. Seven templates. Privacy confirmation before saving. Full-text search plus exact matching for command switches like `/flushdns`. Copy as Markdown. |
| **Notes & commands** | Markdown notebook with write/preview, code blocks with copy buttons, categories, tags, favourites and search. One-click import of reference notes for `ipconfig`, `ping`, `tracert`, `nslookup`, `netstat`, `sfc /scannow`, `DISM` and PowerShell basics, each with purpose, examples and precautions. Nothing is ever executed. |
| **Work log** | One entry per day covering tasks, problems, outcomes, skills, challenges, follow-ups and reflections. Month calendar with logged-day lights and a chronological history. Search across all entries. |
| **Reports** | Daily and weekly summaries built only from saved tasks, logs and records; empty sections say "Nothing recorded". Weekly statistics and per-day breakdown. Preview, edit, reset, copy, download as Markdown, print, and export tasks as CSV. |
| **Learning tracker** | Skills and certifications across a 10-stage roadmap with current and target proficiency (0–5), status, notes, resources and completion date. Overall and per-stage progress. |
| **Resources** | Bookmarks by category with notes. Optional set of seven recommended links (each verified to exist). |
| **Settings** | Display name, theme (light/dark/system), time zone, date and time formats, password change, demo data load/remove, full JSON export, backup guidance, sign out, account deletion. |

## Tech stack

Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui-style components on Radix,
Supabase (PostgreSQL, Auth, RLS), Zod, Recharts and Vercel.

Architecture, folder structure and the full database schema are in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com). Choose a strong database password and a region near you.
2. Open **SQL Editor → New query**, paste the whole of
   [`supabase/migrations/20261023000000_initial_schema.sql`](supabase/migrations/20261023000000_initial_schema.sql)
   and click **Run**. This creates all tables, indexes, triggers, Row Level Security policies
   and the account-deletion function.
   - Using the Supabase CLI instead? `supabase link --project-ref <ref>` then `supabase db push`.
3. Open **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` for now (change it to your Vercel URL after deploying).
   - **Redirect URLs**: add `http://localhost:3000/auth/confirm` (and later `https://<your-app>.vercel.app/auth/confirm`).
4. **Authentication → Sign In / Providers → Email**: leave email enabled. "Confirm email" is recommended;
   the app supports both settings. Supabase's built-in mailer is rate-limited, so for regular use add
   your own SMTP provider under **Authentication → Emails → SMTP Settings**.
5. Open **Project Settings → API keys** (or the **Connect** button) and copy:
   - the **Project URL**
   - the **publishable key** (`sb_publishable_…`), or the legacy **anon** public key on older projects.

   Never copy the secret / service-role key into this app — it doesn't need one.

## 2. Run locally

Requires **Node.js 20.9 or newer** (22 recommended).

```bash
git clone https://github.com/ayvonbiji/TechPilot.git
cd TechPilot
npm install
cp .env.example .env.local     # then edit .env.local
npm run dev
```

`.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Open <http://localhost:3000>, create an account, and confirm it from the email if confirmation is on.
Open the confirmation link **in the same browser** you signed up in. To explore with sample content,
go to **Settings → Demo data → Load demo data**; every demo item is marked "Demo" and can be removed in one click.

If the variables are missing, the app shows a setup page instead of failing.

## 3. Deploy to Vercel

1. Push the repository to GitHub (already done if you're reading this there).
2. In [Vercel](https://vercel.com/new), **Import** the repository. The Next.js preset is detected automatically.
3. Under **Environment Variables**, add the three variables above, with `NEXT_PUBLIC_SITE_URL` set to your
   production URL, e.g. `https://techpilot.vercel.app`.
4. Click **Deploy**.
5. Back in Supabase **Authentication → URL Configuration**, set **Site URL** to the production URL and add
   `https://<your-app>.vercel.app/auth/confirm` to **Redirect URLs**.
6. Sign up on the live site and run through the [testing checklist](docs/TESTING.md#manual-testing-checklist).

Changing an environment variable on Vercel requires a redeploy to take effect.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit tests (dates and time zones, report building, CSV safety, validation) |
| `npm run test:rls` | Applies the migration to a throwaway database on a local PostgreSQL and runs the RLS isolation tests. Set `PGHOST`, `PGPORT`, `PGUSER` first. |

## Security model

- Every table has RLS enabled with owner-only policies; anonymous visitors have no table access.
  Isolation is tested in [`supabase/tests/rls_test.sql`](supabase/tests/rls_test.sql).
- Authorisation is checked three times: the proxy (`src/proxy.ts`) redirects signed-out visitors,
  pages and Server Actions verify the user again, and Postgres RLS enforces ownership.
- The app uses only the publishable key. Account deletion runs through a `security definer`
  SQL function that can delete only the caller's own account.
- Inputs are validated with the same Zod schemas in the browser and in Server Actions, and again by
  database `CHECK` constraints.
- Passwords are handled entirely by Supabase Auth; none are stored in application tables.
- Markdown is rendered without raw HTML; bookmark URLs must be `http(s)`; CSV exports are protected
  against spreadsheet formula injection.

## Privacy and responsible use

This is a personal learning and productivity tool, not a company ticketing system. It has no company
integrations and never runs commands. Troubleshooting and work-log forms remind you not to store
confidential company or customer information, credentials, internal IP addresses or employee details.
Describe problems in general terms so the knowledge stays yours to keep.

## Backups

Use **Settings → Export all data** for a complete JSON copy. Export monthly and before changing jobs or
devices, and keep exports somewhere private. Paid Supabase plans also include automatic daily backups.

## Troubleshooting setup

| Symptom | Fix |
|---|---|
| Setup page keeps appearing | `.env.local` is missing or misnamed; restart `npm run dev` after editing. On Vercel, add the variables and redeploy. |
| "That link didn't work" after clicking an email | The link expired or was already used, or was opened in a different browser. Request a new one. Check the redirect URL is listed in Supabase. |
| Pages load but show "couldn't be loaded" | The SQL migration hasn't been run on this project, or the URL/key point to a different project. |
| Account deletion fails | Re-run the migration so `delete_own_account()` exists. |
