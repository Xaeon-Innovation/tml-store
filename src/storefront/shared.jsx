import config from '../config/store.config.js';
import { LAYOUTS, layoutOf, money } from '../lib/format.js';

// ---------- product helpers ----------
export function matchCollection(p, c) {
  if (!c) return true;
  return c.auto_multi ? p.layout !== 'single' : p.collection_id === c.id;
}
export function visibleCollections(collections) {
  return config.features.multiPanel ? collections : collections.filter((c) => !c.auto_multi);
}
export function decorate(p, collections) {
  const coll = collections.find((c) => c.id === p.collection_id);
  const lay = layoutOf(p);
  const prices = (p.sizes || []).map((s) => Number(s.price) || 0);
  const min = prices.length ? Math.min(...prices) : 0;
  return {
    ...p,
    collName: coll ? coll.name : '',
    lay,
    typeLine: [coll && coll.name, config.features.multiPanel ? lay.short : ''].filter(Boolean).join(' · '),
    minPrice: min,
    soldOut: p.in_stock === false,
    fromPrice: (prices.length > 1 ? 'From ' : '') + money(min),
    alt: p.name + (config.features.multiPanel ? ', ' + lay.label.toLowerCase() : ''),
  };
}

// ---------- artwork: one composition sliced across 1, 3 or 5 panels ----------
export function Art({ product, alt, className = '' }) {
  const lay = LAYOUTS[product.layout] || LAYOUTS.single;
  const img = product.images && product.images[0];
  const n = lay.panels;
  const panels = [];
  for (let i = 0; i < n; i++) {
    const pos = n === 5 ? 'p5-' + i + ' d' + i : n === 3 ? 'p3-' + i + ' d' + (i + 1) : 'p1 d2';
    const look = img ? 'has-img' : 'art-' + (product.art || 'neon');
    panels.push(<span key={i} className={'panel ' + look + ' ' + pos} style={img ? { backgroundImage: 'url("' + img.replace(/"/g, '%22') + '")' } : undefined} />);
  }
  const key = n === 5 ? 'five' : n === 3 ? 'three' : 'single';
  const a11y = alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true };
  return <span className={'arr arr-' + key + ' ' + className} {...a11y}>{panels}</span>;
}

export function ProductCard({ p, wide }) {
  return (
    <li className={wide && p.layout === 'five' ? 'pcard-wide' : ''}>
      <a className="pcard" href={'/p/' + encodeURIComponent(p.id)}>
        <span className="pmedia"><Art product={p} alt={p.alt} />{p.soldOut ? <span className="label sold-tag">Sold out</span> : null}</span>
        <span className="pmeta"><span className="pname">{p.name}</span><span className="pprice">{p.soldOut ? 'Sold out' : p.fromPrice}</span><span className="ptype">{p.typeLine}</span></span>
      </a>
    </li>
  );
}

export function Glyph({ layout }) {
  const n = (LAYOUTS[layout] || { panels: 0 }).panels;
  return <span className={'glyph glyph-' + layout} aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} />)}</span>;
}

// ---------- form field ----------
export function Field({ id, label, optional, error, hint, children }) {
  return (
    <div className={'field' + (error ? ' has-err' : '')}>
      <label htmlFor={id}>{label}{optional ? <span className="opt"> (optional)</span> : null}</label>
      {children}
      {hint ? <p className="hint" id={id + '-hint'}>{hint}</p> : null}
      {error ? <p className="err" id={id + '-err'}>{error}</p> : null}
    </div>
  );
}
export function fieldProps(id, error, hint) {
  const d = [error ? id + '-err' : '', hint ? id + '-hint' : ''].filter(Boolean).join(' ');
  return { id, 'aria-invalid': error ? 'true' : 'false', 'aria-describedby': d || undefined };
}
export function ErrorSummary({ errors, prefix }) {
  const keys = Object.keys(errors).filter((k) => errors[k]);
  if (!keys.length) return null;
  return (
    <div className="err-sum" role="alert">
      <p>{keys.length === 1 ? 'Please check 1 field:' : 'Please check ' + keys.length + ' fields:'}</p>
      <ul>{keys.map((k) => <li key={k}><a href={'#' + prefix + '-' + k} onClick={(e) => { e.preventDefault(); const el = document.getElementById(prefix + '-' + k); if (el) el.focus(); }}>{errors[k]}</a></li>)}</ul>
    </div>
  );
}
export function focusFirstError(errors, prefix) {
  const k = Object.keys(errors)[0];
  setTimeout(() => { let el = document.getElementById(prefix + '-' + k); if (el && el.getAttribute('role') === 'radiogroup') el = el.querySelector('input'); if (el) el.focus(); }, 30);
}

// ---------- icons ----------
const S = { fill: 'none', stroke: 'currentColor', 'aria-hidden': true };
export const Icon = {
  arrow: (p) => <svg width={p?.s || 16} height={p?.s || 16} viewBox="0 0 16 16" strokeWidth="1.5" {...S}><path d="M2 8h12M9 3l5 5-5 5" /></svg>,
  back: (p) => <svg width={p?.s || 14} height={p?.s || 14} viewBox="0 0 16 16" strokeWidth="1.5" {...S}><path d="M14 8H2M7 3L2 8l5 5" /></svg>,
  plus: (p) => <svg width={p?.s || 14} height={p?.s || 14} viewBox="0 0 14 14" strokeWidth="1.5" {...S}><path d="M2 7h10M7 2v10" /></svg>,
  minus: (p) => <svg width={p?.s || 14} height={p?.s || 14} viewBox="0 0 14 14" strokeWidth="1.5" {...S}><path d="M2 7h10" /></svg>,
  close: () => <svg width="18" height="18" viewBox="0 0 18 18" strokeWidth="1.4" {...S}><path d="M3 3l12 12M15 3L3 15" /></svg>,
  bag: () => <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="1.4" {...S}><path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>,
  menu: () => <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="1.4" {...S}><path d="M4 8h16M4 16h16" /></svg>,
  check: (p) => <svg width={p?.s || 22} height={p?.s || 22} viewBox="0 0 22 22" strokeWidth="1.5" {...S}><path d="M4 11.5l4.5 4.5L18 6.5" /></svg>,
  info: () => <svg width="18" height="18" viewBox="0 0 18 18" strokeWidth="1.4" {...S} style={{ flex: 'none', marginTop: 2 }}><circle cx="9" cy="9" r="7.5" /><path d="M9 5v5M9 12.5v.5" /></svg>,
  faq: () => <svg width="18" height="18" viewBox="0 0 18 18" strokeWidth="1.4" {...S}><path d="M9 3v12M3 9h12" /></svg>,
  filter: () => <svg width="16" height="16" viewBox="0 0 16 16" strokeWidth="1.4" {...S}><path d="M2 4h12M4 8h8M6 12h4" /></svg>,
  upload: () => <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="1.4" {...S}><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>,
  x12: () => <svg width="12" height="12" viewBox="0 0 12 12" strokeWidth="1.5" {...S}><path d="M2 2l8 8M10 2l-8 8" /></svg>,
  whatsapp: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z" /></svg>,
};
