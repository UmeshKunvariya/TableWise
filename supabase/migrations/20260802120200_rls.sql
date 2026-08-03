-- Row Level Security and function grants.
--
-- The load-bearing rule from docs/PLAN.md: anonymous clients get NO policy on
-- queue_entries. Not a restrictive one — none at all. With RLS enabled and no
-- permissive policy, every anonymous read returns zero rows rather than an
-- error, and there is no policy to get subtly wrong later.

alter table profiles            enable row level security;
alter table restaurants         enable row level security;
alter table restaurant_members  enable row level security;
alter table queue_entries       enable row level security;
alter table daily_counters      enable row level security;

-- ---------------------------------------------------------------------------
-- Policy helpers.
--
-- These are SECURITY DEFINER on purpose. A policy on `restaurants` that queries
-- `restaurant_members` directly would re-enter that table's own RLS and recurse;
-- a definer function reads underneath RLS and breaks the cycle.
-- ---------------------------------------------------------------------------

create or replace function public.is_member_of(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = p_restaurant_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_super_admin from public.profiles p
      where p.user_id = (select auth.uid())),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy profiles_select_own on profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_super_admin());

create policy profiles_update_own on profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    -- Self-promotion to super admin is not on the menu.
    and is_super_admin = (
      select p.is_super_admin from public.profiles p
      where p.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- restaurants
--
-- No anonymous policy. Customers read restaurant details only through
-- public.get_public_restaurant(), which returns a curated column set for an
-- approved restaurant matching both slug and qr_token.
-- ---------------------------------------------------------------------------

create policy restaurants_select_own on restaurants
  for select to authenticated
  using (public.is_member_of(id) or public.is_super_admin());

create policy restaurants_update_own on restaurants
  for update to authenticated
  using (public.is_member_of(id) or public.is_super_admin())
  with check (public.is_member_of(id) or public.is_super_admin());

-- Only a super admin flips approval status; owners self-register through the
-- register_restaurant() definer function, never by direct insert.
create policy restaurants_admin_all on restaurants
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- restaurant_members
-- ---------------------------------------------------------------------------

create policy members_select_own on restaurant_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- queue_entries — owners only. Anonymous customers deliberately have no policy.
-- ---------------------------------------------------------------------------

create policy queue_owner_all on queue_entries
  for all to authenticated
  using (public.is_member_of(restaurant_id) or public.is_super_admin())
  with check (public.is_member_of(restaurant_id) or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- daily_counters — internal bookkeeping. No policy for anyone; the allocation
-- function is SECURITY DEFINER and reaches it underneath RLS.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Customer-facing read of a restaurant, by slug + QR token.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_restaurant(
  p_slug text,
  p_qr_token text
)
returns table (
  id uuid,
  name text,
  slug text,
  is_queue_open boolean,
  has_menu boolean,
  waiting_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.name,
    r.slug,
    r.is_queue_open,
    r.menu_pdf_path is not null as has_menu,
    (select count(*)::integer from public.queue_entries e
      where e.restaurant_id = r.id and e.status = 'waiting') as waiting_count
  from public.restaurants r
  where r.slug = p_slug
    and r.qr_token = p_qr_token
    and r.status = 'approved';
$$;

-- ---------------------------------------------------------------------------
-- Owner self-registration. Four rows that must land together — a partial
-- failure would strand a user with no restaurant and no way to retry.
-- ---------------------------------------------------------------------------
create or replace function public.register_restaurant(
  p_full_name text,
  p_phone text,
  p_restaurant_name text,
  p_slug text,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_timezone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_restaurant_id uuid;
begin
  if v_user_id is null then
    raise exception 'must be signed in' using errcode = 'insufficient_privilege';
  end if;

  insert into public.profiles (user_id, full_name, phone)
  values (v_user_id, p_full_name, p_phone)
  on conflict (user_id) do update
    set full_name = excluded.full_name, phone = excluded.phone;

  insert into public.restaurants (name, slug, address, lat, lng, timezone, status)
  values (p_restaurant_name, p_slug, p_address, p_lat, p_lng, p_timezone, 'pending')
  returning id into v_restaurant_id;

  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (v_restaurant_id, v_user_id, 'owner');

  return v_restaurant_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function grants.
--
-- Postgres grants EXECUTE to PUBLIC on new functions by default, which would
-- let any anonymous caller invoke join_queue directly and skip the geofence
-- entirely. Every definer function is therefore revoked first and re-granted
-- only to the roles that must call it.
-- ---------------------------------------------------------------------------

revoke all on function public.assign_ticket_number(uuid)      from public, anon, authenticated;
revoke all on function public.restaurant_service_date(uuid)   from public, anon, authenticated;
revoke all on function public.broadcast_queue_change()        from public, anon, authenticated;
revoke all on function public.join_queue(uuid, text, text, integer, double precision, double precision, double precision, public.queue_source)
  from public, anon, authenticated;
revoke all on function public.leave_queue(text)               from public, anon, authenticated;
revoke all on function public.get_my_position(text)           from public, anon, authenticated;
revoke all on function public.get_public_restaurant(text, text) from public, anon, authenticated;
revoke all on function public.register_restaurant(text, text, text, text, text, double precision, double precision, text)
  from public, anon, authenticated;

-- The customer status page polls this from the browser on every broadcast, so
-- anon must be able to call it. It returns three scalars for one token only.
-- service_role is included because revoking from PUBLIC also removes the
-- implicit grant it inherited, and server-side rendering calls both.
grant execute on function public.get_my_position(text) to anon, authenticated, service_role;
grant execute on function public.get_public_restaurant(text, text) to anon, authenticated, service_role;

-- Signup runs as the freshly-created (authenticated) user.
grant execute on function public.register_restaurant(text, text, text, text, text, double precision, double precision, text)
  to authenticated;

-- Joining and leaving go through server actions holding the service role key,
-- because that is where the geofence is enforced. Never callable from a browser.
grant execute on function public.join_queue(uuid, text, text, integer, double precision, double precision, double precision, public.queue_source)
  to service_role;
grant execute on function public.leave_queue(text) to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: the owner dashboard subscribes to postgres_changes on its own rows.
-- RLS above is what keeps that subscription scoped to one restaurant.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.queue_entries;
