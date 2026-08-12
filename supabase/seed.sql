-- Local development seed. Loaded only by `supabase db reset` against the local
-- stack — it is never applied to a hosted project, and the credentials below are
-- deliberately worthless outside a machine you already control.
--
-- Without this you would have to sign up through the UI, then hand-write SQL to
-- promote yourself to super admin before you could approve your own restaurant.
-- This gets you to a working dashboard on the first `npm run dev`.
--
--   email     owner@tablewise.test
--   password  tablewise123
--
-- ---------------------------------------------------------------------------
-- IMPORTANT: the coordinates below are a PLACEHOLDER (Gateway of India, Mumbai).
-- The join flow refuses anyone further than geofence_radius_m away, so until you
-- replace them you must either sit at that spot or spoof your location — in
-- Chrome, DevTools -> ⋮ -> More tools -> Sensors -> Location -> Other.
-- ---------------------------------------------------------------------------

-- Fixed ids so the seed is idempotent and the QR URL stays stable across resets.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '11111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'owner@tablewise.test',
  crypt('tablewise123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(), now()
)
on conflict (id) do nothing;

-- GoTrue looks the account up through identities, not just auth.users; without
-- this row the password grant fails with "invalid credentials".
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"owner@tablewise.test","email_verified":true}'::jsonb,
  'email',
  now(), now(), now()
)
on conflict (provider, provider_id) do nothing;

-- Super admin, so /admin is reachable and you can approve the other restaurants
-- you create through the signup form.
insert into public.profiles (user_id, full_name, phone, is_super_admin)
values (
  '11111111-1111-4111-8111-111111111111',
  'Local Owner', '+910000000000', true
)
on conflict (user_id) do update set is_super_admin = true;

-- Already 'approved': the whole point is to skip the approval round trip.
insert into public.restaurants (
  id, slug, name, address, lat, lng, geofence_radius_m,
  qr_token, timezone, status, is_queue_open
)
values (
  '22222222-2222-4222-8222-222222222222',
  'demo-kitchen',
  'Demo Kitchen',
  'Apollo Bandar, Colaba, Mumbai',
  18.9219841, 72.8346543,   -- PLACEHOLDER — see the note at the top of this file
  100,
  'localdevtoken00000000000000000000',
  'Asia/Kolkata',
  'approved',
  true
)
on conflict (id) do nothing;

insert into public.restaurant_members (restaurant_id, user_id, role)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'owner'
)
on conflict (restaurant_id, user_id) do nothing;
