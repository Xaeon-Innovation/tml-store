# Cash-on-delivery store template

A small online shop plus an owner dashboard, made to cost nothing to run except a domain name.

- **Shop** (`/`): collections, product pages, bag, order request with cash on delivery, custom-piece requests with photo upload.
- **Dashboard** (`/admin/`): orders and revenue for today and this month, a daily/monthly chart, the order list with status updates, and custom requests.
- **Stack:** React + Vite (static site) · Supabase free tier (database, owner login, image storage) · Cloudflare Pages (hosting).

It runs in **demo mode** until you connect Supabase: sample products, sample orders saved in your browser, and a dashboard that accepts any login. Good for showing a client before anything is set up.

---

## 1. Run it on your computer

Needs [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Open the address it prints. The dashboard is at `/admin/`.

## 2. Make it a new business — edit one file

Everything business-specific is in **`src/config/store.config.js`**: name and logo text, currency, timezone, contact and WhatsApp number, social links, delivery areas, homepage text, FAQ, and feature switches:

| Switch | What it does |
|---|---|
| `features.customOrders` | Custom request form in the shop and its tab in the dashboard |
| `features.whatsappConfirm` | “Confirm on WhatsApp” button after an order (needs `contact.whatsapp`) |
| `features.multiPanel` | Three/five-panel layouts and filters. Turn **off** for an ordinary shop where every product is a single item |

Colours and fonts live in `src/styles/store.css` (tokens at the top of the `.tml` block). Products are **not** in the code — they live in the database (step 3). For demo mode they come from `src/config/demo-data.js`.

## 3. Connect the database (Supabase, free)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste all of `supabase/schema.sql` → **Run**. (Optional: run `supabase/seed.sql` to load the sample catalogue.)
3. **Project Settings → API**: copy the *Project URL* and the *anon public* key. Copy `.env.example` to `.env` and paste them in:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. **Create the owner login.** Authentication → Users → *Add user* → enter the owner's email and a password (tick *Auto confirm*). Then in the SQL Editor:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'owner@example.com';
   ```
5. **Turn off public sign-ups.** Authentication → Sign In / Providers → disable *Allow new users to sign up*. Only accounts you add can open the dashboard.

Restart `npm run dev` — the “Demo mode” badge disappears and orders now go to the database.

**Security, already handled in `schema.sql`:** visitors can only read visible products and submit orders/requests through two database functions. Prices are worked out in the database from the products table, so they can't be changed from the browser. At most 5 orders per phone number per hour. Only accounts in `admins` can see orders, customers or uploaded images.

## 4. Adding and editing products

The owner manages products in the dashboard: **Products** tab → *Add product*, or click a product to edit it. The form covers name, collection, arrangement (single / three / five panels), description, photos, sizes and prices, position in the shop, *Show in the shop* and *Feature on the homepage*.

- **Photos** upload straight to the `product-images` storage bucket. Big phone photos are scaled down to 3000 px on the long side first. The first photo is the main one. For three/five-panel products, upload the **whole** artwork as one wide photo; the site splits it across the panels.
- The **link name** (e.g. `neon-shrine`, used in `/p/neon-shrine`) is filled in from the name and can't be changed after the product is created.
- **Sizes:** click a standard size (30 × 40, 40 × 60, 50 × 70 … for single frames; matching totals for 3- and 5-panel pieces) to add it with the dimensions filled in, then type the price. Any size can be edited or added by hand.
- **Custom sizes:** tick *Customers can ask for a custom size* and the product page offers a "Custom size" choice where the customer types width × height (10–600 cm). Those orders arrive marked **Needs price**: call the customer, agree the price, and enter it on the order (*Agreed price → Save price*). The order subtotal, and the revenue once it's Completed, then include it.
- Removing a photo or deleting a product also deletes its files from storage. Past orders keep their own copy of names and prices, so deleting a product doesn't change them. To take a product down for a while, untick *Show in the shop* instead.

- **In stock:** untick it when a piece sells out. It stays in the shop marked *Sold out* (moved to the end of the catalogue), can't be added to the bag, and the database refuses orders for it. Anyone who already had it in their bag sees it marked sold out and it's left out of their order.

**Collections:** dashboard → **Collections** tab → *Add collection* (name, optional description, position). Then put products in it from each product's *Collection* field. Every collection with products gets a card on the homepage automatically. Deleting a collection keeps its products; they're just no longer in a collection.

**Homepage hero:** dashboard → **Homepage** tab. Edit the two title lines and the sentence under them, and choose the picture: a product hanging on the wall, or your own photo (e.g. a real room). The *Featured piece* is also shown in the "On the wall" card next to the buttons.

**Our craft (homepage section):** dashboard → **Our craft** tab. Edit the heading and introduction, add up to 8 details (title, description, optional small detail, photo), reorder or remove them, or untick *Show this section* to hide it and its menu link. Changes are live as soon as they're saved. Until the first save, the shop shows the copy in `store.config.js → home.craft`.

Products can also be edited in **Supabase → Table Editor → products**; the columns are:

| Column | Example |
|---|---|
| `id` | `neon-shrine` — lowercase with dashes; becomes the page link |
| `name`, `description` | shown on the product page |
| `collection_id` | an `id` from the `collections` table |
| `layout` | `single`, `three` or `five` |
| `sizes` | `[{"label":"Medium","total":"150 × 75 cm","panels":"3 × (38 × 60 cm)","price":2600}]` |
| `images` | `{https://…/photo1.jpg, https://…/photo2.jpg}` — first is the main picture |
| `featured` | shows on the homepage |
| `visible` | untick to hide without deleting |
| `allow_custom` | customers may ask for their own width × height |
| `in_stock` | untick when sold out |

The order of products follows `sort` (small numbers first).

## 5. Put it online (Cloudflare Workers, free)

The shop uses real page addresses (`/p/neon-shrine`) for search engines, plus a small Worker (`worker/index.js`, configured in `wrangler.jsonc`) that gives each page its own title, description and structured data. Cloudflare runs both.

1. Push this folder to a GitHub repository.
2. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → pick the repo. The project name must match `"name"` in `wrangler.jsonc` (`tml-store`); change one or the other for a new client.
3. Build command `npm run build`, deploy command `npx wrangler deploy` (the defaults).
4. **Settings → Build → Variables and secrets**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. They are needed while building, not at runtime. Without them the live site shows *Demo mode*.
5. **Settings → Domains & Routes**: enable `workers.dev` for a free address, and/or add the client's domain (buy it through Cloudflare Registrar or anywhere).

Every push to GitHub redeploys the site. Products and orders live in Supabase, so changing them never needs a redeploy.

Other hosts (Netlify, shared hosting…) can serve `dist/` too, but they must send `index.html` for unknown paths, and the per-page SEO, sitemap.xml and robots.txt come from the Worker, so they'd be missing.

## Search engines & AI search

- Titles, descriptions, Arabic keywords and the Arabic line in the footer are in `store.config.js → seo`. Product pages use each product's name, description and prices automatically.
- When the domain is live, set `seo.siteUrl` (e.g. `https://tmlstore.com`) and push. Search engines are then told that's the main address, and the spare `workers.dev` address is kept out of results.
- **Google Search Console:** add the domain (verify by DNS, or paste the HTML-tag code into `seo.googleVerification`), then **Sitemaps → add** `sitemap.xml`.
- **Bing Webmaster Tools:** import the site from Google Search Console, or add it and paste the meta-tag code into `seo.bingVerification`; submit `https://<domain>/sitemap.xml`. Bing also feeds ChatGPT search and Copilot.
- Generated automatically, always up to date (cached ~5 minutes): `/sitemap.xml` (every collection and product, with photos), `/robots.txt` (everything allowed except the dashboard and checkout), `/llms.txt` (a plain summary of the shop and its products for AI assistants).

## 6. Order emails (optional)

Sends the owner an email for every new order or custom request.

1. **Resend.** Make a free account at [resend.com](https://resend.com) → **API Keys → Create API key** (permission *Sending access*). Copy the `re_...` key.
   Without your own domain, Resend only delivers to the email address you signed up with, so sign up with the owner's email. Once the shop has a domain, verify it in Resend (**Domains**) and set `FROM_EMAIL` to send to any address.
2. **Deploy the function** (all in the Supabase website, no install needed). **Edge Functions → Deploy a new function → Via Editor**. Name it `notify-owner`, replace the sample code with all of `supabase/functions/notify-owner/index.ts`, and deploy. Then open the function's **Details** and turn **off** *Verify JWT* (*Enforce JWT verification*). The function checks its own secret instead.
   *(With the [Supabase CLI](https://supabase.com/docs/guides/cli) instead: `supabase login`, `supabase link --project-ref <ref>`, `supabase functions deploy notify-owner --no-verify-jwt`.)*
3. **Secrets.** **Edge Functions → Secrets**, add:
   | Name | Value |
   |---|---|
   | `RESEND_API_KEY` | the `re_...` key |
   | `OWNER_EMAIL` | where the emails go (the Resend sign-up email, until you verify a domain) |
   | `WEBHOOK_SECRET` | any long random text, e.g. from a password generator |
   | `STORE_NAME` | `TML Store` |
   | `DASHBOARD_URL` | optional, e.g. `https://yourshop.com/admin/` |
   | `FROM_EMAIL` | optional, only after verifying a domain, e.g. `TML Store <orders@yourshop.com>` |
4. **Webhooks.** **Database → Webhooks → Create a new hook**: name `order_email`, table `orders`, event *Insert*, type *HTTP Request*, method POST, URL `https://<project-ref>.supabase.co/functions/v1/notify-owner`, add the HTTP header `x-webhook-secret` = the same `WEBHOOK_SECRET`. Create a second one the same way for the table `custom_requests`.
5. **Test.** Place an order in the shop. The email should arrive within a few seconds. If not, look at **Edge Functions → notify-owner → Logs**: `401` means the webhook header doesn't match `WEBHOOK_SECRET`; `Email failed 403` usually means Resend refused the address (see step 1).

## 7. How the dashboard counts

- **Orders completed / revenue** count an order on the day it's marked **Completed** (in the timezone from the config). Mark an order Completed once it's delivered and the cash is collected.
- **Revenue** is the order subtotal; delivery fees are agreed by phone and aren't included.
- Cancelled orders never count.

## Good to know

- Supabase can pause free projects that have had no activity for a while. A shop with regular visitors normally stays active; if it's paused, it's restored from the Supabase dashboard. Check Supabase's current free-plan terms before launch.
- Shop links are real paths (`/p/neon-shrine`); old `#/p/…` links redirect automatically. The dashboard keeps `#/…` links and is never indexed.
- To start a new client: copy the folder, edit `store.config.js`, create a new Supabase project, and repeat steps 3–5.
