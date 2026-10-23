# Testing

Three layers of automated tests were run before release, plus a manual checklist to repeat on your
own Supabase project and after each deployment.

## 1. Unit tests — `npm test`

26 tests in `tests/unit/` covering the pure logic everything else depends on:

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

## 3. End-to-end browser tests

The production build (`next build && next start`) was driven in headless Chromium against a
Supabase-compatible backend: the real migration on PostgreSQL 16, real PostgREST v12 (the data API
Supabase runs), and a minimal GoTrue-compatible auth service issuing Supabase-style JWTs.
**69 checks, all passing.** They include:

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

### Security
- [ ] Create a second account in a private window: it sees none of the first account's data.
- [ ] Copy a record URL from account A and open it as account B: "Page not found".
- [ ] In Supabase **Table Editor**, every table shows RLS enabled.
- [ ] Delete the second account (type DELETE); it can no longer sign in.

### Devices
- [ ] Phone: navigation drawer opens and closes; no sideways scrolling on any page.
- [ ] Tablet and laptop widths look tidy; keyboard Tab shows a visible focus ring.
