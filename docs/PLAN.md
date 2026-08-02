# TableWise — Digital Restaurant Waitlist

## Context

On weekends, popular restaurants manage overflow with a paper diary: a staff member writes down each waiting party's name and party size, then shouts names one by one. This is slow, error-prone, and leaves customers standing outside with no idea how long they'll wait — so they leave.

TableWise replaces the diary. Each restaurant gets a printed QR at its entrance. Customers scan it, enter name / phone / party size, and land on a live status page showing only *how many groups are ahead of them*. The owner sees entries appear instantly on a dashboard and taps to clear each party as they're seated.

Built as multi-tenant SaaS from day one (owners self-register, admin approves) but starting with 5-6 restaurants. No payment gateway in this phase.

**Design constraints:** light, professional restaurant theme; mobile-first and fast to open, since every customer arrives by scanning a QR on a phone outdoors on mobile data.

---

## Decisions locked

| Area | Decision |
|---|---|
| Stack | Next.js 16 (App Router) + Tailwind 4, frontend and backend in one app |
| Data | Supabase — Postgres + Realtime + Auth + Storage |
| Hosting | Vercel + Supabase, free tiers |
| Geofence | 100m default (per-restaurant configurable). Denied/inaccurate location = **blocked**; owner has "Add walk-in" as the escape hatch |
| Owner signup | Self-signup → `pending` → super-admin approves |
| Menu | Optional per restaurant; owner uploads a PDF |
| Notify | Live status page only — no SMS/push |
| Clearing | **Seated** / **No-show** buttons; rows archived, not deleted |

---

## Architecture

### Why Supabase

The core requirement is that an insert appears on the dashboard instantly and a clear disappears with no lag. Supabase gives Postgres Realtime over an already-open WebSocket, plus Row Level Security for tenant isolation, auth, and PDF storage in one service. No separate socket server to run.

### The realtime problem, and the fix

The dashboard is authenticated, so it subscribes directly to `postgres_changes` on `queue_entries` filtered by its own `restaurant_id` — RLS guarantees an owner can never receive another restaurant's rows.

The customer status page is **anonymous**, so it must not be able to read the queue table. Instead:

1. A Postgres trigger on `queue_entries` sends a **Realtime Broadcast** to public channel `queue:<restaurant_id>` containing only a version counter — zero PII.
2. On receiving that ping, the customer page calls a `SECURITY DEFINER` RPC `get_my_position(customer_token)` which returns **only** `{ ticket_number, people_ahead, status }`.

This satisfies the requirement exactly — the customer learns their number and nothing about anyone else — while making it structurally impossible to scrape names or phone numbers.

### Geofence — server-side only

The browser reports `{ lat, lng, accuracy }` via `navigator.geolocation`. The **server** recomputes haversine distance to the restaurant's stored coordinates; the client's own distance claim is never trusted. Rejected when the customer denies permission, `accuracy > 200m` (unreliable fix), or `distance - accuracy > radius`. Requires HTTPS — satisfied by Vercel.

### Perceived speed

- Customer landing page is a Server Component; the scan-to-usable path ships minimal JS.
- Dashboard clears use `useOptimistic` — the row vanishes on tap, before the server round-trip.
- Realtime WebSocket is opened on dashboard mount, so updates cost no HTTP request.

---

## Data model

`restaurants` — `id, slug, name, address, lat, lng, geofence_radius_m (default 100), qr_token, status (pending|approved|suspended), menu_pdf_path (nullable), is_queue_open, created_at`

`restaurant_members` — `restaurant_id, user_id (→ auth.users), role` — join table so a restaurant can later have multiple staff logins.

`queue_entries` — `id, restaurant_id, ticket_number, name, phone, party_size, status (waiting|seated|no_show), customer_token, joined_at, seated_at, captured_lat, captured_lng, distance_m, source (qr|walk_in)`

`profiles` — `user_id, full_name, phone, is_super_admin`

**Ticket numbers** reset per restaurant per day, assigned in a transaction. **Position** is derived, never stored: count of `waiting` rows for that restaurant with an earlier `joined_at`. Index on `(restaurant_id, status, joined_at)`.

### RLS policies

- `restaurants`: owner reads/updates own row via `restaurant_members`; anon reads only public columns of `approved` restaurants by `slug + qr_token`.
- `queue_entries`: **no anonymous access at all.** Owner has full access to own restaurant's rows. Customers reach their own row exclusively through the `SECURITY DEFINER` RPC.
- Super admin bypasses via `profiles.is_super_admin`.

---

## Routes

**Customer** (mobile-first, no login)
- `/r/[slug]?t=<qr_token>` — restaurant name, live "X groups waiting", Join button, Menu link if a PDF exists
- `/r/[slug]/join` — name / phone / party size, requests location on submit
- `/r/[slug]/status` — ticket number, **"3 groups ahead of you"**, live-updating, Leave queue
- `/r/[slug]/menu` — PDF viewer, only rendered when `menu_pdf_path` is set

**Owner**
- `/login`, `/signup` (name, restaurant, address, location → lands in `pending`)
- `/pending` — holding page while awaiting approval
- `/dashboard` — live queue, large tap targets, Seated / No-show, **Add walk-in**, queue open/close toggle
- `/dashboard/qr` — printable QR poster (PNG/SVG download)
- `/dashboard/menu` — PDF upload / replace / remove
- `/dashboard/settings` — restaurant location ("use my current location" + manual lat/lng), geofence radius

**Admin**
- `/admin` — approve / suspend restaurants

---

## Key files

```
app/r/[slug]/{page,join/page,status/page,menu/page}.tsx   customer flow
app/(owner)/dashboard/**                                   owner panel
app/(owner)/admin/page.tsx                                 super admin
app/actions/{queue,restaurant,menu}.ts                     server actions
lib/supabase/{client,server,admin}.ts                      @supabase/ssr clients
lib/geo.ts                                                 haversine + validation
lib/queue.ts                                               ticket assignment, position
components/ui/**                                           shared light-theme components
supabase/migrations/*.sql                                  schema, RLS, RPC, triggers
```

Dependencies: `next@16`, `tailwindcss@4`, `@supabase/supabase-js@2`, `@supabase/ssr@0.12`, `qrcode`, `zod`, `react-pdf` (or a native `<iframe>` PDF view if bundle size is a concern).

---

## Build order

1. **Scaffold** — Next 16 + Tailwind 4, light restaurant theme tokens (warm neutrals, deep green/terracotta accent), base UI components.
2. **Supabase schema** — tables, indexes, RLS, `get_my_position` RPC, broadcast trigger, `assign_ticket_number`.
3. **Owner auth** — signup / login / pending gate / route protection middleware.
4. **Customer join flow** — landing, geofenced join form, server-side distance validation.
5. **Live status page** — broadcast subscription + position RPC.
6. **Dashboard** — realtime queue list, optimistic Seated/No-show, Add walk-in, queue toggle.
7. **QR generation** — printable poster per restaurant.
8. **Menu** — PDF upload to Storage, conditional customer-side viewer.
9. **Admin** — approvals.
10. **Polish** — loading skeletons, offline/GPS error states, empty states, Lighthouse mobile pass.

---

## Verification

**Realtime end-to-end:** open the dashboard on a laptop and the customer flow on a phone. Joining must surface the row on the dashboard in well under a second; tapping Seated must instantly decrement "groups ahead" on every other waiting customer's status page.

**Geofence:** use Chrome DevTools sensor override to spoof coordinates. Confirm a point 500m away is rejected, a point 50m away is accepted, and denying the permission prompt is blocked with a clear message pointing to the counter. Then verify the owner's Add walk-in still gets that customer in.

**Tenant isolation** — the critical security check: log in as restaurant A's owner and attempt to fetch restaurant B's `queue_entries` directly via the Supabase client. RLS must return zero rows, not an error. Repeat as an anonymous client — anon must never read `queue_entries` at all.

**Mobile performance:** Lighthouse mobile on `/r/[slug]` throttled to Slow 4G — target interactive under ~2s, since customers open this on mobile data while standing outside.

**Concurrency:** fire ~20 simultaneous joins at one restaurant and confirm ticket numbers are unique and gap-free.
