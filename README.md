# TableWise

A digital waitlist for restaurants — replaces the paper diary and shouted names at the door.

On busy evenings, customers scan a QR at the restaurant entrance, enter their name, phone
and party size, and get a live page showing how many groups are ahead of them. The owner
sees each party appear instantly on a dashboard and taps to clear them as they're seated.

## Status

Early development. Setting up the initial scaffold.

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
cp .env.example .env.local   # then fill in your Supabase credentials
npm run dev
```

Never commit `.env.local`. The service role key bypasses all database access rules and
must stay server-side.
