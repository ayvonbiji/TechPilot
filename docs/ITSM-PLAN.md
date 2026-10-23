# TechPilot ITSM upgrade — Phase 1: inspection and plan

## 1. What exists today (inspected on `main`, commit 387438b)

**Stack:** Next.js 16 App Router, Server Actions with Zod validation, Supabase Auth via `@supabase/ssr`
(session refreshed in `src/proxy.ts`), Supabase Postgres, Tailwind v4, Radix components, Recharts.
No service-role key anywhere; account deletion uses a `security definer` function.

**Data model: single-owner.** Seven tables, each row owned by one user:

| Table | Ownership | RLS |
|---|---|---|
| `profiles` | `id = auth.users.id` | own row only |
| `tasks`, `troubleshooting_records`, `notes`, `work_logs`, `skills`, `bookmarks` | `user_id` | `auth.uid() = user_id` for all four operations |

**Routes:** `/dashboard`, `/tasks`, `/knowledge`, `/notes`, `/worklog`, `/reports`, `/learning`,
`/resources`, `/settings`, auth pages, `/api/export`, `/api/export/tasks`.

**Tests:** 26 unit tests, 10 SQL RLS tests, and a browser suite (69 checks) run against PostgREST.

**What has to change:** there is no concept of a workspace, membership, role, client or shared record.
Every policy assumes "one row, one owner". The upgrade adds a membership layer underneath without
breaking the personal features.

## 2. Guiding rules

1. **Nothing destructive.** Migrations only add tables, nullable columns, functions and policies.
   No existing column is dropped or renamed. Existing rows are backfilled, never rewritten.
2. **Live app keeps working.** All work happens on the `itsm` branch. `main` (and production) is only
   updated when you approve a merge, after the migration has run on a staging database.
3. **Authorisation in the database.** Every new table has RLS. Membership and role checks live in
   `security definer` SQL helpers so policies stay short and consistent. Server Actions check too.
4. **No invented numbers.** SLA "met" is only shown when `first_responded_at` / `resolved_at` exist.
   Reports read real rows.

## 3. Target architecture

### Workspaces and roles

```
workspaces            id, type (personal | freelance | organisation), name, slug,
                      ticket_prefix, branding (logo path, accent colour), created_by
workspace_members     workspace_id, user_id, role (owner | admin | agent | client),
                      client_id (set only for client users)
platform_admins       user_id   — the platform owner; granted by SQL only, never from the UI
invitations           workspace_id, email, role, client_id, token_hash, expires_at, accepted_at
```

- Every user gets a **personal workspace** automatically (trigger on sign-up; backfilled for
  existing users).
- **Freelance** and **organisation** workspaces are created from the app; the creator is owner.
- **Clients** (customer organisations) live inside a workspace. A freelancer has many clients in one
  workspace; each client's contacts can only see that client's data.
- **Invitations** use single-use hashed tokens: the admin creates an invite, the invitee signs up or
  signs in through the link, and a SQL function attaches them with the invited role. No service key.

SQL helpers used by every policy: `is_member(ws)`, `has_role(ws, roles[])`, `is_staff(ws)`
(owner/admin/agent), `client_of(ws)` (the client id a client user is bound to).

### Who can see what

| Data | Owner/admin | Agent | Client user | Other workspaces |
|---|---|---|---|---|
| Tickets | all in workspace | all in workspace | own client's tickets only | never |
| Public replies | yes | yes | on visible tickets | never |
| **Internal notes** | yes | yes | **never** (separate RLS rule) | never |
| Attachments | yes | yes | on visible tickets, non-internal only | never |
| Clients, contacts, assets | yes | yes | own client, read-only, permitted fields | never |
| SLA policies, settings, branding | edit | read | no | never |
| Time entries, invoices, payments | yes | own time entries | shared invoices/summaries only | never |
| Audit log | read | no | no | never |
| Personal tasks, work logs, skills, bookmarks | stay private to the user (unchanged) | | | |

### New modules

| Module | Tables | Notes |
|---|---|---|
| Tickets | `tickets`, `ticket_comments` (`is_internal`), `ticket_events`, `ticket_attachments` | Number per workspace via locked counter (`TP-000124`), unique `(workspace_id, number)`. `ticket_events` written by triggers on every important field change: who, what, old → new, when. Append-only. |
| Attachments | Supabase Storage private bucket `ticket-files`, path `workspace/ticket/uuid` | Storage RLS mirrors ticket visibility; type and size limits (e.g. 10 MB; images, PDF, text, logs). Signed URLs for download. |
| Clients | `clients`, `client_contacts`, `service_agreements` | Profile, contacts, notes, agreement terms linked to an SLA policy. |
| Client portal | routes under `/portal` | Separate layout and navigation; only submit/view/reply/upload/track/review. Internal notes are filtered by RLS, not by the UI. |
| Assets | `assets`, `asset_tickets`, `asset_maintenance` | Asset tag per workspace, type, model, serial, client, location, warranty, purchase date, maintenance schedule, status. |
| SLA | `sla_policies`, `sla_targets` (per priority), `escalation_rules` | Deadlines computed when a ticket is created or its priority changes; pause while "Pending" (configurable). |
| Reporting | SQL views + server queries | Volume/status, technician workload, resolution times, client-wise, date-range filters, CSV and printable output. |
| Freelance | `services`, `time_entries`, `invoices`, `invoice_lines`, `payments` | Billable hours from time entries; invoice numbering per workspace; payment status and balances. No payment collection. |
| Notifications | `notifications` (unique `dedupe_key`), `notification_preferences` | In-app first. Email only after you configure a provider. |
| Audit | `audit_log` | Role changes, invitations, deletions, settings and branding changes. |

### Existing features after the upgrade

- **Tasks, work log, learning tracker, bookmarks:** remain personal, unchanged.
- **Knowledge base and notes:** gain an optional `workspace_id`, so an organisation can share a team
  knowledge base while personal notes stay private (see decision 2).
- **Navigation:** a workspace switcher in the sidebar. Personal workspace shows today's app plus
  tickets; freelance/organisation workspaces add Clients, Assets, SLA, Reports, Billing, Settings.

### Migration of existing data

One additive migration (`20261024…_workspaces.sql`):
1. Create workspace tables and helper functions.
2. Insert a personal workspace + owner membership for every existing `auth.users` row.
3. Add nullable `workspace_id` to `troubleshooting_records` and `notes`; backfill to each owner's
   personal workspace.
4. Replace policies on those two tables with "owner OR staff member of the workspace", keeping
   existing behaviour identical for personal data.
5. Update the sign-up trigger to also create the personal workspace.

Tested first on a copy (local + staging) with the existing 10 RLS tests plus new ones, before it ever
touches production.

## 4. Phases and checkpoints

| Phase | Delivers | Checkpoint (tests before reporting back) |
|---|---|---|
| 2 | Workspaces, members, roles, invitations, switcher, data migration | Existing suites still pass; new RLS tests for cross-workspace isolation and role escalation attempts |
| 3 | Tickets: create/edit/assign/reassign/escalate/close/reopen, comments, internal notes, history, attachments, Kanban + table, search/filter/sort/pagination, printable ticket | Ticket permission and internal-note RLS tests; browser tests for agent flows |
| 4 | Clients, contacts, agreements, client portal | Portal tests: client sees only own tickets, never internal notes or other clients |
| 5 | SLA policies, deadlines, overdue/escalation, assets, reports with CSV/print | Metric tests computed from fixtures; asset isolation tests |
| 6 | Services, time tracking, invoices (print/PDF), payments, notifications + preferences | Financial isolation tests; notification de-duplication tests |
| 7 | Full regression, responsive pass, security review, deployment guide | All suites; migration rehearsal on staging; written rollout and rollback steps |

## 5. Risks

| Risk | Mitigation |
|---|---|
| Migration breaks live data | Additive only; rehearsed on staging; backup before running; rollback script provided |
| Policy mistake leaks data across workspaces | Every table has explicit isolation tests that run as two users in two workspaces plus a client user |
| Vercel preview deployments write to production | Configure Preview environment variables to a staging Supabase project (decision 1) |
| Scope is large | Shipped phase by phase on `itsm`; each phase is usable and tested before the next starts |
| SLA timers need background work | `pg_cron` job inside Supabase (decision 4) — no extra service or secret key |

## 6. Configuration you will need

- A **staging Supabase project** (free) for previews, with its URL/key in Vercel's *Preview* environment.
- A **Storage bucket** `ticket-files` (created by the migration).
- **pg_cron** enabled in Supabase (Database → Extensions) if chosen for SLA alerts.
- Later, optionally, an **email provider** (e.g. Resend or SMTP) for notification emails.
