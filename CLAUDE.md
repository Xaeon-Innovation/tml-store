# Project context — COD store template

## What this is and why
A reusable, near-zero-cost online store template for small clients. The first client is **TML Store** (Egypt), which sells framed wall art and multi-panel (3- and 5-panel) prints. The developer will reuse this template for other small businesses with the same needs.

Client constraints that drove every decision:
- Very low budget, no server, no hosting, no domain → static site + free tiers; the only real cost is the domain.
- **Payment is cash on delivery only.** No online payment integration. Customers send an "order request"; the owner calls to confirm and agree the delivery fee.
- Owner wants a **simple dashboard**: how many orders are completed per day/month and the revenue. Nothing complicated.

## Stack
- **React 19 + Vite 6** static site, two pages: the shop (`/index.html`) and the owner dashboard (`/admin/index.html`) — configured in `vite.config.js`.
- **Supabase** (free tier): Postgres + Row Level Security, Auth (owner login only), Storage (product photos, customer reference images), one Edge Function for order emails.
- **Cloudflare Pages** for hosting (build `npm run build`, output `dist`, env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- No router library: a tiny **hash router** (`src/lib/router.js`, links like `#/p/neon-shrine`) so it works on any static host without rewrites.

## Origin of the design
The UI was converted from design-tool prototypes (`MobileStore.dc.html`, `Main.dc.html`, `Admin.dc.html` — a `.dc.html` format that needs a proprietary runtime and isn't in this repo). The storefront CSS in `src/styles/store.css` is ported almost verbatim from that design: dark theme, Bodoni Moda display font, Geist / Geist Mono body. The original admin design had a product editor, collections editor and 6 order statuses; it was **deliberately simplified** at the client's request.

## Layout
```
src/config/store.config.js   ← THE file to edit per business (brand, currency, timezone, contact/WhatsApp,
                               regions, homepage copy, FAQ, product specs, feature switches)
src/config/demo-data.js      ← sample catalogue used in demo mode (same data as supabase/seed.sql)
src/lib/supabase.js          ← creates the client only if env vars exist; exports isDemo
src/lib/api.js               ← ALL data access. Every function has a Supabase path and a demo path
                               (demo = sample data + localStorage, any dashboard login accepted)
src/lib/format.js            ← money, timezone-aware day/month keys, statuses, validation, WhatsApp links
src/lib/router.js            ← hash router: useRoute(), navigate(), href()
src/storefront/              ← StoreApp.jsx (shell, bag drawer, mobile menu, toast, routing)
                               pages.jsx (Home, Catalogue, Product), forms.jsx (Checkout, Confirm, Custom, CustomDone)
                               shared.jsx (Art component, ProductCard, Field, icons, product helpers)
src/admin/AdminApp.jsx       ← Login, Overview (stat tiles + bar chart), Orders list/detail, Custom requests,
                               Products list/editor (photo upload, sizes & prices, show/feature, delete)
src/styles/store.css, admin.css
supabase/schema.sql          ← tables, RLS, RPC functions, trigger, storage buckets (idempotent, safe to re-run)
supabase/seed.sql            ← optional sample catalogue
supabase/functions/notify-owner/index.ts ← emails owner via Resend, triggered by a DB webhook
preview/shop.html, preview/dashboard.html ← single-file demo builds that open with a double-click
```

## Shop routes
`#/` home · `#/craft` home scrolled to craft section · `#/shop` and `#/shop/<collectionId>` · `#/p/<productId>` · `#/checkout` · `#/order/<ref>` confirmation · `#/custom` · `#/custom/<ref>`. Dashboard: `#/`, `#/orders`, `#/orders/<id>`, `#/requests`, `#/requests/<id>`, `#/products`, `#/products/new`, `#/products/<id>` (so `new` is a reserved product id).

## Data model (see supabase/schema.sql)
- `collections(id, name, intro, auto_multi, sort)` — `auto_multi=true` means "every product whose layout isn't single".
- `products(id, name, collection_id, layout 'single'|'three'|'five', description, images text[], art, sizes jsonb [{label,total,panels,price}], featured, visible, sort, created_at)`. `art` is a CSS colour placeholder used when `images` is empty. For multi-panel products ONE wide image is sliced across panels via CSS background-position (see `Art` in shared.jsx).
- `orders(id, ref, customer_name, phone, email, region, address, notes, items jsonb snapshot, subtotal, status, created_at, completed_at)`. Statuses: New → Confirmed → Shipped → Completed, plus Cancelled.
- `custom_requests(id, ref, name, phone, email, region, layout, size, description, image_paths, status New|Contacted|Quoted|Closed, created_at)`.
- `admins(user_id)` — who may use the dashboard. Products are edited in the dashboard's Products tab (added at the client's request after the first simplification); collections are still edited in the Supabase Table Editor.
- Product editor details: the id (link name) is auto-slugged from the name and locked after creation. Photos are downscaled in the browser (`shrinkImage` in api.js, 3000 px JPEG; 1200 px data URLs in demo mode) and uploaded to `product-images/<product-id>/<random>.jpg`. Photos removed on save, and all photos of a deleted product, are deleted from the bucket (best effort). In demo mode products live in localStorage (`demo_products_v1`), seeded from demo-data.js.

## Security decisions (keep these)
- Public can't insert into `orders`/`custom_requests` directly. They go through `place_order()` / `submit_custom_request()` (SECURITY DEFINER), which validate input, **compute prices from the products table** (browser prices are never trusted), clamp qty 1–10, max 20 lines, rate-limit (5 orders / 3 requests per phone per hour), and generate refs like `TML-261026-4821` (prefix from config, sanitised to 1–5 capitals).
- A trigger sets `completed_at` when the status becomes Completed, clears it otherwise, and blocks changing ref/items/subtotal/created_at on update.
- RLS: public reads visible products and all collections; only `is_admin()` users read/update orders, requests and reference images. Reference images bucket is private (signed URLs in the dashboard); product-images bucket is public.
- Honeypot field (`company`) on both forms. The README says to disable public sign-ups in Supabase Auth.

## Dashboard metrics
Revenue = sum of `subtotal` for orders with status Completed, bucketed by `completed_at` in `config.timezone` (Africa/Cairo). Delivery fees aren't included (agreed by phone). Tiles: completed today, revenue today, completed this month, revenue this month. Chart: last 14 days or last 6 months, revenue or order count. It loads orders from the last 6 months, refreshes every 60 s and on window focus.

## Gotchas
- CSS resets use `:where(.tml) …` / `:where(.adm) …` so they have zero specificity. Without that, `.tml button{padding:0}` overrode `.btn` padding (a bug inherited from the design). Keep resets inside `:where()`.
- The homepage `.reveal` sections use scroll-driven animations (`animation-timeline: view()`), so they look blank in full-page screenshots until scrolled. That's expected.
- Opening the root `index.html` directly from disk shows a blank page (it's the Vite source). Use `npm run dev`, or the files in `preview/`.
- `preview/*.html` are generated builds in demo mode. Regenerate them after UI changes (bundle each entry as an IIFE with CSS inlined, Supabase env empty).
- Checkout clears the bag 50 ms *after* navigating to the confirmation page, so the form doesn't flash "bag empty".

## Verified so far
- End-to-end in demo mode at 1440px and 390px: browse → product → add to bag → validation errors → order placed → confirmation; custom request; dashboard login → stats → order detail → status changes → stats update. No console errors.
- `schema.sql` applied twice to Postgres 16 with Supabase-like stubs (roles, auth.uid(), storage tables). RPC validation, price computation, rate limit, RLS for anon / non-admin / admin, the completed_at trigger and storage policies all behaved correctly.
- 2026-10-26: `npm install` + `vite build` pass. Connected to the real Supabase project (`.env` uses `VITE_` names; Supabase's dashboard shows `NEXT_PUBLIC_` ones, which Vite ignores). Against it: tables, RLS (anon can't read or insert orders) and `place_order` (computes prices server-side, ignores a sent price) all verified.
- 2026-10-26: Products page verified end-to-end in demo mode with headless Chrome: list, validation, auto link name, photo upload + resize, add, duplicate id rejected, shows in shop, edit, hide, delete. No console errors.
- **Not yet verified:** the Products page against the live database (needs the owner login; the RLS policies for it already exist in schema.sql), and the email Edge Function.
- `preview/*.html` predate the Products page and haven't been regenerated.

## Possible next steps
- Run `npm install && npm run build` and fix anything Vite-specific.
- Connect a real Supabase project and test the live paths in `api.js`.
- Fill real TML content in `store.config.js` (contact, WhatsApp, socials, specs) and upload product photos.
- If the client asks: a collections editor in the dashboard, delivery fees per region, Arabic/RTL support, Cloudflare Turnstile on the forms.
