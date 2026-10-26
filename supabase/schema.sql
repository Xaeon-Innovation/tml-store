-- =====================================================================
--  COD store template — database setup
--  Run this whole file once in Supabase → SQL Editor → New query → Run.
--  Safe to re-run: it only creates what's missing and replaces functions.
-- =====================================================================

-- ---------------------------------------------------------------- tables
create table if not exists public.collections (
  id          text primary key,
  name        text not null,
  intro       text not null default '',
  auto_multi  boolean not null default false,  -- true = automatically holds every 3/5-panel product
  sort        int not null default 0
);

create table if not exists public.products (
  id            text primary key,                -- used in the URL: /#/p/<id>  (lowercase-with-dashes)
  name          text not null,
  collection_id text references public.collections(id) on update cascade on delete set null,
  layout        text not null default 'single' check (layout in ('single','three','five')),
  description   text not null default '',
  images        text[] not null default '{}',    -- image URLs; first one is the main picture
  art           text not null default 'neon',    -- colour placeholder used when there are no images
  sizes         jsonb not null default '[]'      -- [{"label":"Medium","total":"150 × 75 cm","panels":"…","price":3900}]
                check (jsonb_typeof(sizes) = 'array'),
  featured      boolean not null default false,
  visible       boolean not null default true,
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null unique,
  customer_name text not null,
  phone         text not null,
  email         text not null default '',
  region        text not null,
  address       text not null,
  notes         text not null default '',
  items         jsonb not null,                  -- snapshot of what was ordered, with prices at the time
  subtotal      numeric(12,2) not null,
  status        text not null default 'New' check (status in ('New','Confirmed','Shipped','Completed','Cancelled')),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index if not exists orders_created_idx   on public.orders (created_at desc);
create index if not exists orders_completed_idx on public.orders (completed_at desc) where completed_at is not null;
create index if not exists orders_phone_idx     on public.orders (phone, created_at desc);

create table if not exists public.custom_requests (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique,
  name        text not null,
  phone       text not null,
  email       text not null default '',
  region      text not null,
  layout      text not null default 'unsure',
  size        text not null default '',
  description text not null,
  image_paths text[] not null default '{}',      -- files in the private "references" bucket
  status      text not null default 'New' check (status in ('New','Contacted','Quoted','Closed')),
  created_at  timestamptz not null default now()
);
create index if not exists custom_requests_created_idx on public.custom_requests (created_at desc);

-- Who can open the dashboard. Add the owner after creating their login (see README).
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- completed_at is set by the database, so revenue dates can't be faked by a wrong phone clock
create or replace function public.orders_set_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'Completed' and (old.status is distinct from 'Completed' or new.completed_at is null) then
    new.completed_at := coalesce(old.completed_at, now());
  elsif new.status <> 'Completed' then
    new.completed_at := null;
  end if;
  -- only the status may change from the dashboard; keep everything else as submitted
  new.ref := old.ref; new.items := old.items; new.subtotal := old.subtotal; new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists orders_completed_at on public.orders;
create trigger orders_completed_at before update on public.orders
  for each row execute function public.orders_set_completed_at();

create or replace function public._clean_prefix(p text, fallback text)
returns text language sql immutable as $$
  select case when p ~ '^[A-Z]{1,5}$' then p else fallback end;
$$;

-- ---------------------------------------------------------------- place an order (called by the shop)
-- Prices come from the products table, never from the browser.
create or replace function public.place_order(p_customer jsonb, p_items jsonb, p_ref_prefix text default 'ORD')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c_name text := btrim(coalesce(p_customer->>'name', ''));
  c_phone text := btrim(coalesce(p_customer->>'phone', ''));
  c_email text := btrim(coalesce(p_customer->>'email', ''));
  c_region text := btrim(coalesce(p_customer->>'region', ''));
  c_address text := btrim(coalesce(p_customer->>'address', ''));
  c_notes text := btrim(coalesce(p_customer->>'notes', ''));
  it jsonb; prod record; sz jsonb; q int; idx int; price numeric;
  lines jsonb := '[]'::jsonb; total numeric := 0; new_ref text; tries int := 0;
begin
  if length(c_name) < 1 or length(c_name) > 120 then raise exception 'invalid_name'; end if;
  if regexp_replace(c_phone, '[\s\-().]', '', 'g') !~ '^\+?\d{8,15}$' then raise exception 'invalid_phone'; end if;
  if length(c_email) > 200 or (c_email <> '' and c_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') then raise exception 'invalid_email'; end if;
  if length(c_region) < 1 or length(c_region) > 80 then raise exception 'invalid_region'; end if;
  if length(c_address) < 6 or length(c_address) > 500 then raise exception 'invalid_address'; end if;
  if length(c_notes) > 1000 then raise exception 'invalid_notes'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then raise exception 'invalid_items'; end if;

  -- simple flood protection: at most 5 orders per phone number per hour
  if (select count(*) from public.orders where phone = c_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'invalid_rate_limited';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    q := least(greatest(coalesce((it->>'qty')::int, 1), 1), 10);
    idx := coalesce((it->>'size_index')::int, 0);
    select * into prod from public.products where id = it->>'product_id' and visible;
    if not found then raise exception 'invalid_product'; end if;
    sz := prod.sizes -> idx;
    if sz is null then raise exception 'invalid_size'; end if;
    price := (sz->>'price')::numeric;
    lines := lines || jsonb_build_object('product_id', prod.id, 'name', prod.name, 'size_label', coalesce(sz->>'label', ''),
      'size_total', coalesce(sz->>'total', ''), 'unit_price', price, 'qty', q, 'line_total', price * q);
    total := total + price * q;
  end loop;

  loop
    new_ref := public._clean_prefix(p_ref_prefix, 'ORD') || '-' || to_char(now() at time zone 'utc', 'YYMMDD') || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.orders where ref = new_ref);
    tries := tries + 1; if tries > 20 then raise exception 'ref_failed'; end if;
  end loop;

  insert into public.orders (ref, customer_name, phone, email, region, address, notes, items, subtotal)
  values (new_ref, c_name, c_phone, c_email, c_region, c_address, c_notes, lines, total);
  return jsonb_build_object('ref', new_ref, 'subtotal', total);
end $$;

-- ---------------------------------------------------------------- custom request (called by the shop)
create or replace function public.submit_custom_request(p_request jsonb, p_ref_prefix text default 'CR')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r_name text := btrim(coalesce(p_request->>'name', ''));
  r_phone text := btrim(coalesce(p_request->>'phone', ''));
  r_email text := btrim(coalesce(p_request->>'email', ''));
  r_region text := btrim(coalesce(p_request->>'region', ''));
  r_layout text := coalesce(p_request->>'layout', 'unsure');
  r_size text := btrim(coalesce(p_request->>'size', ''));
  r_desc text := btrim(coalesce(p_request->>'description', ''));
  paths text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_request->'image_paths', '[]'::jsonb))), '{}');
  pth text; new_ref text; tries int := 0;
begin
  if length(r_name) < 1 or length(r_name) > 120 then raise exception 'invalid_name'; end if;
  if regexp_replace(r_phone, '[\s\-().]', '', 'g') !~ '^\+?\d{8,15}$' then raise exception 'invalid_phone'; end if;
  if length(r_email) > 200 or (r_email <> '' and r_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') then raise exception 'invalid_email'; end if;
  if length(r_region) < 1 or length(r_region) > 80 then raise exception 'invalid_region'; end if;
  if r_layout not in ('single','three','five','unsure') then raise exception 'invalid_layout'; end if;
  if length(r_size) > 200 then raise exception 'invalid_size'; end if;
  if length(r_desc) < 10 or length(r_desc) > 3000 then raise exception 'invalid_description'; end if;
  if array_length(paths, 1) > 6 then raise exception 'invalid_images'; end if;
  foreach pth in array paths loop
    if pth !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,60}$' then raise exception 'invalid_images'; end if;
  end loop;
  if (select count(*) from public.custom_requests where phone = r_phone and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'invalid_rate_limited';
  end if;

  loop
    new_ref := public._clean_prefix(p_ref_prefix, 'CR') || '-' || to_char(now() at time zone 'utc', 'YYMMDD') || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.custom_requests where ref = new_ref);
    tries := tries + 1; if tries > 20 then raise exception 'ref_failed'; end if;
  end loop;

  insert into public.custom_requests (ref, name, phone, email, region, layout, size, description, image_paths)
  values (new_ref, r_name, r_phone, r_email, r_region, r_layout, r_size, r_desc, paths);
  return jsonb_build_object('ref', new_ref);
end $$;

grant execute on function public.place_order(jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.submit_custom_request(jsonb, text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------- security (row level security)
alter table public.collections     enable row level security;
alter table public.products        enable row level security;
alter table public.orders          enable row level security;
alter table public.custom_requests enable row level security;
alter table public.admins          enable row level security;

grant select on public.collections, public.products to anon, authenticated;
grant insert, update, delete on public.collections, public.products to authenticated;
grant select, update on public.orders, public.custom_requests to authenticated;
grant select on public.admins to authenticated;

drop policy if exists "collections are public"      on public.collections;
drop policy if exists "admins manage collections"   on public.collections;
drop policy if exists "visible products are public" on public.products;
drop policy if exists "admins manage products"      on public.products;
drop policy if exists "admins read orders"          on public.orders;
drop policy if exists "admins update orders"        on public.orders;
drop policy if exists "admins read requests"        on public.custom_requests;
drop policy if exists "admins update requests"      on public.custom_requests;
drop policy if exists "see own admin row"           on public.admins;

create policy "collections are public"      on public.collections for select using (true);
create policy "admins manage collections"   on public.collections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "visible products are public" on public.products for select using (visible or public.is_admin());
create policy "admins manage products"      on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- No insert policy on orders/requests: the public can only add them through the two functions above.
create policy "admins read orders"          on public.orders for select to authenticated using (public.is_admin());
create policy "admins update orders"        on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read requests"        on public.custom_requests for select to authenticated using (public.is_admin());
create policy "admins update requests"      on public.custom_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "see own admin row"           on public.admins for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- file storage
-- references:     customers' images for custom requests (private, upload-only for the public)
-- product-images: your product photos (public)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('references', 'references', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "anyone can upload references"  on storage.objects;
drop policy if exists "admins read references"        on storage.objects;
drop policy if exists "admins manage product images"  on storage.objects;
create policy "anyone can upload references" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'references');
create policy "admins read references" on storage.objects for select to authenticated
  using (bucket_id = 'references' and public.is_admin());
create policy "admins manage product images" on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
