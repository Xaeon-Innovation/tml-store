import { useEffect, useMemo, useRef, useState } from 'react';
import config from '../config/store.config.js';
import { fetchCatalog, isDemo } from '../lib/api.js';
import { money, plural } from '../lib/format.js';
import { interceptLinks, navigate, useRoute } from '../lib/router.js';
import { pageMeta } from '../lib/seo.js';
import { Art, Icon, decorate, visibleCollections } from './shared.jsx';
import { Catalogue, Home, Product } from './pages.jsx';
import { Checkout, Confirm, Custom, CustomDone } from './forms.jsx';

const BAG_KEY = 'bag_v1';
function loadBag() { try { const b = JSON.parse(localStorage.getItem(BAG_KEY)); return Array.isArray(b) ? b : []; } catch (e) { return []; } }
// bag entry: { productId, sizeIdx, qty } or, for a custom size, { productId, custom: { w, h }, qty }
const bagKey = (b) => b.productId + '|' + (b.custom ? 'c' + b.custom.w + 'x' + b.custom.h : b.sizeIdx);
const customLabel = (c) => 'Custom size · ' + c.w + ' × ' + c.h + ' cm';

function setHead(selector, make, attr, value) {
  let el = document.head.querySelector(selector);
  if (!el) { el = make(); document.head.appendChild(el); }
  el.setAttribute(attr, value);
}

export default function StoreApp() {
  const route = useRoute();
  const [cat, setCat] = useState({ status: 'loading', collections: [], products: [] });
  const [bag, setBag] = useState(loadBag);
  const [bagOpen, setBagOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [bump, setBump] = useState(false);
  const bagClose = useRef(null), menuClose = useRef(null), lastFocus = useRef(null), toastT = useRef(), bumpT = useRef();

  const load = () => {
    setCat((c) => ({ ...c, status: 'loading' }));
    fetchCatalog().then((d) => setCat({ status: 'ready', ...d })).catch(() => setCat({ status: 'error', collections: [], products: [] }));
  };
  useEffect(load, []);
  useEffect(() => { try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch (e) { /* ignore */ } }, [bag]);
  useEffect(() => { document.documentElement.style.setProperty('--accent', config.theme.accent); }, []);
  // title, description and canonical for the current page (the Worker sends the same on first load)
  useEffect(() => {
    if (cat.status === 'loading') return;
    const m = pageMeta(route, cat.status === 'ready' ? cat : null, config, (config.seo.siteUrl || window.location.origin).replace(/\/+$/, ''));
    document.title = m.title;
    setHead('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }), 'content', m.description);
    setHead('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' }), 'content', m.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large');
    if (m.canonical) setHead('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', m.canonical);
    else document.head.querySelector('link[rel="canonical"]')?.remove();
  }, [route.name, route.arg, cat]);

  // route change: close layers and scroll to the top (or to the craft section)
  useEffect(() => {
    setBagOpen(false); setMenuOpen(false);
    if (route.name === 'craft') setTimeout(() => { const el = document.getElementById('craft'); if (el) el.scrollIntoView({ block: 'start' }); }, 60);
    else window.scrollTo(0, 0);
  }, [route.name, route.arg]);

  // focus handling for the bag drawer and the mobile menu
  const openLayer = (setter) => { lastFocus.current = document.activeElement; setToast(null); setter(true); };
  useEffect(() => { if (bagOpen) setTimeout(() => bagClose.current && bagClose.current.focus(), 60); }, [bagOpen]);
  useEffect(() => { if (menuOpen) setTimeout(() => menuClose.current && menuClose.current.focus(), 60); }, [menuOpen]);
  const closeLayer = (setter) => { setter(false); const el = lastFocus.current; if (el && document.contains(el)) el.focus({ preventScroll: true }); };
  useEffect(() => {
    document.body.style.overflow = bagOpen || menuOpen ? 'hidden' : '';
  }, [bagOpen, menuOpen]);

  const collections = cat.collections;
  // "Our craft": the owner's version from the dashboard, else the copy in store.config.js
  const craft = (cat.content && cat.content.craft) || config.home.craft;
  const products = useMemo(() => cat.products.map((p) => decorate(p, collections)), [cat.products, collections]);
  const byId = (id) => products.find((p) => p.id === id);

  // bag lines (skips products that are no longer available)
  // custom sizes have no price yet (unit null): the owner quotes it by phone
  const lines = bag.map((b) => {
    const p = byId(b.productId); if (!p) return null;
    const base = { key: bagKey(b), productId: p.id, qty: b.qty, product: { id: p.id, layout: p.layout, art: p.art, images: p.images }, name: p.name, lay: p.lay };
    if (b.custom) return p.allow_custom ? { ...base, custom: b.custom, sizeLabel: customLabel(b.custom), unit: null, lineTotal: 0 } : null;
    const s = p.sizes[b.sizeIdx]; if (!s) return null;
    return { ...base, sizeIdx: b.sizeIdx, sizeLabel: [s.label, s.total !== s.label ? s.total : ''].filter(Boolean).join(' · '), unit: Number(s.price), lineTotal: Number(s.price) * b.qty };
  }).filter(Boolean);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const hasCustom = lines.some((l) => l.custom);

  const addToBag = (p, sizeIdx, qty, custom) => {
    const entry = custom ? { productId: p.id, custom, qty } : { productId: p.id, sizeIdx, qty };
    setBag((cur) => {
      const i = cur.findIndex((b) => bagKey(b) === bagKey(entry));
      if (i < 0) return cur.concat([entry]);
      const n = cur.slice(); n[i] = { ...n[i], qty: Math.min(10, n[i].qty + qty) }; return n;
    });
    clearTimeout(toastT.current); clearTimeout(bumpT.current);
    setToast(p.name + (custom ? ' · ' + customLabel(custom) : p.sizes[sizeIdx] && p.sizes.length > 1 ? ' · ' + p.sizes[sizeIdx].label : '') + ' · Qty ' + qty); setBump(true);
    toastT.current = setTimeout(() => setToast(null), 4200);
    bumpT.current = setTimeout(() => setBump(false), 600);
  };
  const setQty = (key, d) => setBag((cur) => cur.map((b) => (bagKey(b) === key ? { ...b, qty: Math.max(1, Math.min(10, b.qty + d)) } : b)));
  const remove = (key) => { setBag((cur) => cur.filter((b) => bagKey(b) !== key)); setTimeout(() => bagClose.current && bagClose.current.focus(), 0); };

  const onPlaced = (o) => {
    try { sessionStorage.setItem('order_' + o.ref, JSON.stringify(o)); } catch (e) { /* ignore */ }
    navigate('order/' + encodeURIComponent(o.ref));
    setTimeout(() => setBag([]), 50); // after the page has switched, so the form doesn't flash "empty"

  };

  const r = route.name;
  const layerOpen = bagOpen || menuOpen;
  const navCls = (on) => 'nav-link' + (on ? ' is-cur' : '');
  const cols = visibleCollections(collections);

  let page;
  if (cat.status === 'loading' && ['home', 'craft', 'shop', 'p', 'checkout'].includes(r)) {
    page = <section className="wrap status-bar" aria-busy="true"><div className="skeleton" style={{ width: '100%', height: 320 }} /><p className="label">Loading…</p></section>;
  } else if (cat.status === 'error' && ['home', 'craft', 'shop', 'p', 'checkout'].includes(r)) {
    page = (
      <section className="wrap status-bar" role="alert">
        <p className="label">Connection problem</p>
        <h1 className="display h1">The shop couldn’t load.</h1>
        <p className="muted">Check your internet connection and try again.</p>
        <button className="btn btn-primary" type="button" onClick={load}>Try again</button>
      </section>
    );
  } else if (r === 'home' || r === 'craft') page = <Home products={products} collections={collections} craft={craft} />;
  else if (r === 'shop') page = <Catalogue products={products} collections={collections} collId={route.arg} />;
  else if (r === 'p') page = <Product product={byId(route.arg)} products={products} onAdd={addToBag} layerOpen={layerOpen} />;
  else if (r === 'checkout') page = <Checkout lines={lines} subtotal={subtotal} hasCustom={hasCustom} onPlaced={onPlaced} openBag={(e) => openLayer(setBagOpen)} />;
  else if (r === 'order' && route.arg) page = <Confirm refCode={route.arg} />;
  else if (r === 'custom' && config.features.customOrders) page = route.arg ? <CustomDone refCode={route.arg} /> : <Custom />;
  else {
    page = (
      <section className="wrap status-bar">
        <p className="label">404</p><h1 className="display h1">Page not found.</h1>
        <a className="btn btn-primary" href="/">Back to home</a>
      </section>
    );
  }

  return (
    <div className="tml" onClick={interceptLinks}>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); if (m) { m.setAttribute('tabindex', '-1'); m.focus(); } }}>Skip to content</a>
      <header className="hdr">
        <div className="wrap hdr-in">
          <a className="logo" href="/" aria-label={config.brand.fullName + ' — home'}><span className="logo-mark">{config.brand.mark}</span><span className="logo-sub">{config.brand.sub}</span></a>
          <nav className="nav" aria-label="Primary">
            <a className={navCls(r === 'shop' || r === 'p')} href="/shop" aria-current={r === 'shop' ? 'page' : undefined}>Collections</a>
            {craft && craft.show ? <a className="nav-link" href="/craft">Our Craft</a> : null}
            {config.features.customOrders ? <a className={navCls(r === 'custom')} href="/custom" aria-current={r === 'custom' ? 'page' : undefined}>Custom Orders</a> : null}
          </nav>
          <div className="hdr-actions">
            <button className="icon-btn" type="button" onClick={() => openLayer(setBagOpen)} aria-label={count ? 'Bag, ' + plural(count, 'item') : 'Bag, empty'} aria-haspopup="dialog">
              <Icon.bag /><span className={'bag-count' + (count ? '' : ' zero') + (bump ? ' bump' : '')} aria-hidden="true">{count}</span>
            </button>
            <button className="icon-btn menu-btn" type="button" onClick={() => openLayer(setMenuOpen)} aria-label="Open menu" aria-haspopup="dialog" aria-expanded={menuOpen}><Icon.menu /></button>
          </div>
        </div>
      </header>

      <main id="main">{page}</main>

      <footer className="ftr">
        <div className="wrap">
          <div className="ftr-grid">
            <div className="ftr-brand">
              <span className="logo"><span className="logo-mark">{config.brand.mark}</span><span className="logo-sub">{config.brand.sub}</span></span>
              <p>{config.brand.footerLine}</p>
              {config.seo.arabicLine ? <p className="ftr-ar" lang="ar" dir="rtl">{config.seo.arabicLine}</p> : null}
            </div>
            <ContactCol />
            {config.social.some((s) => s.url) ? (
              <div className="ftr-col"><h3>Follow</h3>{config.social.filter((s) => s.url).map((s) => <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>)}</div>
            ) : null}
            <div className="ftr-col">
              <h3>Shop</h3>
              <a href="/shop">All pieces</a>
              {config.features.customOrders ? <a href="/custom">Custom orders</a> : null}
            </div>
          </div>
          <div className="ftr-base">
            <span className="label">© {new Date().getFullYear()} {config.brand.fullName}</span>
            <span className="label">Prices in {config.currency} · Cash on delivery</span>
            <a className="made-by" href="https://xaeons.com/" target="_blank" rel="noopener">
              <span className="label">Website by</span><img src="/logo.png" alt="Xaeon" width="50" height="24" loading="lazy" />
            </a>
          </div>
        </div>
      </footer>

      <div className={'scrim' + (bagOpen ? ' on' : '')} onClick={() => closeLayer(setBagOpen)} aria-hidden="true" />

      <aside className={'drawer' + (bagOpen ? ' on' : '')} role="dialog" aria-modal="true" aria-labelledby="bag-h" onKeyDown={(e) => { if (e.key === 'Escape') closeLayer(setBagOpen); }}>
        <div className="drawer-head">
          <h2 id="bag-h" className="drawer-title">Your bag <span className="muted">({count})</span></h2>
          <button className="icon-btn" type="button" ref={bagClose} onClick={() => closeLayer(setBagOpen)} aria-label="Close bag"><Icon.close /></button>
        </div>
        <div className="drawer-body">
          {!lines.length ? (
            <div className="drawer-empty">
              <p className="display" style={{ fontSize: 30 }}>Your bag is empty.</p>
              <p className="muted">Explore the collections and add a piece you love.</p>
              <a className="btn btn-ghost" href="/shop" onClick={() => setBagOpen(false)}>Explore collections</a>
            </div>
          ) : (
            <ul>
              {lines.map((l) => (
                <li key={l.key} className="bag-line">
                  <span className="mini"><Art product={l.product} /></span>
                  <div className="bag-info">
                    <div className="bag-top"><span>{l.name}</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{l.custom ? 'Price by phone' : money(l.lineTotal)}</span></div>
                    <p className="bag-opts">{l.sizeLabel}</p>
                    <p className="bag-opts">{config.features.multiPanel ? l.lay.short + ' · ' : ''}{l.custom ? 'we call you with the price' : money(l.unit) + ' each'}</p>
                    <div className="bag-ctrl">
                      <div className="qty" role="group" aria-label={'Quantity for ' + l.name}>
                        <button type="button" onClick={() => setQty(l.key, -1)} disabled={l.qty <= 1} aria-label="Decrease quantity"><Icon.minus s={12} /></button>
                        <output>{l.qty}</output>
                        <button type="button" onClick={() => setQty(l.key, 1)} disabled={l.qty >= 10} aria-label="Increase quantity"><Icon.plus s={12} /></button>
                      </div>
                      <button className="rm" type="button" onClick={() => remove(l.key)} aria-label={'Remove ' + l.name + ' from bag'}>Remove</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {lines.length ? (
          <div className="drawer-foot">
            <div className="sum-tot" style={{ borderTop: 0, paddingTop: 0 }}><span>Subtotal{hasCustom ? ' + custom size' : ''}</span><strong style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{money(subtotal)}</strong></div>
            <p className="small muted">{hasCustom ? 'We call you with the price of the custom size. ' : ''}Delivery fee isn’t included — we confirm it with you by phone. You pay cash on delivery.</p>
            <a className="btn btn-primary btn-block" href="/checkout" onClick={() => setBagOpen(false)}>Continue to order request</a>
          </div>
        ) : null}
      </aside>

      <div className={'menu' + (menuOpen ? ' on' : '')} role="dialog" aria-modal="true" aria-label="Menu" onKeyDown={(e) => { if (e.key === 'Escape') closeLayer(setMenuOpen); }}>
        <div className="wrap hdr-in" style={{ borderBottom: '1px solid var(--line)' }}>
          <span className="logo"><span className="logo-mark">{config.brand.mark}</span><span className="logo-sub">{config.brand.sub}</span></span>
          <button className="icon-btn" type="button" ref={menuClose} onClick={() => closeLayer(setMenuOpen)} aria-label="Close menu"><Icon.close /></button>
        </div>
        <nav className="menu-nav" aria-label="Menu">
          <a className="menu-big" href="/shop">Collections</a>
          {craft && craft.show ? <a className="menu-big" href="/craft">Our Craft</a> : null}
          {config.features.customOrders ? <a className="menu-big" href="/custom">Custom Orders</a> : null}
        </nav>
        <div className="menu-sub">
          <p className="label" style={{ marginBottom: 6 }}>Browse</p>
          {cols.map((c) => <a key={c.id} href={'/shop/' + encodeURIComponent(c.id)}><span>{c.name}</span></a>)}
        </div>
      </div>

      <div className={'toast-wrap' + (r === 'p' && !layerOpen ? ' toast-with-bar' : '')} role="status" aria-live="polite">
        {toast ? (
          <div className="toast">
            <Icon.check s={20} />
            <div className="toast-txt"><p className="toast-t">Added to bag</p><p className="toast-s">{toast}</p></div>
            <button className="toast-btn" type="button" onClick={() => openLayer(setBagOpen)}>View bag</button>
          </div>
        ) : null}
      </div>

      {isDemo ? <div className="demo-ribbon" aria-hidden="true">Demo mode</div> : null}
    </div>
  );
}

function ContactCol() {
  const c = config.contact;
  const wa = c.whatsapp ? 'https://wa.me/' + String(c.whatsapp).replace(/\D/g, '') : '';
  if (!c.phone && !wa && !c.email) return null;
  return (
    <div className="ftr-col">
      <h3>Contact</h3>
      {c.phone ? <a href={'tel:' + c.phone.replace(/[^\d+]/g, '')}>{c.phone}</a> : null}
      {wa ? <a href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a> : null}
      {c.email ? <a href={'mailto:' + c.email}>{c.email}</a> : null}
    </div>
  );
}
