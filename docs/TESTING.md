# Testing

Three layers of automated tests were run before release, plus a manual checklist to repeat on your
own Supabase project and after each deployment.

## 1. Unit tests — `npm test`

43 tests in `tests/unit/` covering the pure logic everything else depends on:

- **Ticket workflow**: allowed and blocked status changes, mirroring the database rules; who may reopen.
- **SLA states**: no target, on track, due soon (last 25%, at least 15 minutes), overdue, met, missed,
  from stored timestamps only; target formatting.
- **Service metrics**: compliance counts only targets with a known result; averages; queue; grouping by
  priority and technician; created/resolved per local day, week and month.

- **Dates and time zones**: calendar validation, month/year rollover, Monday-to-Sunday weeks, local
  midnight in UTC for India, London summer and winter time, invalid-zone fallback, every date format.
- **Reports**: list-marker stripping; empty days report "Nothing recorded" in every section; tasks are
  counted on the user's local day (a task finished at 20:00 UTC counts for the next day in India);
  problems, skills and follow-ups come only from saved logs, records and tasks; weekly completion rate.
- **CSV export**: quoting and spreadsheet formula-injection protection.
- **Validation**: required fields, enums, impossible dates, tag normalisation, resolved records need a
  solution, `http(s)`-only bookmarks, completed skills need a date, password strength, and removal of
  characters that could alter database filter syntax.

## 2. Database security tests — `npm run test:rls`

`supabase/tests/rls_test.sql` runs the real migration on PostgreSQL (with a small stand-in for
Supabase's `auth` schema) and checks:

| Check | Result |
|---|---|
| Profile created on sign-up, with display-name fallback | Pass |
| Owner can insert and read; `user_id` defaults to the caller | Pass |
| Cannot insert rows owned by another user | Pass |
| `completed_at` follows task status | Pass |
| Full-text search columns | Pass |
| CHECK and UNIQUE constraints (bad priority, `javascript:` URL, empty title, duplicate log date) | Pass |
| A second user can't see, update or delete the first user's rows in any table, including profiles | Pass |
| Rows can't be reassigned to another user | Pass |
| Anonymous role has no table access and can't call account deletion | Pass |
| Account deletion removes only the caller's data, across every table | Pass |

### Workspaces and ticketing (`rls_workspaces_test.sql`, `rls_ticketing_test.sql`)

Run on a database that already contains data from before the upgrade, so the migrations are tested
against real old rows. The ticketing suite uses one organisation with an owner, two technicians, two
customers of different clients, a second workspace and an outsider:

| Check | Result |
|---|---|
| Existing users and records are backfilled without loss; legacy users keep access | Pass |
| Invitations are hashed, single-use, bound to the invited email; roles can't be escalated | Pass |
| New workspaces get default SLA targets | Pass |
| Tickets get unique per-workspace numbers (`NW-00001`), always start Open, get SLA deadlines | Pass |
| Customers can only raise tickets for their own organisation; staff-only fields are ignored | Pass |
| Organisations, clients, other workspaces and outsiders can't see each other's tickets | Pass |
| **Internal notes are invisible to customers**, and customers can't write them | Pass |
| Customers see public history but not assignment changes | Pass |
| Comments can't be edited or deleted; tickets can't be deleted | Pass |
| Status changes follow the workflow; resolving needs a summary; only admins reopen closed tickets | Pass |
| Ticket number, workspace, creator and timestamps can't be changed | Pass |
| A customer reply reopens a resolved ticket; customers can't change tickets | Pass |
| Notifications reach the right people, never the person who acted, never another user | Pass |
| SLA breaches are recorded and alerted once, however often the sweep runs | Pass |
| Client SLA overrides and priority changes recalculate deadlines; only admins edit targets | Pass |
| Automation assigns and notifies; history credits the rule; only admins manage rules | Pass |
| Knowledge base visibility: Private (author only), Team (staff), Public (that workspace's customers, never outsiders) | Pass |
| Tickets can only link articles from their own workspace | Pass |
| Client-technician assignments are admin-only and audited | Pass |
| Platform overview is limited to platform owners | Pass |
| Ticket creation is rate-limited (60 per user per hour) | Pass |
| Deleting a technician or a customer keeps tickets and history; deleting a workspace removes only its data | Pass |
| A rule whose target is no longer staff doesn't block its author's account deletion; retargeting is still checked | Pass |

**45 database checks in total, all passing.** The ticketing migration's rollback script was also
tested: up, down, up again, keeping workspaces and personal data.

## 3. End-to-end browser tests

The production build (`next build && next start`) was driven in headless Chromium against a
Supabase-compatible backend: the real migration on PostgreSQL 16, real PostgREST v12 (the data API
Supabase runs), and a minimal GoTrue-compatible auth service issuing Supabase-style JWTs.
**116 checks across five suites, all passing, with every migration applied** (latest run: 24 Oct 2026).

### ITSM upgrade: multiple users and organisations (30 checks)

Five people in separate browser sessions: an owner, a technician, a customer of client Alpha, a
customer of client Beta, and the owner of an unrelated workspace.

- **Setup**: owner creates an organisation, adds two clients, invites a technician from the Team page and
  one customer per client; customers land in the branded portal for their own organisation.
- **Configuration**: SLA target changed in settings and applied to new tickets; automation rule assigns
  Printers tickets; technicians are kept out of Team and Workspace settings.
- **Ticket lifecycle**: a customer raises a request in the portal, it's auto-assigned and the technician
  is notified; internal note plus public reply; **the customer sees the reply but never the internal
  note**; the customer's reply moves it back to In progress; resolving requires a summary, which the
  customer then sees.
- **Separation**: the other client's customer can't see or open the request ("Page not found");
  customers are redirected away from every staff page; the staff CSV export refuses customers; the
  unrelated workspace sees none of the tickets, clients, articles or notifications.
- **Staff tools**: ticket logged on behalf of a customer; critical tickets get the 30-minute target;
  board offers only allowed status moves; technicians close but can't reopen closed tickets, the owner
  can; search by ticket number, priority filter, SLA sort.
- **Knowledge base**: article drafted from a ticket, marked Public, linked back to the ticket and visible
  to both clients' customers; a Private article is hidden from the owner and customers.
- **Figures**: overview and reports totals match the saved tickets, including a client filter; CSV export
  includes SLA results; deactivating a client hides it from new tickets but customers keep access to
  existing ones.
- **Dashboard and header search**: greeting, quick actions, stat cards, status ring and SLA deadlines match the saved tickets; header search finds tickets, clients and articles.
- **Personal workspace** unaffected; **phone layout**: 14 staff and portal pages checked at 390px on a
  fresh load; **no browser errors** in any session.

### Original features, re-run after the upgrade (86 checks)

Everything below still passes. Three checks were updated for deliberate changes (the new header search box;
the knowledge base
menu item was renamed from Troubleshooting; team invitations moved to the Team page).

- **Auth**: protected routes redirect to sign-in and return afterwards; client-side validation;
  sign-up, sign-in, wrong password, sign-out; email confirmation link; reused link rejected; password
  reset without revealing whether an email exists; old password stops working.
- **Tasks**: create/edit/delete, validation, overdue highlighting, live search, status/priority/due
  filters, one-click complete, completion notes, dashboard counts and chart match the data.
- **Knowledge base**: privacy confirmation required; resolved records need a solution; templates;
  full-text search ("gateway routing"); exact switch search ("/flushdns"); tag and category filters; editing.
- **Notes**: command library import (and no duplicate import), search by switch, code blocks with copy
  buttons, Markdown preview, favourites, deletion.
- **Work log**: validation, calendar and history, one entry per day enforced, search.
- **Reports**: daily report contains exactly the saved task, notes, log items, record and overdue
  follow-up; a day with no data says "Nothing recorded" and shows nothing from other days; weekly
  statistics; edit and reset; CSV export, and invalid dates rejected.
- **Learning, resources, settings**: skills and certifications, auto-filled completion date, progress;
  URL validation; recommended links; profile and time zone; demo data load and complete removal; JSON
  export; password change; theme toggle saved to the profile.
- **Isolation**: a second user sees none of the first user's tasks, records, notes, logs or links, gets
  "Page not found" for the first user's record URL, and exports nothing of theirs.
- **Account deletion**: requires typing DELETE; deleted account can't sign in; other accounts unaffected.
- **Responsive**: no horizontal scrolling at 390px on dashboard, tasks, notes, reports, learning, work
  log and settings; mobile navigation drawer.
- **No browser console errors** across all flows.

Bugs these tests found and fixed before release: demo data failed to load because bulk inserts sent
`NULL` instead of column defaults; knowledge-base sections showed raw Markdown; the task table squeezed
titles; the mobile dashboard overflowed the screen width.

Bugs found by the upgrade's tests and fixed before handing over: a shared database check read a column
that only one of its tables had (automation rules couldn't be saved); deleting a technician's or
customer's account was blocked by ticket history; ticket history credited the customer for an
automatic assignment; the ticket list and SLA settings made phones zoom the whole page out; the
overview's activity feed ignored its filters; an administrator couldn't delete their account if an
automation rule they wrote targeted someone who had since stopped being staff.

The browser harness isn't included in the repo because it depends on a local PostgREST binary and a
bundled Chromium; the manual checklist below covers the same ground on a real Supabase project.

---

## Manual testing checklist

Run this on your own Supabase project locally, and again on the Vercel deployment.

### Setup and auth
- [ ] With no `.env.local`, the app shows the setup page.
- [ ] Signing up sends a confirmation email (if enabled); the link opens the dashboard.
- [ ] Wrong password shows "Email or password is incorrect."
- [ ] Visiting `/tasks` signed out redirects to sign-in, then back to `/tasks` after signing in.
- [ ] Forgot password sends a link; setting a new password works and the old one doesn't.
- [ ] Sign out from the user menu and from Settings.

### Core features
- [ ] Create a task due yesterday: it shows red as Overdue on Tasks and the Dashboard.
- [ ] Complete a task with the round toggle; Dashboard "Completed this week" and the chart update.
- [ ] Search and each filter on Tasks change the results; Clear resets them.
- [ ] New troubleshooting record: saving is blocked until the privacy box is ticked.
- [ ] Search the knowledge base by a symptom word and by a command switch.
- [ ] Import the command library; open `netstat` and copy a code block.
- [ ] Write today's work log; the calendar shows a green light for today.
- [ ] Today's report lists your completed task, log items and follow-ups — and nothing you didn't enter.
- [ ] Download the report (.md) and the tasks CSV; print preview looks clean.
- [ ] Add a skill and a certification; mark one completed.
- [ ] Save a bookmark; a `javascript:` URL is rejected.

### Settings and data
- [ ] Change time zone and date format; dates update across pages.
- [ ] Load demo data (items show a Demo badge), then remove it; your own items remain.
- [ ] Export all data and open the JSON.
- [ ] Toggle light/dark; reload and the choice is kept.

### Service desk (after running the ticketing migration)
- [ ] Create an organisation workspace, add two clients, invite a technician (Team) and one customer per client.
- [ ] As a customer, raise a request in the portal; it appears in Tickets and the technician is notified.
- [ ] Add an internal note and a public reply; the customer sees only the reply.
- [ ] Sign in as the other client's customer: the request isn't listed and its URL shows "Page not found".
- [ ] Try Open → Closed from the board: not offered. Resolve without a summary: refused.
- [ ] As a technician, close a resolved ticket; you can't reopen it, an admin can.
- [ ] Change an SLA target in Workspace settings; a new ticket of that priority uses it.
- [ ] Mark an article Public; customers see it under Help articles. A Private one stays hidden.
- [ ] Overview and Reports numbers match the tickets you created; CSV export downloads.

### Security
- [ ] Create a second account in a private window: it sees none of the first account's data.
- [ ] Copy a record URL from account A and open it as account B: "Page not found".
- [ ] In Supabase **Table Editor**, every table shows RLS enabled.
- [ ] Delete the second account (type DELETE); it can no longer sign in.

### Devices
- [ ] Phone: navigation drawer opens and closes; no sideways scrolling on any page.
- [ ] Tablet and laptop widths look tidy; keyboard Tab shows a visible focus ring.
