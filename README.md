# KADACKAL IT Support Solutions

*Support, solve, grow together.*

An IT service desk and personal workspace in one. Run support for multiple client organisations with
tickets, SLAs, a customer portal, a shared knowledge base and reports, and keep your own tasks, work
log, notes and learning plan in a private workspace that stays yours when you change jobs.

Every workspace's data is separated in the database by Row Level Security, not just hidden in the
interface. Customers only ever see their own organisation's requests and never internal notes.

## Features

**Service desk** (freelance and organisation workspaces)

| Area | What you can do |
|---|---|
| **Dashboard** | Greeting and quick actions (new ticket, add client, write article); cards for open, overdue, resolved and active clients with real 7-day comparisons; recent tickets; ticket-status ring; upcoming SLA deadlines; recent activity. Plus a live queue (open, in progress, waiting, overdue, due soon, resolved, closed), created/resolved trend, averages and SLA compliance for a date range, your assigned tickets, recent activity. Filter by client, technician and status. All figures come from saved tickets. |
| **Tickets** | Numbered per workspace (`NW-00001`). Table and Kanban board, search, filters, sorting, pagination, views for mine/unassigned/due soon/overdue. Detail page with public replies and staff-only internal notes, full history, assignment, priority, status workflow enforced by the database, resolution summary, linked knowledge article, printable. |
| **Clients** | Organisation profiles, primary contact, service settings, portal accounts, assigned technicians, per-client SLA overrides, deactivation. |
| **Customer portal** | Separate branded interface: raise requests, see the organisation's requests, reply, read resolutions and Public help articles, get updates. |
| **Knowledge base** | Articles with summary, problem, symptoms, causes, diagnosis, solution and verification. Private, Team or Public. Draft an article straight from a resolved ticket. |
| **Reports** | Created vs resolved (daily/weekly/monthly), first-response and resolution averages, SLA compliance, by priority, category, technician and client. CSV export and print/PDF. |
| **SLA** | Response and resolution targets per priority with client overrides. Due-soon and overdue alerts. Deadlines are calendar time (24×7) and are labelled as such. |
| **Notifications** | In-app centre with unread counts for assignments, replies, status and priority changes, SLA warnings and breaches. No duplicates. (No email in this version.) |
| **Automation** | Assign or notify by category and priority when tickets are created. |
| **Team** | Invite technicians and admins, change roles, see workload. Every membership, client, SLA and automation change is in the activity log. |

**Personal workspace**: tasks, daily work log, work summaries, notes and command library, learning and
certification tracker, bookmarks, and your own tickets and knowledge base.

**Roles**: Platform owner (granted in SQL), workspace owner and administrator, technician, customer.
Each sees only the menu items and data their role allows, enforced on the server and in the database.

Not included in this release: billing and invoicing, IT asset inventory, email notifications.

## Tech stack

Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui-style components on Radix,
Supabase (PostgreSQL, Auth, RLS), Zod, Recharts and Vercel.

Architecture, folder structure and the full database schema are in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com). Choose a strong database password and a region near you.
2. Open **SQL Editor → New query** and run each file in [`supabase/migrations/`](supabase/migrations/)
   **in filename order**, one at a time. This creates all tables, indexes, triggers and Row Level Security
   policies. Upgrading an existing installation? See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) first.
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
cd TechPilot   # the repository keeps its original name
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
   production URL, e.g. `https://kadackal.vercel.app`.
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
| `npm test` | Unit tests: ticket workflow, SLA states, service metrics, dates and time zones, reports, CSV safety, validation |
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

The personal workspace is a learning and productivity space that stays yours; the service desk is for
the organisations you support. The app has no employer-specific integrations and never runs commands. Troubleshooting and work-log forms remind you not to store
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
