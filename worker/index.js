// Cloudflare Worker in front of the static site (see wrangler.jsonc).
// Only page URLs and /sitemap.xml, /robots.txt, /llms.txt reach this code;
// scripts, styles, images and the dashboard are served straight from dist/.
//
// For each shop page it sends index.html with that page's title, description,
// link-preview tags, structured data (schema.org) and a plain-HTML copy of the
// content, so Google, Bing and AI search see real content even without running
// JavaScript. The catalogue is read from Supabase and cached for a few minutes,
// so new products show up without a redeploy.
import config from '../src/config/store.config.js';
import { headTags, llmsTxt, pageMeta, parsePath, robotsTxt, sitemapXml } from '../src/lib/seo.js';

const CACHE_SECONDS = 300;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);
    const origin = (config.seo.siteUrl || url.origin).replace(/\/+$/, '');
    // once the real domain is set, keep the spare *.workers.dev address out of search results
    const spareHost = !!config.seo.siteUrl && url.origin !== origin;
    const path = url.pathname;

    if (path === '/robots.txt') return text(spareHost ? 'User-agent: *\nDisallow: /\n' : robotsTxt(origin), 'text/plain');
    if (path === '/sitemap.xml' || path === '/llms.txt') {
      const data = await catalog(env, ctx, url);
      if (path === '/llms.txt') return text(llmsTxt(data, config, origin), 'text/markdown');
      if (!data) return new Response('Catalogue unavailable, try again shortly.', { status: 503, headers: { 'Retry-After': '300' } });
      return text(sitemapXml(data, config, origin), 'application/xml');
    }

    const page = await env.ASSETS.fetch(new Request(url.origin + '/'));
    if (!page.ok) return page;
    const m = pageMeta(parsePath(path), await catalog(env, ctx, url), config, origin);
    const tags = headTags(m, config);
    const out = new HTMLRewriter()
      .on('[data-seo]', { element(el) { el.remove(); } })
      .on('head', { element(el) { el.append(tags, { html: true }); } })
      .on('#root', { element(el) { el.setInnerContent(m.body, { html: true }); } })
      .transform(page);
    const headers = new Headers(out.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    headers.delete('ETag');
    if (spareHost || m.noindex) headers.set('X-Robots-Tag', 'noindex');
    return new Response(request.method === 'HEAD' ? null : out.body, { status: m.status, headers });
  },
};

function text(body, type) {
  return new Response(body, { headers: { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'public, max-age=' + CACHE_SECONDS } });
}

// { collections, products, content } (visible products only), or null if Supabase can't be reached.
async function catalog(env, ctx, url) {
  const key = new Request(url.origin + '/__catalog-v1');
  const hit = await caches.default.match(key);
  if (hit) return hit.json();
  try {
    const site = await (await env.ASSETS.fetch(new Request(url.origin + '/site.json'))).json();
    if (!site.supabaseUrl || !site.anonKey) return null;
    const get = (q) => fetch(site.supabaseUrl + '/rest/v1/' + q, { headers: { apikey: site.anonKey } })
      .then((r) => { if (!r.ok) throw new Error('Supabase ' + r.status); return r.json(); });
    const [collections, products, content] = await Promise.all([
      get('collections?select=*&order=sort'), get('products?select=*&visible=eq.true&order=sort'),
      get('site_content?select=key,value').catch(() => []), // optional: dashboard-edited homepage sections
    ]);
    const data = { collections, products, content: Object.fromEntries(content.map((r) => [r.key, r.value])) };
    ctx.waitUntil(caches.default.put(key, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + CACHE_SECONDS } })));
    return data;
  } catch (e) {
    console.error('catalog', e.message);
    return null;
  }
}
