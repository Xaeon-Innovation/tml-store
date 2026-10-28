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
  id            text primary key,                -- used in the URL: /p/<id>  (lowercase-with-dashes)
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
-- added later; "add column if not exists" upgrades databases created with an older copy of this file
alter table public.products add column if not exists allow_custom boolean not null default false;  -- customers may ask for their own width × height
alter table public.products add column if not exists updated_at timestamptz not null default now(); -- sitemap.xml lastmod
alter table public.products add column if not exists in_stock boolean not null default true;      -- false = shown as "Sold out", can't be ordered

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

-- Homepage sections the owner edits in the dashboard, one row per section.
-- key 'craft' = the "Our craft" section: {show, title, intro, details:[{title, copy, spec, image}]}.
-- key 'hero'  = the top of the homepage: {heroTitle, heroTitleItalic, heroLead, heroProductId, heroImage}.
-- Missing rows fall back to the copy in store.config.js.
create table if not exists public.site_content (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Customer reviews. Sent from the homepage through submit_review(); the owner
-- publishes them in the dashboard. Only Published ones are public.
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  region     text not null default '',
  rating     int  not null check (rating between 1 and 5),
  body       text not null,
  status     text not null default 'Pending' check (status in ('Pending','Published','Hidden')),
  created_at timestamptz not null default now()
);
create index if not exists reviews_created_idx on public.reviews (created_at desc);

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
  -- only the status may change from the dashboard; keep everything else as submitted.
  -- Exception: price_custom_line() below may set the price of a custom-size line.
  new.ref := old.ref; new.created_at := old.created_at;
  if coalesce(current_setting('app.price_edit', true), '') <> 'on' then
    new.items := old.items; new.subtotal := old.subtotal;
  end if;
  return new;
end $$;
drop trigger if exists orders_completed_at on public.orders;
create trigger orders_completed_at before update on public.orders
  for each row execute function public.orders_set_completed_at();

create or replace function public.products_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.products_touch();

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
  it jsonb; prod record; sz jsonb; q int; idx int; price numeric; w text; h text;
  lines jsonb := '[]'::jsonb; total numeric := 0; new_ref text; tries int := 0; pending boolean := false;
begin
  if length(c_name) < 1 or length(c_name) > 120 then raise exception 'invalid_name'; end if;
  if regexp_replace(c_phone, '[\s\-().]', '', 'g') !~ '^\+?\d{8,15}$' then raise exception 'invalid_phone'; end if;
  if length(c_email) > 200 or (c_email <> '' and c_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') then raise exception 'invalid_email'; end if;
  if length(c_region) < 1 or length(c_region) > 80 then raise exception 'invalid_region'; end if;
  if length(c_address) < 6 or length(c_address) > 500 then raise exception 'invalid_address'; end if;
  if length(c_notes) > 1000 then raise exception 'invalid_notes'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then raise exception 'invalid_items'; end if;

  -- simple flood protection: at most 5 orders per phone number per hour
  -- (digits only, so "010 1234 5678" and "01012345678" count as the same number)
  if (select count(*) from public.orders where regexp_replace(phone, '\D', '', 'g') = regexp_replace(c_phone, '\D', '', 'g')
      and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'invalid_rate_limited';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    q := least(greatest(coalesce((it->>'qty')::int, 1), 1), 10);
    idx := coalesce((it->>'size_index')::int, 0);
    select * into prod from public.products where id = it->>'product_id' and visible;
    if not found then raise exception 'invalid_product'; end if;
    if not prod.in_stock then raise exception 'invalid_out_of_stock'; end if;
    -- custom size: {"custom": {"width": 120, "height": 60}} in cm. No price yet; the owner
    -- agrees it by phone and enters it with price_custom_line().
    if it ? 'custom' then
      if not prod.allow_custom then raise exception 'invalid_size'; end if;
      w := it->'custom'->>'width'; h := it->'custom'->>'height';
      if coalesce(w, '') !~ '^\d{1,3}(\.\d)?$' or coalesce(h, '') !~ '^\d{1,3}(\.\d)?$' then raise exception 'invalid_size'; end if;
      if w::numeric not between 10 and 600 or h::numeric not between 10 and 600 then raise exception 'invalid_size'; end if;
      lines := lines || jsonb_build_object('product_id', prod.id, 'name', prod.name, 'size_label', 'Custom size',
        'size_total', trim_scale(w::numeric)::text || ' × ' || trim_scale(h::numeric)::text || ' cm', 'unit_price', null, 'qty', q, 'line_total', null, 'custom', true);
      pending := true;
      continue;
    end if;
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
  return jsonb_build_object('ref', new_ref, 'subtotal', total, 'pending_price', pending);
end $$;

-- ---------------------------------------------------------------- price a custom size (dashboard)
-- Sets the agreed unit price of custom-size line `p_line` (0-based) and recalculates the subtotal.
create or replace function public.price_custom_line(p_order uuid, p_line int, p_unit_price numeric)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders; line jsonb; new_items jsonb;
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  if p_unit_price is null or p_unit_price <= 0 or p_unit_price > 10000000 then raise exception 'invalid_price'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  line := o.items -> p_line;
  if line is null or not coalesce((line->>'custom')::boolean, false) then raise exception 'invalid_line'; end if;
  new_items := jsonb_set(o.items, array[p_line::text],
    line || jsonb_build_object('unit_price', round(p_unit_price, 2), 'line_total', round(p_unit_price, 2) * (line->>'qty')::int));
  perform set_config('app.price_edit', 'on', true);
  update public.orders set items = new_items,
    subtotal = (select coalesce(sum((x->>'line_total')::numeric), 0) from jsonb_array_elements(new_items) x)
  where id = p_order returning * into o;
  perform set_config('app.price_edit', 'off', true);
  return o;
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
  if (select count(*) from public.custom_requests where regexp_replace(phone, '\D', '', 'g') = regexp_replace(r_phone, '\D', '', 'g')
      and created_at > now() - interval '1 hour') >= 3 then
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

-- p_review: {name, region, rating, body}. Always saved as Pending.
create or replace function public.submit_review(p_review jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  r_name text := btrim(coalesce(p_review->>'name', ''));
  r_region text := btrim(coalesce(p_review->>'region', ''));
  r_rating text := coalesce(p_review->>'rating', '');
  r_body text := btrim(coalesce(p_review->>'body', ''));
begin
  if length(r_name) < 1 or length(r_name) > 60 then raise exception 'invalid_name'; end if;
  if length(r_region) > 80 then raise exception 'invalid_region'; end if;
  if r_rating !~ '^[1-5]$' then raise exception 'invalid_rating'; end if;
  if length(r_body) < 10 or length(r_body) > 600 then raise exception 'invalid_body'; end if;
  -- no phone to rate-limit by, so: no repeats, and at most 20 waiting reviews from the last hour.
  -- A repeat is quietly accepted, so the form can't be used to find out what others wrote.
  if exists (select 1 from public.reviews where body = r_body) then return; end if;
  if (select count(*) from public.reviews where status = 'Pending' and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'invalid_rate_limited';
  end if;
  insert into public.reviews (name, region, rating, body) values (r_name, r_region, r_rating::int, r_body);
end $$;

grant execute on function public.place_order(jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.submit_review(jsonb) to anon, authenticated;
grant execute on function public.submit_custom_request(jsonb, text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
revoke execute on function public.price_custom_line(uuid, int, numeric) from public, anon;
grant execute on function public.price_custom_line(uuid, int, numeric) to authenticated;

-- ---------------------------------------------------------------- security (row level security)
alter table public.collections     enable row level security;
alter table public.products        enable row level security;
alter table public.orders          enable row level security;
alter table public.custom_requests enable row level security;
alter table public.admins          enable row level security;
alter table public.site_content    enable row level security;
alter table public.reviews         enable row level security;

-- Supabase grants the public role write access to every table by default; RLS already blocks it,
-- but take it away too so a future policy mistake can't open a table to the public.
revoke insert, update, delete, truncate on public.collections, public.products, public.orders, public.custom_requests,
  public.site_content, public.admins, public.reviews from anon;
grant select on public.collections, public.products, public.site_content to anon, authenticated;
grant insert, update, delete on public.collections, public.products, public.site_content to authenticated;
grant select, update on public.orders, public.custom_requests to authenticated;
grant select on public.admins to authenticated;
grant select on public.reviews to anon, authenticated;
grant update, delete on public.reviews to authenticated;

drop policy if exists "collections are public"      on public.collections;
drop policy if exists "admins manage collections"   on public.collections;
drop policy if exists "visible products are public" on public.products;
drop policy if exists "admins manage products"      on public.products;
drop policy if exists "admins read orders"          on public.orders;
drop policy if exists "admins update orders"        on public.orders;
drop policy if exists "admins read requests"        on public.custom_requests;
drop policy if exists "admins update requests"      on public.custom_requests;
drop policy if exists "see own admin row"           on public.admins;
drop policy if exists "site content is public"      on public.site_content;
drop policy if exists "admins manage site content"  on public.site_content;
drop policy if exists "published reviews are public" on public.reviews;
drop policy if exists "admins manage reviews"       on public.reviews;

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
create policy "site content is public"      on public.site_content for select using (true);
create policy "admins manage site content"  on public.site_content for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- No insert policy on reviews either: the public adds them through submit_review().
create policy "published reviews are public" on public.reviews for select using (status = 'Published' or public.is_admin());
create policy "admins manage reviews"       on public.reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());

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
-- only "<random id>/<file name>", the shape the custom-request form uses (submit_custom_request checks the same)
create policy "anyone can upload references" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'references' and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,60}$');
create policy "admins read references" on storage.objects for select to authenticated
  using (bucket_id = 'references' and public.is_admin());
create policy "admins manage product images" on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
