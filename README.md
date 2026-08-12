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

Requires Node.js 20+ and a Supabase project.

```bash
npm install
npx supabase start           # local Postgres, Auth and Realtime (needs Docker)
cp .env.example .env.local   # then fill in the credentials supabase start prints
npm run dev
```

Never commit `.env.local`. The service role key bypasses all database access rules and
must stay server-side.

New restaurants register at `/signup` and land in `pending` — they cannot take a queue
until approved. Approvals happen at `/admin`, which is only reachable by a super admin;
promote your own account once, directly in the database:

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
