import { useEffect, useMemo, useRef, useState } from 'react';
import config from '../config/store.config.js';
import { submitReview } from '../lib/api.js';
import { money, plural } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { Art, ErrorSummary, Field, Glyph, Icon, ProductCard, fieldProps, focusFirstError, matchCollection, visibleCollections } from './shared.jsx';

const pad = (n) => String(n).padStart(2, '0');

// =====================================================================
// HOME
// =====================================================================
// heroContent: the hero as saved in the dashboard (overrides the same keys of config.home)
export function Home({ products, collections, craft, heroContent, reviews }) {
  const H = { ...config.home, ...(heroContent || {}) };
  const byId = (id) => products.find((p) => p.id === id);
  const hero = byId(H.heroProductId) || products.find((p) => p.featured) || products[0];
  const cols = visibleCollections(collections);
  // one card per collection with pieces; picture: the one pinned in config.home.collectionCards,
  // else a featured piece with a photo, else any piece with a photo, else the first
  const pinned = Object.fromEntries((H.collectionCards || []).map(([cid, pid]) => [cid, pid]));
  const hasPhoto = (x) => x.images && x.images.length > 0;
  const cards = cols.map((c) => {
    const inC = products.filter((x) => matchCollection(x, c));
    return { c, p: byId(pinned[c.id]) || inC.find((x) => x.featured && hasPhoto(x)) || inC.find(hasPhoto) || inC.find((x) => x.featured) || inC[0] };
  }).filter((x) => x.p);
  const featured = products.filter((p) => p.featured).slice(0, 6);
  const sp = H.spaces || null;
  const spaces = sp ? [
    { key: 'living', p: byId(sp.living), room: 'room-living sp-living', furn: <div className="sofa" />, label: 'living room', cls: 's1' },
    { key: 'bedroom', p: byId(sp.bedroom), room: 'room-bed sp-bed', furn: <div className="bed" />, label: 'bedroom', cls: 's2' },
    { key: 'hallway', p: byId(sp.hallway), room: 'room-hall sp-hall', furn: <div className="bench" />, label: 'hallway', cls: 's3' },
    { key: 'desk', p: byId(sp.desk), room: 'room-desk sp-desk', furn: <><div className="monitor" /><div className="desk" /></>, label: 'desk setup', cls: 's4' },
  ].filter((s) => s.p) : [];
  let n = 0; const num = () => pad(++n);

  return (
    <>
      <section className="hero" aria-labelledby="hero-h">
        {H.heroImage ? (
          <div className="scene hero-scene hero-photo"><img src={H.heroImage} alt={H.heroImageAlt || ''} fetchPriority="high" /></div>
        ) : hero ? (
          <div className="scene hero-scene">
            <Art product={hero} alt={hero.alt} />
            <div className="scene-floor" aria-hidden="true" /><div className="bench" aria-hidden="true" />
          </div>
        ) : null}
        <div className="wrap hero-copy">
          <h1 id="hero-h" className="display hero-h">{H.heroTitle}<em>{H.heroTitleItalic}</em></h1>
          <div className="hero-side">
            <p className="lead">{H.heroLead}</p>
            <div className="cta-row">
              <a className="btn btn-primary" href="/shop">Explore collections <Icon.arrow /></a>
              {config.features.customOrders ? <a className="btn btn-ghost" href="/custom">Create a custom piece</a> : null}
            </div>
            {hero ? (
              <a className="placard" href={'/p/' + encodeURIComponent(hero.id)}>
                <span className="label">On the wall</span>
                <span className="placard-name">{hero.name}</span>
                <span className="placard-meta">{hero.typeLine} · {hero.soldOut ? 'Sold out' : hero.fromPrice}</span>
                <span className="placard-link">View this piece <Icon.arrow s={14} /></span>
              </a>
            ) : <span />}
          </div>
        </div>
      </section>

      {cards.length ? (
        <section className="sec reveal" aria-labelledby="coll-h">
          <div className="wrap">
            <div className="sec-head">
              <p className="label">{num()} — Collections</p>
              <h2 id="coll-h" className="display h2">Explore collections</h2>
              <a className="link-arrow" href="/shop">View all pieces <Icon.arrow s={14} /></a>
            </div>
            <div className="coll-grid">
              {cards.map(({ c, p }, i) => (
                <a key={c.id} className={'coll-card c' + i} href={'/shop/' + encodeURIComponent(c.id)}>
                  <span className="scene coll-media" aria-hidden="true"><Art product={p} /><span className="scene-floor" /></span>
                  <span className="coll-info">
                    <span className="display coll-name">{c.name}</span>
                    <span className="coll-count">{plural(products.filter((x) => matchCollection(x, c)).length, 'piece')} <Icon.arrow /></span>
                  </span>
                </a>
              ))}
              {config.features.customOrders ? (
                <a className="coll-card coll-custom" href="/custom">
                  <span className="coll-custom-in">
                    <span className="ghost-row" aria-hidden="true"><span /><span /><span /><span /><span /></span>
                    <span style={{ display: 'grid', gap: 6 }}>
                      <span className="display coll-name">Custom</span>
                      <span className="muted" style={{ fontSize: 15 }}>Your reference, your size, your arrangement — made for your wall.</span>
                    </span>
                    <span className="coll-count">Start a request <Icon.arrow /></span>
                  </span>
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {featured.length ? (
        <section className="sec reveal" aria-labelledby="sel-h">
          <div className="wrap">
            <div className="sec-head">
              <p className="label">{num()} — Selected pieces</p>
              <h2 id="sel-h" className="display h2">Selected pieces</h2>
              <a className="link-arrow" href="/shop">Browse the catalogue <Icon.arrow s={14} /></a>
            </div>
            <ul className="pgrid">{featured.map((p) => <ProductCard key={p.id} p={p} wide />)}</ul>
          </div>
        </section>
      ) : null}

      {craft && craft.show ? (
        <section className="sec craft" id="craft" aria-labelledby="craft-h">
          <div className="wrap craft-grid">
            <div className="craft-intro reveal">
              <p className="label">{num()} — Our craft</p>
              <h2 id="craft-h" className="display h2">{craft.title}</h2>
              <p>{craft.intro}</p>
            </div>
            <div className="reveal">
              <ol className="detail-list" style={{ marginTop: 0 }}>
                {(craft.details || []).map((d, i) => (
                  <li key={i} className="detail-row">
                    <span className="label detail-num">{pad(i + 1)}</span>
                    <span>
                      <span className="detail-title">{d.title}</span>
                      <span className="detail-copy">{d.copy}</span>
                      {d.spec ? <span className="detail-spec">{d.spec}</span> : null}
                    </span>
                    {d.image ? <img className="photo" src={d.image} alt={d.title} loading="lazy" style={{ objectFit: 'cover', padding: 0 }} />
                      : <span className="photo"><span className="label photo-label">Photo · {d.title.toLowerCase()}</span></span>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      ) : null}

      {config.features.customOrders ? (
        <section className="sec custom-band" aria-labelledby="mk-h">
          <div className="wrap custom-grid reveal">
            <div className="custom-visual" aria-hidden="true">
              <div className="ghost-arr"><span /><span /><span /><span /><span /></div>
              <span className="label ghost-tag gt1">Your image</span>
              <span className="label ghost-tag gt2">Your size</span>
              <span className="label ghost-tag gt3">Your arrangement</span>
            </div>
            <div className="custom-copy">
              <p className="label">{num()} — Make it yours</p>
              <h2 id="mk-h" className="display h2">Your idea. <em>Made for your wall.</em></h2>
              <p>Send a reference image, the size or panel arrangement you have in mind, and a few words about the idea. We'll review it and come back to you with pricing and next steps.</p>
              <a className="btn btn-primary" href="/custom">Request a custom piece</a>
            </div>
          </div>
        </section>
      ) : null}

      {spaces.length ? (
        <section className="sec reveal" aria-labelledby="sp-h">
          <div className="wrap">
            <div className="sec-head">
              <p className="label">{num()} — In real spaces</p>
              <h2 id="sp-h" className="display h2">In real spaces</h2>
              <p className="muted small" style={{ maxWidth: '36ch' }}>Illustrative mockups — not to scale.</p>
            </div>
            <div className="spaces">
              {spaces.map((s) => (
                <figure key={s.key} className={'space ' + s.cls}>
                  <a className={'scene ' + s.room} href={'/p/' + encodeURIComponent(s.p.id)} style={{ display: 'block' }}>
                    <Art product={s.p} alt={s.p.name + ' in a ' + s.label} />
                    <div className="scene-floor" />{s.furn}
                    <span className="label tag-illus">Illustrative mockup</span>
                  </a>
                  <figcaption><span>{s.p.name} · {s.label}</span><span>{s.p.lay.short}</span></figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {config.features.reviews ? <Reviews reviews={reviews || []} label={num()} /> : null}

      {H.faq && H.faq.length ? (
        <section className="sec reveal" aria-labelledby="faq-h">
          <div className="wrap faq-grid">
            <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              <p className="label">{num()} — Questions</p>
              <h2 id="faq-h" className="display h2">Good to know</h2>
              <p className="muted small" style={{ maxWidth: '34ch' }}>Something else? Ask us through any of the contact links below.</p>
            </div>
            <div className="faq-list">
              {H.faq.map((f, i) => (
                <details key={i} className="faq"><summary>{f.q}<Icon.faq /></summary><div className="faq-a">{f.a}</div></details>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

// ---------- customer reviews: a row of cards that moves on its own, and a form to add one
const Stars = ({ n, s }) => <span className="rv-stars" role="img" aria-label={n + ' out of 5 stars'}>{[1, 2, 3, 4, 5].map((i) => <Icon.star key={i} s={s} on={i <= n} />)}</span>;

function ReviewCard({ r, hidden }) {
  return (
    <li className="rv-card" aria-hidden={hidden || undefined}>
      <Stars n={r.rating} />
      <p className="rv-body">“{r.body}”</p>
      <p className="rv-who"><span>{r.name}</span>{r.region ? <span className="muted"> · {r.region}</span> : null}</p>
    </li>
  );
}

function Reviews({ reviews, label }) {
  const [writing, setWriting] = useState(false);
  const [paused, setPaused] = useState(false);
  // with only a couple of reviews a moving row looks empty, so they just sit side by side
  const moving = reviews.length >= 3;
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  return (
    <section className="sec reveal rv-sec" aria-labelledby="rv-h">
      <div className="wrap">
        <div className="sec-head">
          <p className="label">{label} — Reviews</p>
          <h2 id="rv-h" className="display h2">What our <em>customers say</em></h2>
          {reviews.length ? <p className="rv-avg"><Stars n={Math.round(avg)} s={18} /><span>{avg.toFixed(1)} out of 5 · {plural(reviews.length, 'review')}</span></p>
            : <p className="muted">No reviews yet. Bought from us? Be the first to share how it went.</p>}
        </div>
      </div>
      {reviews.length ? (
        <div className={'rv-marquee' + (moving ? ' is-moving' : '') + (paused ? ' is-paused' : '')} style={{ '--rv-dur': reviews.length * 8 + 's' }}>
          <ul className="rv-track" aria-label="Customer reviews">
            {reviews.map((r) => <ReviewCard key={r.id} r={r} />)}
            {moving ? reviews.map((r) => <ReviewCard key={'copy-' + r.id} r={r} hidden />) : null}
          </ul>
        </div>
      ) : null}
      <div className="wrap rv-foot">
        {moving ? (
          <button className="rv-pause" type="button" onClick={() => setPaused((x) => !x)} aria-pressed={paused}>
            {paused ? <Icon.play /> : <Icon.pause />}{paused ? 'Play reviews' : 'Pause reviews'}
          </button>
        ) : null}
        {writing ? <ReviewForm onClose={() => setWriting(false)} /> : <button className="btn btn-ghost" type="button" onClick={() => setWriting(true)}>Write a review</button>}
      </div>
    </section>
  );
}

function ReviewForm({ onClose }) {
  const [v, setV] = useState({ name: '', region: '', rating: 0, body: '', company: '' });
  const [e, setE] = useState({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');
  const [sent, setSent] = useState(false);
  const [hover, setHover] = useState(0);
  const first = useRef(null);
  useEffect(() => { if (first.current) first.current.focus(); }, []);
  const set = (k) => (ev) => {
    const val = k === 'rating' ? Number(ev.target.value) : ev.target.value;
    setV((s) => ({ ...s, [k]: val }));
    setE((er) => { if (!er[k]) return er; const n = { ...er }; delete n[k]; return n; });
  };
  const submit = async (ev) => {
    ev.preventDefault();
    if (busy) return;
    const errs = {};
    if (!v.rating) errs.rating = 'Choose a star rating.';
    if (v.body.trim().length < 10) errs.body = 'Write a few words about your experience (at least a sentence).';
    if (!v.name.trim()) errs.name = 'Enter your name.';
    setE(errs);
    if (Object.keys(errs).length) { focusFirstError(errs, 'rv'); return; }
    if (v.company) { setSent(true); return; }
    setBusy(true); setFailed('');
    try {
      await submitReview({ name: v.name.trim(), region: v.region.trim(), rating: v.rating, body: v.body.trim() });
      setSent(true);
    } catch (err) {
      setFailed(err.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };
  if (sent) {
    return (
      <div className="rv-form rv-thanks" role="status">
        <Icon.check s={22} />
        <div><p className="rv-thanks-t">Thank you for your review!</p><p className="muted">It will appear here once we’ve checked it.</p></div>
      </div>
    );
  }
  const shown = hover || v.rating;
  return (
    <form className="form rv-form" noValidate onSubmit={submit} aria-labelledby="rv-form-h">
      <h3 id="rv-form-h" className="rv-form-h">Write a review</h3>
      <ErrorSummary errors={e} prefix="rv" />
      {failed ? <p className="form-err" role="alert">{failed}</p> : null}
      <div className={'field' + (e.rating ? ' has-err' : '')}>
        <span className="flabel" id="rv-rating-l">Your rating</span>
        <div className="rv-rate" role="radiogroup" id="rv-rating" aria-labelledby="rv-rating-l" aria-describedby={e.rating ? 'rv-rating-err' : undefined} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <label key={i} className={'rv-star' + (i <= shown ? ' is-on' : '')} onMouseEnter={() => setHover(i)}>
              <input className="sr" type="radio" name="rv-rating" value={i} checked={v.rating === i} onChange={set('rating')} ref={i === 1 ? first : undefined} />
              <Icon.star s={30} on={i <= shown} />
              <span className="sr">{plural(i, 'star')}</span>
            </label>
          ))}
        </div>
        {e.rating ? <p className="err" id="rv-rating-err">{e.rating}</p> : null}
      </div>
      <Field id="rv-body" label="Your review" error={e.body} hint={v.body.length + ' / 600'}>
        <textarea className="input" rows={4} maxLength={600} {...fieldProps('rv-body', e.body, true)} value={v.body} onChange={set('body')} placeholder="How was the piece, the delivery, the service?" />
      </Field>
      <div className="two">
        <Field id="rv-name" label="Name" error={e.name} hint="Shown with your review, e.g. “Mariam A.”">
          <input className="input" type="text" autoComplete="given-name" maxLength={60} {...fieldProps('rv-name', e.name, true)} value={v.name} onChange={set('name')} />
        </Field>
        <Field id="rv-region" label="City" optional>
          <input className="input" type="text" autoComplete="address-level2" maxLength={80} {...fieldProps('rv-region')} value={v.region} onChange={set('region')} />
        </Field>
      </div>
      <label className="hp" aria-hidden="true">Company<input tabIndex={-1} autoComplete="off" value={v.company} onChange={set('company')} /></label>
      <div className="rv-actions">
        <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? <><span className="spinner" aria-hidden="true" />Sending…</> : 'Send review'}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
      <p className="submit-note">Reviews appear after we check them.</p>
    </form>
  );
}

// =====================================================================
// CATALOGUE
// =====================================================================
const ARR_CHIPS = [{ id: 'all', name: 'Any arrangement' }, { id: 'single', name: 'Framed' }, { id: 'three', name: 'Three panels' }, { id: 'five', name: 'Five panels' }];

export function Catalogue({ products, collections, collId }) {
  const cols = visibleCollections(collections);
  const cur = cols.find((c) => c.id === collId) || null;
  const [arr, setArr] = useState('all');
  const [sort, setSort] = useState('featured');
  const [sheet, setSheet] = useState(false);
  const closeRef = useRef(null), openerRef = useRef(null);
  useEffect(() => { setArr('all'); }, [collId]);
  useEffect(() => {
    if (sheet) { setTimeout(() => closeRef.current && closeRef.current.focus(), 60); }
    else if (openerRef.current) { openerRef.current.focus({ preventScroll: true }); openerRef.current = null; }
  }, [sheet]);

  const items = useMemo(() => {
    const order = products.map((p) => p.id);
    return products.filter((p) => matchCollection(p, cur) && (arr === 'all' || p.layout === arr)).sort((a, b) => {
      if (sort === 'price-asc') return a.minPrice - b.minPrice;
      if (sort === 'price-desc') return b.minPrice - a.minPrice;
      if (sort === 'newest') return String(b.created_at).localeCompare(String(a.created_at));
      return (Number(a.soldOut) - Number(b.soldOut)) || (Number(b.featured) - Number(a.featured)) || (order.indexOf(a.id) - order.indexOf(b.id));
    });
  }, [products, cur, arr, sort]);

  const catChips = [{ id: '', name: 'All' }].concat(cols).map((c) => ({ ...c, count: products.filter((p) => matchCollection(p, c.id ? c : null)).length, on: (cur ? cur.id : '') === c.id }));
  const goCat = (id) => navigate(id ? 'shop/' + encodeURIComponent(id) : 'shop');
  const active = (cur ? 1 : 0) + (arr !== 'all' ? 1 : 0);
  const clear = () => { setArr('all'); if (cur) goCat(''); };
  const showArr = config.features.multiPanel;

  return (
    <section className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="/">Home</a><span aria-hidden="true">/</span><span aria-current="page">{cur ? cur.name : 'All pieces'}</span>
      </nav>
      <header className="cat-head">
        <h1 className="display h1">{cur ? cur.name : 'All pieces'}</h1>
        <p>{cur ? cur.intro : 'The full catalogue.'}</p>
      </header>
      <div className="cat-bar">
        <div className="chips" role="group" aria-label="Filter by collection">
          {catChips.map((c) => <button key={c.id || 'all'} className={'chip' + (c.on ? ' is-on' : '')} type="button" aria-pressed={c.on} onClick={() => goCat(c.id)}>{c.name} <span className="chip-n">{c.count}</span></button>)}
        </div>
        {showArr ? <span className="chips-sep" aria-hidden="true" /> : null}
        {showArr ? (
          <div className="chips" role="group" aria-label="Filter by arrangement">
            {ARR_CHIPS.map((a) => <button key={a.id} className={'chip' + (arr === a.id ? ' is-on' : '')} type="button" aria-pressed={arr === a.id} onClick={() => setArr(a.id)}>{a.name}</button>)}
          </div>
        ) : null}
        <button className="btn btn-ghost filter-btn" type="button" aria-haspopup="dialog" onClick={(e) => { openerRef.current = e.currentTarget; setSheet(true); }}>
          <Icon.filter />{active ? 'Filter (' + active + ')' : 'Filter'}
        </button>
        <div className="cat-right">
          <p className="count" aria-live="polite">{plural(items.length, 'piece')}</p>
          <label className="sort"><span className="label">Sort</span>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="featured">Featured</option><option value="newest">Newest</option>
              <option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option>
            </select>
          </label>
        </div>
      </div>
      {items.length ? (
        <div className="cat-grid-wrap"><ul className="pgrid">{items.map((p) => <ProductCard key={p.id} p={p} wide />)}</ul></div>
      ) : (
        <div className="empty">
          <p className="label">No matches</p>
          <h2 className="display" style={{ fontSize: 34 }}>Nothing here yet.</h2>
          <p>No pieces match this combination. Clear the filters{config.features.customOrders ? ', or tell us what you’re looking for and we’ll consider it as a custom piece' : ''}.</p>
          <div className="empty-actions">
            <button className="btn btn-ghost" type="button" onClick={clear}>Clear filters</button>
            {config.features.customOrders ? <a className="btn btn-primary" href="/custom">Request a custom piece</a> : null}
          </div>
        </div>
      )}

      <div className={'scrim' + (sheet ? ' on' : '')} onClick={() => setSheet(false)} aria-hidden="true" />
      <div className={'sheet' + (sheet ? ' on' : '')} role="dialog" aria-modal="true" aria-labelledby="flt-h" onKeyDown={(e) => { if (e.key === 'Escape') setSheet(false); }}>
        <div className="drawer-head">
          <h2 id="flt-h" className="drawer-title">Filter</h2>
          <button className="icon-btn" type="button" ref={closeRef} onClick={() => setSheet(false)} aria-label="Close filters"><Icon.close /></button>
        </div>
        <div className="drawer-body" style={{ paddingTop: 18 }}>
          <fieldset>
            <legend className="label" style={{ marginBottom: 10 }}>Collection</legend>
            <div className="radio-list">
              {catChips.map((c) => <label key={c.id || 'all'} className={'radio-row' + (c.on ? ' is-sel' : '')}><input className="sr" type="radio" name="f-cat" checked={c.on} onChange={() => goCat(c.id)} /><span>{c.name}</span><span className="chip-n">{c.count}</span></label>)}
            </div>
          </fieldset>
          {showArr ? (
            <fieldset>
              <legend className="label" style={{ marginBottom: 10 }}>Arrangement</legend>
              <div className="radio-list">
                {ARR_CHIPS.map((a) => <label key={a.id} className={'radio-row' + (arr === a.id ? ' is-sel' : '')}><input className="sr" type="radio" name="f-arr" checked={arr === a.id} onChange={() => setArr(a.id)} /><span>{a.name}</span></label>)}
              </div>
            </fieldset>
          ) : null}
        </div>
        <div className="drawer-foot" style={{ gridTemplateColumns: 'auto 1fr' }}>
          <button className="btn btn-ghost" type="button" onClick={clear}>Clear</button>
          <button className="btn btn-primary" type="button" onClick={() => setSheet(false)}>{items.length ? 'Show ' + plural(items.length, 'piece') : 'No pieces match'}</button>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// PRODUCT
// =====================================================================
const CUSTOM_MIN = 10, CUSTOM_MAX = 600; // cm, same limits as place_order() in schema.sql

export function Product({ product: p, products, onAdd, layerOpen }) {
  const [sizeIdx, setSizeIdx] = useState(0); // a size index, or 'custom'
  const [cs, setCs] = useState({ w: '', h: '' });
  const [csErr, setCsErr] = useState({});
  const [qty, setQty] = useState(1);
  const [g, setG] = useState(0);
  const track = useRef(null);
  useEffect(() => { setSizeIdx(0); setCs({ w: '', h: '' }); setCsErr({}); setQty(1); setG(0); if (track.current) track.current.scrollLeft = 0; }, [p && p.id]);

  if (!p) {
    return (
      <section className="wrap status-bar">
        <p className="label">Not found</p>
        <h1 className="display h1">This piece isn’t available.</h1>
        <p className="muted">It may have been removed or renamed.</p>
        <a className="btn btn-primary" href="/shop">Browse the catalogue</a>
      </section>
    );
  }
  const isCustom = sizeIdx === 'custom' && p.allow_custom;
  const csValid = (v) => /^\d{1,3}(\.\d)?$/.test(String(v).trim()) && +v >= CUSTOM_MIN && +v <= CUSTOM_MAX;
  const size = isCustom ? { label: 'Custom size', total: csValid(cs.w) && csValid(cs.h) ? +cs.w + ' × ' + +cs.h + ' cm' : '', panels: '', price: 0 }
    : p.sizes[sizeIdx] || p.sizes[0] || { label: '', total: '', panels: '', price: 0 };
  const priceText = (n) => (isCustom ? 'Price by phone' : money(size.price * n));
  const slides = [
    { label: 'Full view', node: <div className="g-full"><Art product={p} alt={p.alt} /></div>, cap: p.images && p.images.length ? '' : 'Full composition' },
    { label: 'Room view', node: <div className="scene room-living g-room"><Art product={p} alt={p.name + ' shown above a sofa'} /><div className="scene-floor" /><div className="sofa" /></div>, cap: 'Room view · illustrative · not to scale' },
  ].concat((p.images || []).slice(1).map((src, i) => ({ label: 'Photo ' + (i + 1), node: <img className="pmedia-photo" src={src} alt={p.name + ', photo ' + (i + 1)} style={{ position: 'absolute', inset: 0 }} />, cap: '' })));
  const goSlide = (i) => {
    const t = track.current; if (!t) return;
    const smooth = window.matchMedia && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    t.scrollTo({ left: i * t.clientWidth, behavior: smooth ? 'smooth' : 'auto' }); setG(i);
  };
  const related = products.filter((x) => x.id !== p.id && x.collection_id === p.collection_id)
    .concat(products.filter((x) => x.id !== p.id && x.collection_id !== p.collection_id)).slice(0, 3);
  const add = () => {
    if (p.soldOut) return;
    if (!isCustom) { onAdd(p, sizeIdx, qty); return; }
    const err = {};
    if (!csValid(cs.w)) err.w = 'Enter a width between ' + CUSTOM_MIN + ' and ' + CUSTOM_MAX + ' cm.';
    if (!csValid(cs.h)) err.h = 'Enter a height between ' + CUSTOM_MIN + ' and ' + CUSTOM_MAX + ' cm.';
    setCsErr(err);
    if (Object.keys(err).length) { const el = document.getElementById(err.w ? 'cs-w' : 'cs-h'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); } return; }
    onAdd(p, 'custom', qty, { w: +cs.w, h: +cs.h });
  };
  const setDim = (k) => (e) => { const v = e.target.value; setCs((c) => ({ ...c, [k]: v })); setCsErr((x) => ({ ...x, [k]: '' })); };
  const customVersion = () => {
    try { sessionStorage.setItem('custom_prefill', JSON.stringify({ layout: p.layout, description: 'A custom version of “' + p.name + '” — ' })); } catch (e) { /* ignore */ }
    navigate('custom');
  };
  const buyOn = !layerOpen;
  const multi = config.features.multiPanel;

  return (
    <section className="wrap pdp">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="/">Home</a><span aria-hidden="true">/</span>
        {p.collName ? <><a href={'/shop/' + encodeURIComponent(p.collection_id)}>{p.collName}</a><span aria-hidden="true">/</span></> : null}
        <span aria-current="page">{p.name}</span>
      </nav>
      <div className="pdp-grid">
        <div className="gallery">
          <div className="g-track" ref={track} tabIndex={0} role="region" aria-label="Product images — swipe or use the buttons below"
            onScroll={(e) => { const t = e.currentTarget; const i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth)); if (i !== g) setG(i); }}>
            {slides.map((s, i) => (
              <div key={i} className="g-slide">{s.node}{s.cap ? <span className="label g-cap">{s.cap}</span> : null}</div>
            ))}
          </div>
          <div className="g-controls">
            <button className="icon-btn g-nav" type="button" onClick={() => goSlide(Math.max(0, g - 1))} disabled={g <= 0} aria-label="Previous image"><Icon.back s={16} /></button>
            <div className="g-thumbs" role="group" aria-label="Choose image">
              {slides.map((s, i) => <button key={i} className={'g-thumb' + (i === g ? ' is-on' : '')} type="button" aria-pressed={i === g} onClick={() => goSlide(i)}>{s.label}</button>)}
            </div>
            <span className="label g-count" aria-live="polite">{g + 1} / {slides.length}</span>
            <button className="icon-btn g-nav" type="button" onClick={() => goSlide(Math.min(slides.length - 1, g + 1))} disabled={g >= slides.length - 1} aria-label="Next image"><Icon.arrow /></button>
          </div>
        </div>

        <div className="pdp-info">
          {p.typeLine ? <p className="label">{p.typeLine}</p> : null}
          <h1 className="display pdp-title">{p.name}</h1>
          <p className="pdp-price">{priceText(1)}{p.soldOut ? <span className="sold-badge">Sold out</span> : null}</p>
          <p className="small muted pdp-price-note">{p.soldOut ? 'This piece is sold out right now. ' : ''}{isCustom ? 'We call you to confirm the price of your size before anything is made. ' : 'Price for the selected size. '}{config.deliveryNote}</p>

          {p.sizes.length > 1 || p.allow_custom ? (
            <fieldset className="sizes">
              <legend className="label">Size</legend>
              {p.sizes.map((s, i) => (
                <label key={i} className={'size-opt' + (i === sizeIdx ? ' is-sel' : '')}>
                  <input className="sr" type="radio" name="pdp-size" value={s.label} checked={i === sizeIdx} onChange={() => setSizeIdx(i)} />
                  <span className="size-name">{s.label}</span>
                  <span className="size-price">{money(s.price)}</span>
                  {s.total && s.total !== s.label ? <span className="size-dim">{s.total} total</span> : null}
                </label>
              ))}
              {p.allow_custom ? (
                <label className={'size-opt' + (isCustom ? ' is-sel' : '')}>
                  <input className="sr" type="radio" name="pdp-size" value="custom" checked={isCustom} onChange={() => setSizeIdx('custom')} />
                  <span className="size-name">Custom size</span>
                  <span className="size-price">Price by phone</span>
                  <span className="size-dim">Your own width × height</span>
                </label>
              ) : null}
            </fieldset>
          ) : null}

          {isCustom ? (
            <div className="custom-size">
              <div className="two">
                <Field id="cs-w" label="Width (cm)" error={csErr.w}><input className="input" type="text" inputMode="decimal" placeholder="e.g. 120" {...fieldProps('cs-w', csErr.w)} value={cs.w} onChange={setDim('w')} /></Field>
                <Field id="cs-h" label="Height (cm)" error={csErr.h}><input className="input" type="text" inputMode="decimal" placeholder="e.g. 60" {...fieldProps('cs-h', csErr.h)} value={cs.h} onChange={setDim('h')} /></Field>
              </div>
              <p className="small muted">{multi && p.layout !== 'single' ? 'The size of the whole arrangement on the wall. ' : ''}From {CUSTOM_MIN} to {CUSTOM_MAX} cm.</p>
            </div>
          ) : null}

          <div className="dims">
            {multi ? <div className="dims-row"><span className="label">Arrangement</span><span className="arr-info"><Glyph layout={p.layout} />{p.lay.label}</span></div> : null}
            {size.total ? <div className="dims-row"><span className="label">{multi ? 'Installed size' : 'Size'}</span><span>{size.total} {multi && p.layout !== 'single' ? <span className="muted">— full arrangement on the wall</span> : null}</span></div> : null}
            {size.panels && multi ? <div className="dims-row"><span className="label">{p.lay.panelLabel}</span><span>{size.panels}</span></div> : null}
          </div>

          <div className="qty-row" hidden={p.soldOut}>
            <span className="label" id="qty-l">Quantity</span>
            <div className="qty" role="group" aria-labelledby="qty-l">
              <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Decrease quantity"><Icon.minus /></button>
              <output aria-live="polite">{qty}</output>
              <button type="button" onClick={() => setQty(Math.min(10, qty + 1))} disabled={qty >= 10} aria-label="Increase quantity"><Icon.plus /></button>
            </div>
          </div>

          <button className="btn btn-primary btn-block" type="button" onClick={add} disabled={p.soldOut}>{p.soldOut ? 'Sold out' : 'Add to bag · ' + priceText(qty)}</button>
          {config.features.customOrders ? (
            <button className="link-arrow" type="button" onClick={customVersion} style={{ justifySelf: 'start' }}>Request a custom version <Icon.arrow s={14} /></button>
          ) : null}

          {p.description ? <p className="pdp-desc">{p.description}</p> : null}

          <div>
            {config.productSpecs && config.productSpecs.length ? (
              <details className="acc" open>
                <summary>Specifications<Icon.faq /></summary>
                <div className="acc-body"><dl style={{ display: 'grid', gap: 10 }}>{config.productSpecs.map((s, i) => <div key={i} className="spec"><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl></div>
              </details>
            ) : null}
            <details className="acc">
              <summary>Delivery &amp; payment<Icon.faq /></summary>
              <div className="acc-body"><p>{config.deliveryNote}</p><p>Nothing is charged online.</p></div>
            </details>
          </div>
        </div>
      </div>

      {related.length ? (
        <div className="related">
          <h2 className="display">More to explore</h2>
          <ul className="pgrid">{related.map((x) => <ProductCard key={x.id} p={x} />)}</ul>
        </div>
      ) : null}

      <div className={'buybar' + (buyOn ? ' on' : '')} aria-hidden={buyOn ? undefined : 'true'}>
        <div className="buybar-l"><span className="label">{size.label ? size.label + ' · ' : ''}Qty {qty}</span><span className="buybar-price">{priceText(qty)}</span></div>
        <button className="btn btn-primary" type="button" onClick={add} disabled={p.soldOut} tabIndex={buyOn ? undefined : -1}>{p.soldOut ? 'Sold out' : 'Add to bag'}</button>
      </div>
    </section>
  );
}
