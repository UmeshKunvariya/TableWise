-- Functions for ticket allocation, customer position lookup, and realtime fanout.
--
-- Every SECURITY DEFINER function below pins search_path to the empty string and
-- fully qualifies its references. A definer-rights function that resolves names
-- through a caller-controlled search_path is a privilege escalation hole.

-- ---------------------------------------------------------------------------
-- Current service date for a restaurant, in its own timezone.
-- ---------------------------------------------------------------------------
create or replace function public.restaurant_service_date(p_restaurant_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce(r.timezone, 'UTC'))::date
  from public.restaurants r
  where r.id = p_restaurant_id;
$$;

-- ---------------------------------------------------------------------------
-- Atomic, gap-free ticket allocation.
--
-- The upsert takes a row lock on conflict, so concurrent joins serialise on the
-- counter row and each caller receives a distinct number. No row counting, so
-- clearing a party never causes a number to be reused.
-- ---------------------------------------------------------------------------
create or replace function public.assign_ticket_number(p_restaurant_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service_date date;
  v_ticket integer;
begin
  v_service_date := public.restaurant_service_date(p_restaurant_id);

  if v_service_date is null then
    raise exception 'unknown restaurant %', p_restaurant_id
      using errcode = 'no_data_found';
  end if;

  insert into public.daily_counters (restaurant_id, service_date, last_ticket)
  values (p_restaurant_id, v_service_date, 1)
  on conflict (restaurant_id, service_date)
  do update set last_ticket = public.daily_counters.last_ticket + 1
  returning last_ticket into v_ticket;

  return v_ticket;
end;
$$;

-- ---------------------------------------------------------------------------
-- Join the queue. SECURITY DEFINER because anonymous customers have no insert
-- policy on queue_entries — this function is their only way in, and it returns
-- only the token and ticket, never the row.
--
-- Geofence enforcement lives in the server action, not here: this function
-- trusts its caller, and its only caller is trusted server-side code.
-- ---------------------------------------------------------------------------
create or replace function public.join_queue(
  p_restaurant_id uuid,
  p_name text,
  p_phone text,
  p_party_size integer,
  p_lat double precision,
  p_lng double precision,
  p_distance_m double precision,
  p_source public.queue_source default 'qr'
)
returns table (customer_token text, ticket_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket integer;
  v_token text;
  v_service_date date;
  v_status public.restaurant_status;
  v_open boolean;
begin
  select r.status, r.is_queue_open into v_status, v_open
  from public.restaurants r
  where r.id = p_restaurant_id;

  if v_status is distinct from 'approved' then
    raise exception 'restaurant not accepting joins'
      using errcode = 'check_violation';
  end if;

  -- Walk-ins are added by the owner and bypass the closed-queue gate, since
  -- closing the queue means "no new QR joins", not "stop seating people".
  if not v_open and p_source = 'qr' then
    raise exception 'queue is closed' using errcode = 'check_violation';
  end if;

  -- Friendly rejection for the common case: an impatient customer submitting
  -- twice. The partial unique index is what actually guarantees this under
  -- concurrency; this check exists so the usual path returns a clear message
  -- instead of a raw constraint violation.
  if p_phone is not null and exists (
    select 1 from public.queue_entries e
    where e.restaurant_id = p_restaurant_id
      and e.phone = p_phone
      and e.status = 'waiting'
  ) then
    raise exception 'already in the queue'
      using errcode = 'unique_violation';
  end if;

  v_service_date := public.restaurant_service_date(p_restaurant_id);
  v_ticket := public.assign_ticket_number(p_restaurant_id);

  insert into public.queue_entries (
    restaurant_id, ticket_number, name, phone, party_size, service_date,
    captured_lat, captured_lng, distance_m, source
  )
  values (
    p_restaurant_id, v_ticket, p_name, p_phone, p_party_size, v_service_date,
    p_lat, p_lng, p_distance_m, p_source
  )
  returning public.queue_entries.customer_token into v_token;

  return query select v_token, v_ticket;
end;
$$;

-- ---------------------------------------------------------------------------
-- The customer's entire view of the world.
--
-- Returns exactly three scalars. There is no shape of this response that can
-- leak another party's name, phone, or party size — which is why anonymous
-- clients get no direct policy on queue_entries at all.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_position(p_customer_token text)
returns table (
  ticket_number integer,
  people_ahead integer,
  status public.queue_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.ticket_number,
    -- Only meaningful while waiting; seated/no-show parties report zero.
    case when e.status = 'waiting' then (
      select count(*)::integer
      from public.queue_entries ahead
      where ahead.restaurant_id = e.restaurant_id
        and ahead.status = 'waiting'
        and ahead.joined_at < e.joined_at
    ) else 0 end as people_ahead,
    e.status
  from public.queue_entries e
  where e.customer_token = p_customer_token;
$$;

-- ---------------------------------------------------------------------------
-- Leave the queue. Same reasoning as join_queue: the token is the credential.
--
-- Records 'left', not 'no_show'. A customer who tells us they are going is
-- doing the right thing; counting them against the restaurant's no-show rate
-- would make that statistic meaningless.
-- ---------------------------------------------------------------------------
create or replace function public.leave_queue(p_customer_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.queue_entries
  set status = 'left'
  where customer_token = p_customer_token
    and status = 'waiting';
$$;

-- ---------------------------------------------------------------------------
-- Realtime fanout.
--
-- The customer status page is anonymous and must not read the queue table, so
-- it cannot subscribe to postgres_changes. Instead this trigger broadcasts a
-- bare version counter on a public topic; on receipt the page calls
-- get_my_position() for its own numbers. The payload carries zero PII by
-- construction, so the public channel leaks nothing.
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_queue_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant_id uuid;
begin
  v_restaurant_id := coalesce(new.restaurant_id, old.restaurant_id);

  perform realtime.send(
    jsonb_build_object('v', extract(epoch from clock_timestamp())),
    'queue_changed',
    'queue:' || v_restaurant_id::text,
    false  -- public topic: anonymous customer pages subscribe to it
  );

  return null;
end;
$$;

create trigger queue_entries_broadcast
after insert or update or delete on public.queue_entries
for each row execute function public.broadcast_queue_change();
