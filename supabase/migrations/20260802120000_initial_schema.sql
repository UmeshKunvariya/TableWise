-- TableWise initial schema.
--
-- Core security property (see docs/PLAN.md): a customer learns their own ticket
-- number and how many groups are ahead of them, and nothing else. That is
-- enforced structurally — anonymous roles have no policy on queue_entries at
-- all, and reach their own row only through get_my_position(), a
-- SECURITY DEFINER function that returns exactly three scalar fields.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type restaurant_status as enum ('pending', 'approved', 'suspended');
create type queue_status as enum ('waiting', 'seated', 'no_show');
create type queue_source as enum ('qr', 'walk_in');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  -- Per-restaurant override of the 100m default; a sprawling venue may need more.
  geofence_radius_m integer not null default 100
    check (geofence_radius_m between 20 and 2000),
  -- Second factor in the QR URL, so guessing a slug is not enough to join.
  qr_token text not null default encode(gen_random_bytes(16), 'hex'),
  -- Ticket numbers reset at *local* midnight. Without this an IST restaurant
  -- would roll over at 05:30 with a UTC-derived service date.
  timezone text not null default 'UTC',
  status restaurant_status not null default 'pending',
  menu_pdf_path text,
  is_queue_open boolean not null default true,
  created_at timestamptz not null default now()
);

create index restaurants_slug_idx on restaurants (slug);

-- Join table rather than a plain owner_id column: a restaurant will eventually
-- have several staff logins, and retrofitting that later would touch every policy.
create table restaurant_members (
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

create index restaurant_members_user_idx on restaurant_members (user_id);

create table queue_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  ticket_number integer not null,
  name text not null,
  phone text,
  party_size integer not null check (party_size between 1 and 50),
  status queue_status not null default 'waiting',
  -- The restaurant's local service day, assigned at allocation time. Stored
  -- rather than derived because timestamptz::date is STABLE, not IMMUTABLE,
  -- and so cannot be used in the unique index below.
  service_date date not null,
  -- The customer's bearer credential for get_my_position(). Never exposed to
  -- any other party; unique so a lookup can never be ambiguous.
  customer_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  joined_at timestamptz not null default now(),
  seated_at timestamptz,
  captured_lat double precision,
  captured_lng double precision,
  distance_m double precision,
  source queue_source not null default 'qr'
);

-- Position is derived on every read, so this index carries the whole app.
create index queue_entries_position_idx
  on queue_entries (restaurant_id, status, joined_at);

create index queue_entries_token_idx on queue_entries (customer_token);

-- Ticket numbers must be unique and gap-free per restaurant per day. Counting
-- existing rows is racy under concurrent joins, so allocation goes through an
-- atomic upsert against this counter instead.
create table daily_counters (
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  service_date date not null,
  last_ticket integer not null default 0,
  primary key (restaurant_id, service_date)
);

-- Belt and braces: even if allocation were bypassed, the database refuses duplicates.
create unique index queue_entries_daily_ticket_idx
  on queue_entries (restaurant_id, service_date, ticket_number);
