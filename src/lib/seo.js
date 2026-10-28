// Search-engine and AI-search text for the shop, kept in one place. Used by:
//   - the build (vite.config.js): base tags baked into index.html
//   - the Cloudflare Worker (worker/index.js): per-page tags, pre-rendered page
//     content for crawlers that don't run JavaScript, sitemap.xml, robots.txt, llms.txt
//   - the shop (StoreApp.jsx): title/description/canonical while browsing
// Keep it free of browser-only and Node-only APIs.
import { LAYOUTS } from './format.js';

const AR_LAYOUT = { single: 'برواز', three: 'تابلوه ٣ قطع', five: 'تابلوه ٥ قطع' };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
const priceOf = (config, n) => config.currency + ' ' + Number(n || 0).toLocaleString('en-US');
const pricesOf = (p) => (p.sizes || []).map((s) => Number(s.price) || 0).filter((n) => n > 0);
const fromPrice = (config, p) => { const ps = pricesOf(p); return ps.length ? (ps.length > 1 ? 'from ' : '') + priceOf(config, Math.min(...ps)) : ''; };
const isHttp = (u) => /^https?:\/\//.test(u || '');
const inCollection = (p, c) => (c.auto_multi ? p.layout !== 'single' : p.collection_id === c.id);

export function parsePath(pathname) {
  const parts = String(pathname || '').split('?')[0].split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch (e) { return s; } });
  return { name: parts[0] || 'home', arg: parts[1] || '', extra: parts.length > 2 };
}

// ------------------------------------------------------------------ per-page tags
// data: { collections, products } or null when the catalogue couldn't be loaded.
export function pageMeta(route, data, config, origin) {
  const S = config.seo, brand = config.brand.fullName;
  const products = data ? data.products.filter((p) => p.visible !== false) : [];
  const collections = data ? data.collections : [];
  const coverImage = S.ogImage || (products.find((p) => p.featured && isHttp((p.images || [])[0])) || products.find((p) => isHttp((p.images || [])[0])) || { images: [''] }).images[0];
  const m = { title: S.title, description: S.description, canonical: origin + '/', image: coverImage, type: 'website', noindex: false, status: 200, jsonLd: [storeLd(config, origin), websiteLd(config, origin)], body: '' };
  const notFound = () => Object.assign(m, { title: 'Page not found | ' + brand, canonical: '', noindex: true, status: 404, jsonLd: [], body: pre(`<h1>Page not found</h1><p><a href="/">${esc(brand)}</a></p>`) });
  const crumbs = (list) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: list.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })) });
  const r = route.name;
  if (route.extra) return notFound();

  if (r === 'home' || r === 'craft') {
    const faq = (config.home.faq || []).length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: config.home.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) } : null;
    if (faq) m.jsonLd.push(faq);
    const featured = products.filter((p) => p.featured).slice(0, 12);
    const H = { ...config.home, ...((data && data.content && data.content.hero) || {}) };
    if (isHttp(H.heroImage)) m.image = H.heroImage;
    m.body = pre(`<h1>${esc(brand)} — ${esc(H.heroTitle)} ${esc(H.heroTitleItalic)}</h1><p>${esc(H.heroLead)}</p>
<p>${esc(S.description)}</p><p lang="ar" dir="rtl">${esc(S.arabicLine)}</p>
<nav><a href="/shop">All wall art</a> · ${config.features.customOrders ? '<a href="/custom">Custom orders</a>' : ''}</nav>
${collections.length ? '<h2>Collections</h2><ul>' + collections.map((c) => `<li><a href="/shop/${encodeURIComponent(c.id)}">${esc(c.name)}</a> — ${esc(c.intro)}</li>`).join('') + '</ul>' : ''}
${featured.length ? '<h2>Selected pieces</h2>' + productList(featured, config) : ''}
${faq ? '<h2>Good to know</h2>' + config.home.faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('') : ''}`);
    return m;
  }

  if (r === 'shop') {
    const c = route.arg ? collections.find((x) => x.id === route.arg) : null;
    if (route.arg && data && !c) return notFound();
    const items = c ? products.filter((p) => inCollection(p, c)) : products;
    const url = origin + '/shop' + (c ? '/' + encodeURIComponent(c.id) : '');
    Object.assign(m, {
      title: c ? `${c.name} — wall art & frames | ${c.name} براويز وتابلوهات | ${brand}` : `All wall art & frames | كل البراويز والتابلوهات | ${brand}`,
      description: clip((c ? c.intro + ' ' : 'Framed wall art and multi-panel pieces. ') + S.arabicShort, 300),
      canonical: url,
    });
    m.jsonLd.push(crumbs([[brand, origin + '/'], ['Collections', origin + '/shop']].concat(c ? [[c.name, url]] : [])));
    if (items.length) m.jsonLd.push({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: origin + '/p/' + encodeURIComponent(p.id), name: p.name })) });
    m.body = pre(`<nav><a href="/">${esc(brand)}</a> / <a href="/shop">Collections</a></nav><h1>${esc(c ? c.name : 'All wall art & frames')}</h1>
<p>${esc(c ? c.intro : 'The full catalogue.')}</p><p lang="ar" dir="rtl">${esc(S.arabicShort)}</p>
${collections.length ? '<ul>' + collections.map((x) => `<li><a href="/shop/${encodeURIComponent(x.id)}">${esc(x.name)}</a></li>`).join('') + '</ul>' : ''}${productList(items, config)}`);
    return m;
  }

  if (r === 'p') {
    const p = products.find((x) => x.id === route.arg);
    if (!p) return data ? notFound() : Object.assign(m, { canonical: origin + '/p/' + encodeURIComponent(route.arg) });
    const lay = LAYOUTS[p.layout] || LAYOUTS.single;
    const coll = collections.find((c) => c.id === p.collection_id);
    const url = origin + '/p/' + encodeURIComponent(p.id);
    const imgs = (p.images || []).filter(isHttp);
    const ps = pricesOf(p);
    const from = fromPrice(config, p);
    Object.assign(m, {
      title: `${p.name} — ${lay.short} wall art | ${AR_LAYOUT[p.layout] || 'برواز'} ${p.name} | ${brand}`,
      description: clip(`${p.name}: ${lay.label.toLowerCase()} wall art${from ? ', ' + from : ''}. ${p.description} ${S.arabicShort}`, 300),
      canonical: url, image: imgs[0] || m.image, type: 'product',
    });
    const offer = { '@type': ps.length > 1 ? 'AggregateOffer' : 'Offer', priceCurrency: config.currency, availability: 'https://schema.org/' + (p.in_stock === false ? 'OutOfStock' : 'InStock'), url, seller: { '@type': 'Organization', name: brand } };
    if (ps.length > 1) Object.assign(offer, { lowPrice: Math.min(...ps), highPrice: Math.max(...ps), offerCount: ps.length });
    else if (ps.length) offer.price = ps[0];
    m.jsonLd.push({ '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description || undefined, sku: p.id, url, image: imgs.length ? imgs : undefined,
      brand: { '@type': 'Brand', name: brand }, category: 'Home & Garden > Decor > Artwork', ...(ps.length ? { offers: offer } : {}) });
    m.jsonLd.push(crumbs([[brand, origin + '/'], ['Collections', origin + '/shop']].concat(coll ? [[coll.name, origin + '/shop/' + encodeURIComponent(coll.id)]] : []).concat([[p.name, url]])));
    m.body = pre(`<nav><a href="/">${esc(brand)}</a> / <a href="/shop">Collections</a>${coll ? ` / <a href="/shop/${encodeURIComponent(coll.id)}">${esc(coll.name)}</a>` : ''}</nav>
<h1>${esc(p.name)}</h1><p>${esc(lay.label)}${coll ? ' · ' + esc(coll.name) : ''}${from ? ' · ' + esc(from) : ''}${p.in_stock === false ? ' · Sold out' : ''}</p>
${imgs[0] ? `<img src="${esc(imgs[0])}" alt="${esc(p.name + ', ' + lay.label.toLowerCase())}" width="600" style="max-width:100%;height:auto">` : ''}
${p.description ? `<p>${esc(p.description)}</p>` : ''}
${(p.sizes || []).length ? '<h2>Sizes</h2><ul>' + p.sizes.map((s) => `<li>${esc([s.label, s.total].filter(Boolean).join(' — '))}: ${esc(priceOf(config, s.price))}</li>`).join('') + '</ul>' : ''}
${p.allow_custom ? '<p>Custom sizes available — we confirm the price by phone. <span lang="ar" dir="rtl">متاح مقاس حسب الطلب.</span></p>' : ''}
<p>${esc(config.deliveryNote)}</p><p lang="ar" dir="rtl">${esc(S.arabicShort)}</p>`);
    return m;
  }

  if (r === 'custom' && !route.arg && config.features.customOrders) {
    Object.assign(m, { title: `Custom wall art & frames made to order | تابلوهات وبراويز حسب الطلب | ${brand}`, description: clip('Send a reference image, your size and arrangement — single frames, 3-panel or 5-panel pieces made for your wall. ' + S.arabicShort, 300), canonical: origin + '/custom' });
    m.body = pre(`<h1>Request a custom piece</h1><p>Send a reference image, the size or panel arrangement you have in mind, and a few words about the idea. We review every request and contact you with pricing.</p><p lang="ar" dir="rtl">اطلب برواز أو تابلوه بتصميمك ومقاسك — هنتواصل معاك بالسعر.</p>`);
    return m;
  }
  if (['checkout', 'order', 'custom'].includes(r)) return Object.assign(m, { title: (r === 'checkout' ? 'Order request' : 'Thank you') + ' | ' + brand, canonical: '', noindex: true, jsonLd: [] });
  return notFound();
}

function productList(list, config) {
  if (!list.length) return '';
  return '<ul>' + list.map((p) => `<li><a href="/p/${encodeURIComponent(p.id)}">${esc(p.name)}</a> — ${esc((LAYOUTS[p.layout] || LAYOUTS.single).short)}${fromPrice(config, p) ? ', ' + esc(fromPrice(config, p)) : ''}</li>`).join('') + '</ul>';
}
// Plain-HTML version of the page for crawlers that don't run JavaScript. The shop
// replaces it as soon as it loads; it only fades in if the script never runs.
const pre = (html) => `<div class="tml-pre">${html}</div>`;

function storeLd(config, origin) {
  const c = config.contact;
  return { '@context': 'https://schema.org', '@type': 'OnlineStore', name: config.brand.fullName, alternateName: config.brand.alternateNames, url: origin + '/', description: config.seo.description,
    areaServed: { '@type': 'Country', name: 'Egypt' }, currenciesAccepted: config.currency, paymentAccepted: 'Cash on delivery',
    ...(c.phone ? { telephone: c.phone } : {}), ...(c.email ? { email: c.email } : {}),
    ...(config.social.some((s) => s.url) ? { sameAs: config.social.filter((s) => s.url).map((s) => s.url) } : {}) };
}
function websiteLd(config, origin) {
  return { '@context': 'https://schema.org', '@type': 'WebSite', name: config.brand.fullName, alternateName: config.brand.alternateNames, url: origin + '/', inLanguage: ['en', 'ar'] };
}

// Everything that goes in <head>. Each tag carries data-seo so the Worker can swap them per page.
export function headTags(m, config) {
  const S = config.seo, abs = isHttp(m.canonical);
  const t = [
    `<title data-seo>${esc(m.title)}</title>`,
    `<meta data-seo name="description" content="${esc(m.description)}">`,
    `<meta data-seo name="keywords" content="${esc(S.keywords.join(', '))}">`,
    `<meta data-seo name="robots" content="${m.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}">`,
    abs ? `<link data-seo rel="canonical" href="${esc(m.canonical)}">` : '',
    `<meta data-seo property="og:type" content="${m.type}">`,
    `<meta data-seo property="og:site_name" content="${esc(config.brand.fullName)}">`,
    `<meta data-seo property="og:title" content="${esc(m.title)}">`,
    `<meta data-seo property="og:description" content="${esc(clip(m.description, 200))}">`,
    abs ? `<meta data-seo property="og:url" content="${esc(m.canonical)}">` : '',
    `<meta data-seo property="og:locale" content="en_US"><meta data-seo property="og:locale:alternate" content="ar_EG">`,
    isHttp(m.image) ? `<meta data-seo property="og:image" content="${esc(m.image)}"><meta data-seo name="twitter:image" content="${esc(m.image)}">` : '',
    `<meta data-seo name="twitter:card" content="${isHttp(m.image) ? 'summary_large_image' : 'summary'}">`,
    `<meta data-seo name="twitter:title" content="${esc(m.title)}"><meta data-seo name="twitter:description" content="${esc(clip(m.description, 200))}">`,
    S.googleVerification ? `<meta data-seo name="google-site-verification" content="${esc(S.googleVerification)}">` : '',
    S.bingVerification ? `<meta data-seo name="msvalidate.01" content="${esc(S.bingVerification)}">` : '',
    m.jsonLd.length ? `<script data-seo type="application/ld+json">${JSON.stringify(m.jsonLd.length === 1 ? m.jsonLd[0] : m.jsonLd).replace(/</g, '\\u003c')}</script>` : '',
  ];
  return t.filter(Boolean).join('\n  ');
}
// Base tags for the built index.html (the Worker replaces them per page).
export function siteHead(config) {
  const origin = (config.seo.siteUrl || '').replace(/\/+$/, '');
  return headTags(pageMeta({ name: 'home', arg: '' }, null, config, origin), config)
    + '\n  <style>.tml-pre{max-width:960px;margin:0 auto;padding:32px 16px;color:#F4F1EB;font:16px/1.6 system-ui,sans-serif;opacity:0;animation:tml-pre 0s 2.5s forwards}.tml-pre a{color:inherit}@keyframes tml-pre{to{opacity:1}}</style>';
}

// ------------------------------------------------------------------ crawler files
export function robotsTxt(origin) {
  return `# Every search engine and AI assistant (Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot, …) is welcome.
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /checkout
Disallow: /order/

Sitemap: ${origin}/sitemap.xml
`;
}

export function sitemapXml(data, config, origin) {
  const day = (iso) => (iso ? String(iso).slice(0, 10) : '');
  const products = data.products.filter((p) => p.visible !== false);
  const newest = products.reduce((a, p) => (day(p.updated_at || p.created_at) > a ? day(p.updated_at || p.created_at) : a), '');
  const url = (loc, lastmod, extra = '') => `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}${extra}</url>`;
  const rows = [url(origin + '/', newest), url(origin + '/shop', newest)]
    .concat(data.collections.map((c) => url(origin + '/shop/' + encodeURIComponent(c.id), newest)))
    .concat(config.features.customOrders ? [url(origin + '/custom', '')] : [])
    .concat(products.map((p) => url(origin + '/p/' + encodeURIComponent(p.id), day(p.updated_at || p.created_at),
      (p.images || []).filter(isHttp).slice(0, 10).map((i) => `<image:image><image:loc>${esc(i)}</image:loc><image:title>${esc(p.name)}</image:title></image:image>`).join(''))));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${rows.join('\n')}
</urlset>
`;
}

// llms.txt: a plain summary for AI assistants and AI search (see llmstxt.org).
export function llmsTxt(data, config, origin) {
  const S = config.seo, c = config.contact, products = data ? data.products.filter((p) => p.visible !== false) : [];
  const lines = [
    `# ${config.brand.fullName} (${config.brand.alternateNames.join(', ')})`, '',
    `> ${S.description}`, '', S.arabicLine, '',
    '## How buying works',
    '- Online shop based in Egypt; delivers to every governorate.',
    '- Payment is cash on delivery only. Nothing is paid online.',
    '- After an order request the shop calls the customer to confirm the order and the delivery fee.',
    `- Prices are in ${config.currency}.`,
    config.features.customOrders ? `- Custom pieces and custom sizes on request: ${origin}/custom` : '',
    c.phone ? `- Phone: ${c.phone}` : '', c.whatsapp ? `- WhatsApp: https://wa.me/${String(c.whatsapp).replace(/\D/g, '')}` : '', c.email ? `- Email: ${[c.email, c.email2].filter(Boolean).join(', ')}` : '',
    '', '## Collections',
    ...(data ? data.collections.map((x) => `- [${x.name}](${origin}/shop/${encodeURIComponent(x.id)}): ${x.intro}`) : [`- [All wall art](${origin}/shop)`]),
  ];
  if (products.length) {
    lines.push('', '## Products');
    products.forEach((p) => lines.push(`- [${p.name}](${origin}/p/${encodeURIComponent(p.id)}): ${(LAYOUTS[p.layout] || LAYOUTS.single).label}${fromPrice(config, p) ? ', ' + fromPrice(config, p) : ''}. ${clip(p.description, 160)}`));
  }
  return lines.filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n') + '\n';
}
