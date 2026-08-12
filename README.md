# TableWise

A digital waitlist for restaurants — replaces the paper diary and shouted names at the door.

On busy evenings, customers scan a QR at the restaurant entrance, enter their name, phone
and party size, and get a live page showing how many groups are ahead of them. The owner
sees each party appear instantly on a dashboard and taps to clear them as they're seated.

## Status

All ten steps of the build order in [`docs/PLAN.md`](docs/PLAN.md) are implemented —
the scaffold and theme, schema, owner auth, geofenced join flow, live status page,
owner dashboard, QR poster, menu upload, and admin approvals. Both halves of the
loop are closed: a customer can scan and join, and an owner can seat them.

Not yet run against a real Supabase project. Everything so far is verified by the
test suite and a production build; the numbers below come from in-process Postgres,
not the live stack.

Payments are deliberately out of scope.

## Stack

- **Next.js 16** (App Router) — frontend and backend in one app
- **Tailwind CSS 4** — light, mobile-first restaurant theme
- **Supabase** — Postgres, Realtime, Auth, and Storage
- **Vercel** — hosting

## How it works

Each restaurant gets a printed QR code. Scanning it opens a mobile page for that
restaurant only. Joining the queue requires the customer to actually be there — the
server checks their reported location against the restaurant's coordinates within a
configurable radius (100m by default), so people can't join from home.

Customers only ever see their own ticket number and the count of groups ahead of them,
never anyone else's details. Restaurants are fully isolated from each other at the
database level.

## Setup

Requires Node.js 20+ and Docker Desktop (which on Windows requires WSL2).

```bash
npm install
npm run db:start             # local Postgres, Auth, Realtime and Storage
npm run db:reset             # apply migrations and load the dev seed
npm run dev
```

`db:start` prints an API URL, an anon key and a service role key. Copy
`.env.example` to `.env.local` and paste them in. Never commit `.env.local` — the
service role key bypasses all database access rules and must stay server-side.

Useful local endpoints: Studio on `54323`, Postgres on `54322`, and the inbox that
captures outgoing mail on `54324`.

### The dev seed

`supabase/seed.sql` creates a super admin owning an already-approved restaurant, so
you get a working dashboard without hand-editing the database:

- **owner@tablewise.test** / **tablewise123**
- Demo Kitchen, reachable at `/r/demo-kitchen?t=localdevtoken00000000000000000000`

Its coordinates are a **placeholder**. Joining the queue is geofenced, so either edit
the `lat`/`lng` in the seed to your own location, or spoof the browser's — in Chrome,
DevTools → ⋮ → More tools → Sensors → Location. Rerun `npm run db:reset` after editing.

New restaurants register at `/signup` and land in `pending` — they cannot take a queue
until approved. Approvals happen at `/admin`, reachable only by a super admin. To
promote an account that didn't come from the seed:

```sql
update profiles set is_super_admin = true where user_id = '<your-auth-user-id>';
```

## Tests

```bash
npm test        # geofence logic + schema, RLS and RPC behaviour
npm run build   # also runs a full typecheck
```

`supabase/tests/schema.test.mjs` runs the real migrations against an in-process
Postgres (PGlite), so the schema, the RLS policies and the ticket-allocation
logic are testable without Docker. It stubs the Supabase-provided `auth` and
`realtime` schemas — `npx supabase db reset` against the local stack remains the
authoritative check.
