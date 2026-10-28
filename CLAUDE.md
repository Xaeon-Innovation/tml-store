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
- **Cloudflare Workers** (static assets + a small Worker), deployed by Workers Builds from GitHub (`Xaeon-Innovation/tml-store`) on every push. Config in `wrangler.jsonc`: assets from `dist`, SPA fallback, and `run_worker_first` for page URLs + `/sitemap.xml`, `/robots.txt`, `/llms.txt`. Build variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` must be set under Settings → Build (not runtime vars). wrangler is not a project dependency; Cloudflare's `npx wrangler deploy` fetches it.
- No router library: `src/lib/router.js` has two modes. The **shop uses real paths** (`/p/neon-shrine`; `setRouterMode('path')` in storefront/main.jsx; plain `<a href="/…">` links are intercepted by `interceptLinks` on the `.tml` root; old `#/…` links redirect). The **dashboard keeps hash routes** (`#/orders`). Switched from hash to paths for SEO on 2026-10-26.
- **SEO**: `src/lib/seo.js` builds titles, descriptions, canonical, Open Graph, JSON-LD (OnlineStore, WebSite, FAQPage, Product with AggregateOffer, BreadcrumbList, ItemList), a plain-HTML copy of each page, sitemap.xml (with image entries), robots.txt and llms.txt. Used by vite.config.js (base tags into index.html at `<!--seo-->`, all tagged `data-seo`; also writes `dist/site.json` with the public Supabase URL/key), by `worker/index.js` (swaps the `data-seo` tags per URL with HTMLRewriter, fills `#root` with the plain-HTML copy, 404 + noindex for unknown products/collections, catalogue read from Supabase REST and cached 5 min) and by StoreApp (title/description/canonical while browsing). Copy and Arabic keywords live in `store.config.js → seo`; set `seo.siteUrl` once the domain is live (the workers.dev host then gets noindex).

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
src/lib/router.js            ← router (path mode for the shop, hash mode for the dashboard)
src/lib/seo.js               ← all SEO / AI-search output (see Stack)
worker/index.js, wrangler.jsonc ← Cloudflare Worker: per-page SEO tags, sitemap.xml, robots.txt, llms.txt
src/storefront/              ← StoreApp.jsx (shell, bag drawer, mobile menu, toast, routing)
                               pages.jsx (Home, Catalogue, Product), forms.jsx (Checkout, Confirm, Custom, CustomDone)
                               shared.jsx (Art component, ProductCard, Field, icons, product helpers)
src/admin/AdminApp.jsx       ← Login, Overview (stat tiles + bar chart), Orders list/detail, Custom requests,
                               Products list/editor (photo upload, sizes & prices, show/feature, delete)
src/styles/store.css, admin.css
supabase/schema.sql          ← tables, RLS, RPC functions, trigger, storage buckets (idempotent, safe to re-run)
supabase/seed.sql            ← optional sample catalogue
supabase/functions/notify-owner/index.ts ← emails owner via Resend, triggered by a DB webhook
```

## Shop routes
`/` home · `/craft` home scrolled to craft section · `/shop` and `/shop/<collectionId>` · `/p/<productId>` · `/checkout` · `/order/<ref>` confirmation · `/custom` · `/custom/<ref>`. A new shop route also needs adding to `run_worker_first` in wrangler.jsonc and to `pageMeta` in seo.js. Dashboard: `#/`, `#/orders`, `#/orders/<id>`, `#/requests`, `#/requests/<id>`, `#/products`, `#/products/new`, `#/products/<id>` (so `new` is a reserved product id).

## Data model (see supabase/schema.sql)
- `collections(id, name, intro, auto_multi, sort)` — `auto_multi=true` means "every product whose layout isn't single".
- `products(id, name, collection_id, layout 'single'|'three'|'five', description, images text[], art, sizes jsonb [{label,total,panels,price}], featured, visible, allow_custom, sort, created_at, updated_at)`. `updated_at` is set by a trigger (sitemap lastmod). `art` is a CSS colour placeholder used when `images` is empty. For multi-panel products ONE wide image is sliced across panels via CSS background-position (see `Art` in shared.jsx).
- `orders(id, ref, customer_name, phone, email, region, address, notes, items jsonb snapshot, subtotal, status, created_at, completed_at)`. Statuses: New → Confirmed → Shipped → Completed, plus Cancelled.
- **Custom sizes** (client request 2026-10-26): if `products.allow_custom`, the product page offers "Custom size" (width × height, 10–600 cm). `place_order` accepts `{product_id, qty, custom:{width,height}}` and stores a line with `custom:true, unit_price:null, line_total:null`; the subtotal excludes it. The owner phones the customer, then enters the price on the order page, which calls `price_custom_line(order, line, unit_price)` (admin only) and recalculates the subtotal. The orders trigger allows items/subtotal changes only while that function sets `app.price_edit=on`. Bag entries for custom sizes are `{productId, custom:{w,h}, qty}`.
- The product editor has one-click standard sizes per layout (`SIZE_PRESETS` in AdminApp.jsx).
- `products.in_stock` (2026-10-27): false = "Sold out" (shown, sorted last, not orderable; `place_order` raises `invalid_out_of_stock`; bag keeps such lines visible but excludes them from count/subtotal/order; JSON-LD says OutOfStock).
- Collections are created/edited/deleted in the dashboard's Collections tab (`CollectionsEditor`/`CollectionForm`; RLS already allowed admins). Homepage collection cards are automatic: one per visible collection with products; `config.home.collectionCards` now only pins which product pictures a card.
- `site_content` key `hero` = `{heroTitle, heroTitleItalic, heroLead, heroProductId, heroImage, heroImageAlt}`, same keys as `config.home`, which it overrides (Home merges them). Edited in the dashboard's Homepage tab (`HeroEditor`): a product on the wall, or an uploaded photo (`product-images/hero/`, 2400 px). The Worker reads site_content too, so the homepage's pre-rendered text and og:image follow it.
- `site_content(key, value jsonb, updated_at)`: owner-edited homepage sections (public read, admin write). Key `craft` = `{show, title, intro, details:[{title, copy, spec, image}]}`, edited in the dashboard's "Our craft" tab (`CraftEditor`, added 2026-10-27). `fetchCatalog` returns it as `content`; StoreApp uses `content.craft || config.home.craft`, and a missing table falls back to the config. Craft photos go to `product-images/craft/` (1600 px).
- `custom_requests(id, ref, name, phone, email, region, layout, size, description, image_paths, status New|Contacted|Quoted|Closed, created_at)`.
- `reviews(id, name, region, rating 1–5, body, status Pending|Published|Hidden, created_at)` (2026-10-28, `config.features.reviews`). Public sends them through `submit_review()` (SECURITY DEFINER: lengths, no duplicate text, max 20 Pending per hour across everyone — no phone is stored, so there's nothing per-person to limit by; honeypot `company`). RLS: public reads only Published. Homepage `Reviews` section in pages.jsx: a moving row of cards (rendered twice, CSS `rv-scroll` moves the track by -50%; pauses on hover and with a Pause button; with reduced motion the copies are hidden and the row scrolls by hand; under 3 reviews it doesn't move) + "Write a review" form. Dashboard Reviews tab (badge = Pending): Publish / Hide / Delete. `fetchCatalog` returns the newest 30 published as `reviews`; a missing table falls back to `[]`. Demo reviews in localStorage `demo_reviews_v1`.
- `admins(user_id)` — who may use the dashboard. Products are edited in the dashboard's Products tab (added at the client's request after the first simplification); collections are still edited in the Supabase Table Editor.
- Product editor details: the id (link name) is auto-slugged from the name and locked after creation. Photos are downscaled in the browser (`shrinkImage` in api.js, 3000 px JPEG; 1200 px data URLs in demo mode) and uploaded to `product-images/<product-id>/<random>.jpg`. Photos removed on save, and all photos of a deleted product, are deleted from the bucket (best effort). In demo mode products live in localStorage (`demo_products_v1`), seeded from demo-data.js.

## Security decisions (keep these)
- Public can't insert into `orders`/`custom_requests` directly. They go through `place_order()` / `submit_custom_request()` (SECURITY DEFINER), which validate input, **compute prices from the products table** (browser prices are never trusted), clamp qty 1–10, max 20 lines, rate-limit (5 orders / 3 requests per phone per hour), and generate refs like `TML-261026-4821` (prefix from config, sanitised to 1–5 capitals).
- A trigger sets `completed_at` when the status becomes Completed, clears it otherwise, and blocks changing ref/items/subtotal/created_at on update.
- RLS: public reads visible products and all collections; only `is_admin()` users read/update orders, requests and reference images. Reference images bucket is private (signed URLs in the dashboard); product-images bucket is public.
- Review 2026-10-28: rate limits compare phone digits only; `anon` has insert/update/delete/truncate revoked on all our tables (Supabase grants them by default; RLS already blocked them, verified live: 0 rows touched); reference uploads must be named `<uuid>/<file>`; a duplicate review is quietly accepted (no "already exists" leak); `public/_headers` + the Worker send nosniff / Referrer-Policy / X-Frame-Options (dashboard: DENY + frame-ancestors 'none' + noindex). Live Supabase checked: public sign-ups disabled.
- Honeypot field (`company`) on both forms. The README says to disable public sign-ups in Supabase Auth.

## Dashboard metrics
Revenue = sum of `subtotal` for orders with status Completed, bucketed by `completed_at` in `config.timezone` (Africa/Cairo). Delivery fees aren't included (agreed by phone). Tiles: completed today, revenue today, completed this month, revenue this month. Chart: last 14 days or last 6 months, revenue or order count. It loads orders from the last 6 months, refreshes every 60 s and on window focus.

## Gotchas
- CSS resets use `:where(.tml) …` / `:where(.adm) …` so they have zero specificity. Without that, `.tml button{padding:0}` overrode `.btn` padding (a bug inherited from the design). Keep resets inside `:where()`.
- The homepage `.reveal` sections use scroll-driven animations (`animation-timeline: view()`), so they look blank in full-page screenshots until scrolled. That's expected.
- Opening the root `index.html` directly from disk shows a blank page (it's the Vite source). Use `npm run dev`, or the files in `preview/`.
- Corners: storefront radii come from `--r` (10px, controls) and `--r-lg` (16px, boxes) on `.tml`; the client asked for softer corners. Artwork panels stay square.
- TML = "The Mother **Lode**" (not Lord). The logo picture is `config.brand.logo` (`public/tml-logo.png`, white monogram cropped/shrunk from the client's 3316 px `tmlLOGO.png`), shown by `LogoInner` in StoreApp before the text mark. Footer contact column shows icon links (WhatsApp, call, `contact.email` + `email2`, `location`); Follow column shows icon-only links whose icon is picked by `social[].label` (Instagram/Facebook/TikTok).
- "Website by Xaeon" credit (public/logo.png → https://xaeons.com/) is in the shop footer and on the dashboard login. The logo is white, so on the light dashboard it sits on a dark badge.
- Local `wrangler dev` failed on this Windows machine (cf.json fetch timeout, fixed with `CLOUDFLARE_CF_FETCH_ENABLED=false`; then `spawn EBUSY` on workerd, and `npm i wrangler` hung). `wrangler deploy --dry-run` works and validates the config. The Worker was tested in Node with stand-ins for ASSETS/caches/HTMLRewriter.
- In PowerShell, `$env:X=''` deletes the variable, so it can't force demo mode; use a Vite config with an empty `envDir` instead.
- Checkout clears the bag 50 ms *after* navigating to the confirmation page, so the form doesn't flash "bag empty".

## Verified so far
- End-to-end in demo mode at 1440px and 390px: browse → product → add to bag → validation errors → order placed → confirmation; custom request; dashboard login → stats → order detail → status changes → stats update. No console errors.
- `schema.sql` applied twice to Postgres 16 with Supabase-like stubs (roles, auth.uid(), storage tables). RPC validation, price computation, rate limit, RLS for anon / non-admin / admin, the completed_at trigger and storage policies all behaved correctly.
- 2026-10-26: `npm install` + `vite build` pass. Connected to the real Supabase project (`.env` uses `VITE_` names; Supabase's dashboard shows `NEXT_PUBLIC_` ones, which Vite ignores). Against it: tables, RLS (anon can't read or insert orders) and `place_order` (computes prices server-side, ignores a sent price) all verified.
- 2026-10-26: Products page verified end-to-end in demo mode with headless Chrome: list, validation, auto link name, photo upload + resize, add, duplicate id rejected, shows in shop, edit, hide, delete. No console errors.
- **Not yet verified:** the Products page against the live database (needs the owner login; the RLS policies for it already exist in schema.sql), and the email Edge Function.
- 2026-10-26: rounded corners, custom sizes (shop → bag → checkout → dashboard pricing → subtotal), size quick-picks, Xaeon credit and path routing (old #/ links, back button, no full reloads) verified in demo mode with headless Chrome. Worker output verified against the real Supabase catalogue: per-page tags, JSON-LD, 404s, sitemap.xml, robots.txt, llms.txt.
- 2026-10-27: the live site (workers.dev) verified connected to Supabase: per-page titles, 404s, sitemap (14 URLs), robots.txt, dashboard. Our craft editor verified in demo mode (edit, photo, reorder, validation, save → homepage, hide → section and menu link gone, values kept after reload).

## Possible next steps
- Fill real TML content in `store.config.js` (contact, WhatsApp, socials, specs) and upload product photos.
- If the client asks: a collections editor in the dashboard, delivery fees per region, Arabic/RTL support, Cloudflare Turnstile on the forms.
