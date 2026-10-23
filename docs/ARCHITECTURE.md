# Architecture — IT Engineer Companion

A private, single-user-per-account productivity and knowledge app for IT support work.
Everything a user creates belongs to that user alone, enforced in the database.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | Server Components for data reads, Server Actions for writes |
| Styling | Tailwind CSS v4 | Design tokens as CSS variables, light/dark themes |
| UI components | shadcn/ui-style components built on Radix primitives (`radix-ui`) | Accessible dialogs, menus and focus handling; code lives in `src/components/ui` |
| Database | Supabase PostgreSQL | Relational schema, full-text search, Row Level Security |
| Auth | Supabase Auth via `@supabase/ssr` | Cookie sessions, refreshed in `src/proxy.ts` |
| Validation | Zod v4 | One schema per entity, used by the form (client) **and** the Server Action (server) |
| Charts | Recharts | Weekly productivity, skill progress |
| Hosting | Vercel | Native Next.js hosting |

`cacheComponents` is intentionally **off**: every page is per-user and read at request
time, so the classic dynamic rendering model is simpler and safer here.

## Request flow

```
Browser ──► src/proxy.ts ──► refreshes Supabase session cookie
                         └─► redirects signed-out users away from app routes
        ──► (app) layout  ──► requireUser()  (second check, server side)
        ──► page.tsx      ──► Supabase query as the user ──► RLS filters to own rows
        ──► form submit   ──► Server Action ──► Zod validate ──► requireUser() ──► insert/update ──► revalidatePath
```

Authorisation is checked in three places: the proxy (navigation), the layout/page
(`requireUser`), and finally Postgres RLS (the real guarantee). The app only ever uses the
public publishable/anon key; **no service-role key exists anywhere in the code.** Account
deletion uses a `security definer` SQL function that can only delete the caller.

## Folder structure

```
src/
  proxy.ts                     session refresh + route protection
  app/
    layout.tsx                 fonts, theme provider, toaster
    page.tsx                   redirects to /dashboard or /login
    (auth)/login, (auth)/signup, (auth)/forgot-password
    auth/confirm/route.ts      email confirmation + password-recovery link handler
    auth/reset-password        set a new password after recovery
    (app)/layout.tsx           sidebar shell, requires a signed-in user
    (app)/dashboard
    (app)/tasks
    (app)/knowledge            list, new, [id], [id]/edit
    (app)/notes                list, new, [id], [id]/edit
    (app)/worklog              history, new, [id]/edit
    (app)/reports
    (app)/learning
    (app)/resources
    (app)/settings
    api/export/route.ts        JSON export of all of the user's data
  components/
    ui/                        Button, Input, Dialog, Select, Badge, Card …
    layout/                    Sidebar, MobileNav, PageHeader, UserMenu
    tasks/ knowledge/ notes/ worklog/ reports/ learning/ resources/ settings/ dashboard/
    shared/                    EmptyState, PrivacyNotice, Markdown, CopyButton, ConfirmDelete …
  lib/
    supabase/                  browser, server and proxy clients
    auth.ts                    getUser / requireUser / getProfile
    actions/                   Server Actions, one file per feature
    validation/                Zod schemas, one file per feature
    constants.ts               categories, statuses, labels (mirrors SQL checks)
    dates.ts                   timezone-aware "today", week ranges, formatting
    reports.ts                 pure functions that turn saved rows into report text
    demo-data.ts               fictional demo records (flagged is_demo)
    command-library.ts         reference notes for ipconfig, ping, tracert …
supabase/
  migrations/                  complete SQL setup script
  tests/                       RLS tests runnable on plain PostgreSQL
docs/
  ARCHITECTURE.md  TESTING.md
```

## Database schema

All tables live in `public`, have `created_at`/`updated_at` (trigger-maintained), and a
`user_id uuid not null default auth.uid() references auth.users on delete cascade`.

| Table | Purpose | Notable columns |
|---|---|---|
| `profiles` | One row per user, created by a trigger on sign-up | display_name, theme, timezone, date_format, time_format |
| `tasks` | Personal task manager | title, description, category, priority (low/medium/high), status (pending/in_progress/completed), due_date, completion_notes, completed_at (trigger-maintained) |
| `troubleshooting_records` | Knowledge base | title, category (11 fixed), status (investigating/resolved), symptoms, possible_causes, diagnostic_steps, commands_used, solution, verification_steps, lessons_learned, tags[], generated `search` tsvector |
| `notes` | Markdown notebook + command library | title, content (Markdown), category, tags[], is_favorite, generated `search` tsvector |
| `work_logs` | Daily log, unique per (user, date) | log_date, tasks_performed, problems_investigated, solutions_outcomes, skills_learned, challenges, follow_up_actions, reflections |
| `skills` | Skills and certifications | name, kind (skill/certification), category (10 + Other), current_level 0–5, target_level 1–5, status, notes, resources, completed_on |
| `bookmarks` | Links and resources | title, url (http/https only), category (5 fixed), notes |

Every personal table also has `is_demo boolean` so fictional demo data can be shown with a
"Demo" badge and removed in one click.

### Security model

- RLS enabled on every table; four owner-only policies (select/insert/update/delete) using
  `(select auth.uid()) = user_id`. Updates also have `with check`, so rows cannot be handed
  to another user.
- `anon` has no privileges on any table. `authenticated` has table privileges that RLS
  narrows to the caller's own rows.
- Indexes on `(user_id, …)` for each common filter, plus GIN indexes for search and tags.
- `delete_own_account()` deletes `auth.users` for `auth.uid()` only; all data cascades.

These guarantees are tested in `supabase/tests/rls_test.sql`.

## Data rules

- Reports are built only from saved tasks, work logs and records; empty sections say
  "Nothing recorded" rather than filling in text.
- Troubleshooting and work-log forms show a privacy reminder: never store confidential
  company/customer information, credentials or internal IP addresses.
- Commands in the library are reference text; nothing on the site executes commands.
