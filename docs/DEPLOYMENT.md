# Deploying the ITSM upgrade safely

The live app runs from `main`. The upgrade is developed on the `itsm` branch and reaches production
only when you merge it. Database changes go to a **staging** Supabase project first.

## Environment variables

| Variable | Where | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel *Production* | Production project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel *Production* | Production publishable (or anon) key |
| `NEXT_PUBLIC_SITE_URL` | Vercel *Production* | e.g. `https://techpilot.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel *Preview* | **Staging** project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel *Preview* | **Staging** publishable key |
| `NEXT_PUBLIC_SITE_URL` | Vercel *Preview* | Leave empty; the app uses the preview's own address |

No secret or service-role key is used anywhere. Email notifications (later phase) will add provider
variables, documented when that phase lands.

## One-time: set up staging

1. Create a second free Supabase project, e.g. `techpilot-staging`.
2. In its SQL Editor, run every file in `supabase/migrations/` **in filename order**.
3. In its **Authentication → URL Configuration**, add your preview URLs to Redirect URLs,
   e.g. `https://*-<your-vercel-account>.vercel.app/**` (Supabase accepts wildcards, which covers every preview).
4. In Vercel → Project → **Settings → Environment Variables**, add the two Supabase variables again,
   ticking only **Preview**, with the staging values. Keep the existing ones ticked for **Production**.
5. Push to `itsm` (or open the pull request). Vercel builds a preview connected to staging.

## Each phase: test on staging

1. Run the new migration file(s) on **staging** only.
2. Open the Vercel preview for the `itsm` branch and work through `docs/TESTING.md`.
3. Report anything odd before the next phase.

## Going live (when you approve the merge)

Order matters: **database first, then code.** Every migration is additive and the new database
works with the current live app, so there's no downtime window.

1. **Back up production.** Supabase → Database → Backups (paid plans), or locally:
   `pg_dump "<production connection string>" -Fc -f techpilot-before-itsm.dump`
   (connection string: Supabase → Connect → Session pooler).
2. In the **production** SQL Editor, run the new migration file(s) that staging already has, in order.
3. Quick check while still on the old app: sign in on the live site; your tasks, records and notes
   are all there.
4. Merge the pull request into `main`. Vercel deploys it automatically.
5. Sign in again and confirm the workspace switcher shows **Personal** with all your data.

## Rolling back

- **Code only:** in Vercel → Deployments, open the previous production deployment → **Promote to
  Production**. The upgraded database keeps working with the old app.
- **Database:** only if truly necessary, run the matching file in `supabase/rollbacks/` (read its
  warning first: it deletes data created in shared workspaces), or restore the backup from step 1.

## Migrations so far

| File | Phase | What it does | Rollback |
|---|---|---|---|
| `20261023000000_initial_schema.sql` | Original app | Tables, RLS, account deletion | — |
| `20261024000000_workspaces.sql` | 2 | Workspaces, members, roles, clients (basic), invitations, audit log; personal workspace per user; knowledge base and notes become workspace-aware | `supabase/rollbacks/20261024000000_workspaces_down.sql` |
