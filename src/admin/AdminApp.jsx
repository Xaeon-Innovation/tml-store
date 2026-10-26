import { useCallback, useEffect, useMemo, useState } from 'react';
import config from '../config/store.config.js';
import * as api from '../lib/api.js';
import { ORDER_FLOW, ORDER_STATUSES, REQUEST_STATUSES, LAYOUTS, dateTime, dayKey, longToday, money, monthKey, monthLabel, plural, shiftDay, shiftMonth, shortDate, todayKey, customerWhatsapp } from '../lib/format.js';
import { navigate, useRoute } from '../lib/router.js';

const PILL = { New: 'st-new', Confirmed: 'st-confirmed', Shipped: 'st-shipped', Completed: 'st-completed', Cancelled: 'st-cancelled', Contacted: 'st-contacted', Quoted: 'st-quoted', Closed: 'st-closed', Featured: 'st-new', Hidden: 'st-closed' };
const Pill = ({ s }) => <span className={'pill ' + (PILL[s] || 'st-closed')}>{s}</span>;
const Chevron = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M14 8H2M7 3L2 8l5 5" /></svg>;
const MONTHS_SHOWN = 6;

function sinceIso() {
  // start of the month, MONTHS_SHOWN-1 months ago (with a day of slack for time zones)
  const m = shiftMonth(monthKey(new Date().toISOString()), -(MONTHS_SHOWN - 1));
  const d = new Date(m + '-01T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString();
}

export default function AdminApp() {
  const [session, setSession] = useState(undefined);
  useEffect(() => { api.getSession().then(setSession).catch(() => setSession(null)); document.title = 'Dashboard · ' + config.brand.fullName; }, []);
  if (session === undefined) return <div className="adm"><p className="loading">Loading…</p></div>;
  if (!session) return <Login onIn={setSession} />;
  return <Dashboard onOut={async () => { await api.signOut(); setSession(null); }} />;
}

// ---------------------------------------------------------------- login
function Login({ onIn }) {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !pw) { setErr('Enter your email and password.'); return; }
    setBusy(true); setErr('');
    try { onIn(await api.signIn(email.trim(), pw)); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="adm">
      <main className="login">
        <form className="card login-card" noValidate onSubmit={submit}>
          <span className="logo"><span className="logo-mark">{config.brand.mark}</span><span className="logo-sub">Owner</span></span>
          <div style={{ display: 'grid', gap: 4 }}><h1>Sign in</h1><p className="muted small">For the store owner only.</p></div>
          {err ? <p className="err" role="alert">{err}</p> : null}
          <div className="field"><label htmlFor="li-email">Email</label><input className="input" id="li-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label htmlFor="li-pw">Password</label><input className="input" id="li-pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ minHeight: 44 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
          {api.isDemo ? <p className="note">Demo mode: any email and password will work. Connect Supabase to use real accounts.</p> : null}
        </form>
        <a className="made-by" href="https://xaeons.com/" target="_blank" rel="noopener"><span>Website by</span><img src="/logo.png" alt="Xaeon" width="50" height="24" /></a>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- dashboard shell
function Dashboard({ onOut }) {
  const route = useRoute();
  const [orders, setOrders] = useState(null);
  const [requests, setRequests] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [toast, setToast] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [o, r] = await Promise.all([api.fetchOrders(sinceIso()), config.features.customOrders ? api.fetchRequests() : Promise.resolve([])]);
      setOrders(o); setRequests(r); setLoadErr('');
    } catch (e) { setLoadErr('Couldn’t load the latest data. Check your connection.'); }
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [refresh]);
  useEffect(() => { window.scrollTo(0, 0); }, [route.name, route.arg]);

  const flash = (msg, bad) => { setToast({ msg, bad }); setTimeout(() => setToast(null), 3000); };
  const setOrderStatus = async (o, status) => {
    try { const u = await api.updateOrderStatus(o.id, status); setOrders((list) => list.map((x) => (x.id === o.id ? u : x))); flash(o.ref + ' marked ' + status + '.'); }
    catch (e) { flash('Couldn’t update the order. Try again.', true); }
  };
  const setCustomPrice = async (o, line, price) => {
    try { const u = await api.setCustomPrice(o.id, line, price); setOrders((list) => list.map((x) => (x.id === o.id ? u : x))); flash('Price saved. ' + o.ref + ' subtotal is now ' + money(u.subtotal) + '.'); return true; }
    catch (e) { flash('Couldn’t save the price. Try again.', true); return false; }
  };
  const setReqStatus = async (r, status) => {
    try { const u = await api.updateRequestStatus(r.id, status); setRequests((list) => list.map((x) => (x.id === r.id ? u : x))); flash(r.ref + ' marked ' + status + '.'); }
    catch (e) { flash('Couldn’t update the request. Try again.', true); }
  };

  const sec = ['orders', 'requests', 'products', 'craft'].includes(route.name) ? route.name : 'overview';
  const newOrders = orders ? orders.filter((o) => o.status === 'New').length : 0;
  const newReqs = requests ? requests.filter((r) => r.status === 'New').length : 0;
  const tabs = [{ id: 'overview', label: 'Overview', path: '' }, { id: 'orders', label: 'Orders', path: 'orders', badge: newOrders }]
    .concat(config.features.customOrders ? [{ id: 'requests', label: 'Custom requests', path: 'requests', badge: newReqs }] : [])
    .concat([{ id: 'products', label: 'Products', path: 'products' }, { id: 'craft', label: 'Our craft', path: 'craft' }]);

  let body;
  if (sec === 'products') body = <Products arg={route.arg} flash={flash} />;
  else if (sec === 'craft') body = <CraftEditor flash={flash} />;
  else if (!orders) body = loadErr ? <div className="card empty" role="alert"><p>{loadErr}</p><button className="btn btn-sm" type="button" onClick={refresh}>Try again</button></div> : <p className="loading">Loading orders…</p>;
  else if (sec === 'orders' && route.arg) body = <OrderDetail order={orders.find((o) => o.id === route.arg)} onStatus={setOrderStatus} onPrice={setCustomPrice} />;
  else if (sec === 'orders') body = <OrdersList orders={orders} />;
  else if (sec === 'requests' && route.arg) body = <RequestDetail req={(requests || []).find((r) => r.id === route.arg)} onStatus={setReqStatus} />;
  else if (sec === 'requests') body = <RequestsList requests={requests || []} />;
  else body = <Overview orders={orders} newOrders={newOrders} />;

  return (
    <div className="adm">
      <header className="top">
        <a className="logo" href="#/"><span className="logo-mark">{config.brand.mark}</span><span className="logo-sub">Dashboard</span></a>
        <div className="top-r">
          {api.isDemo ? <span className="demo-flag">Demo data</span> : null}
          <a className="btn btn-sm" href="../" target="_blank" rel="noopener">View shop</a>
          <button className="btn btn-sm" type="button" onClick={onOut}>Sign out</button>
        </div>
      </header>
      <nav className="tabs-nav" aria-label="Dashboard">
        {tabs.map((t) => (
          <a key={t.id} className={'tab' + (sec === t.id ? ' is-on' : '')} href={'#/' + t.path} aria-current={sec === t.id ? 'page' : undefined} style={{ textDecoration: 'none' }}>
            {t.label}{t.badge ? <span className="badge" aria-label={t.badge + ' new'}>{t.badge}</span> : null}
          </a>
        ))}
      </nav>
      <main className="content"><div className="content-in">
        {loadErr && orders && sec !== 'products' && sec !== 'craft' ? <p className="note" role="alert">{loadErr}</p> : null}
        {body}
      </div></main>
      <div role="status" aria-live="polite">{toast ? <div className={'toast' + (toast.bad ? ' bad' : '')}>{toast.msg}</div> : null}</div>
    </div>
  );
}

// ---------------------------------------------------------------- overview
function Overview({ orders, newOrders }) {
  const [mode, setMode] = useState('daily');      // daily | monthly
  const [metric, setMetric] = useState('revenue'); // revenue | orders
  const today = todayKey(), month = today.slice(0, 7);

  const done = orders.filter((o) => o.status === 'Completed' && o.completed_at);
  const sum = (list) => list.reduce((a, o) => a + Number(o.subtotal || 0), 0);
  const doneToday = done.filter((o) => dayKey(o.completed_at) === today);
  const doneMonth = done.filter((o) => monthKey(o.completed_at) === month);
  const receivedToday = orders.filter((o) => dayKey(o.created_at) === today).length;
  const receivedMonth = orders.filter((o) => monthKey(o.created_at) === month).length;

  const cols = useMemo(() => {
    const out = [];
    if (mode === 'daily') {
      for (let i = 13; i >= 0; i--) {
        const k = shiftDay(today, -i), list = done.filter((o) => dayKey(o.completed_at) === k);
        out.push({ k, x: i === 0 ? 'Today' : shortDate(k), long: i === 0 ? 'Today' : shortDate(k), n: list.length, rev: sum(list), skip: i % 2 === 1 && i !== 0 });
      }
    } else {
      for (let i = MONTHS_SHOWN - 1; i >= 0; i--) {
        const k = shiftMonth(month, -i), list = done.filter((o) => monthKey(o.completed_at) === k);
        out.push({ k, x: monthLabel(k).slice(0, 3), long: monthLabel(k), n: list.length, rev: sum(list), skip: false });
      }
    }
    return out;
  }, [orders, mode]);

  const val = (c) => (metric === 'revenue' ? c.rev : c.n);
  const maxV = Math.max(1, ...cols.map(val));
  const step = niceStep(maxV), top = Math.ceil(maxV / step) * step;
  const ticks = []; for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  const fmtTick = (v) => (metric === 'revenue' ? compact(v) : String(v));
  const periodTotal = cols.reduce((a, c) => a + val(c), 0);
  const recent = orders.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 6);

  return (
    <>
      <div className="page-head"><div><h1>Overview</h1><p className="muted">{longToday()}</p></div></div>

      {newOrders ? (
        <div className="alert"><p>{plural(newOrders, 'new order')} waiting to be confirmed</p><a className="btn btn-sm btn-primary" href="#/orders?status=New" onClick={(e) => { e.preventDefault(); sessionStorage.setItem('orders_filter', 'New'); navigate('orders'); }}>Review</a></div>
      ) : null}

      <div className="stats">
        <section className="card stat"><h2 className="stat-l">Orders completed today</h2><p className="stat-n">{doneToday.length}</p><p className="stat-s">{plural(receivedToday, 'new order')} received today</p></section>
        <section className="card stat stat-money"><h2 className="stat-l">Revenue today</h2><p className="stat-n">{money(sum(doneToday))}</p><p className="stat-s">From completed orders</p></section>
        <section className="card stat"><h2 className="stat-l">Orders completed this month</h2><p className="stat-n">{doneMonth.length}</p><p className="stat-s">{plural(receivedMonth, 'order')} received this month</p></section>
        <section className="card stat stat-money"><h2 className="stat-l">Revenue this month</h2><p className="stat-n">{money(sum(doneMonth))}</p><p className="stat-s">{monthLabel(month)}</p></section>
      </div>

      <section className="card" aria-labelledby="ch-h">
        <div className="card-head">
          <h2 id="ch-h">{metric === 'revenue' ? 'Revenue' : 'Completed orders'} — {mode === 'daily' ? 'last 14 days' : 'last ' + MONTHS_SHOWN + ' months'}</h2>
          <div className="chart-controls">
            <div className="seg" role="group" aria-label="Measure">
              <button className={metric === 'revenue' ? 'is-on' : ''} type="button" aria-pressed={metric === 'revenue'} onClick={() => setMetric('revenue')}>Revenue</button>
              <button className={metric === 'orders' ? 'is-on' : ''} type="button" aria-pressed={metric === 'orders'} onClick={() => setMetric('orders')}>Orders</button>
            </div>
            <div className="seg" role="group" aria-label="Period">
              <button className={mode === 'daily' ? 'is-on' : ''} type="button" aria-pressed={mode === 'daily'} onClick={() => setMode('daily')}>Daily</button>
              <button className={mode === 'monthly' ? 'is-on' : ''} type="button" aria-pressed={mode === 'monthly'} onClick={() => setMode('monthly')}>Monthly</button>
            </div>
          </div>
        </div>
        <div className="chart-wrap">
          <div className="chart">
            {ticks.map((v) => <div key={v} className={'tick' + (v === 0 ? ' zero' : '')} style={{ bottom: (v / top * 100) + '%' }} aria-hidden="true"><span>{fmtTick(v)}</span></div>)}
            <ul className="cols">
              {cols.map((c) => {
                const label = c.long + ': ' + plural(c.n, 'completed order') + ', ' + money(c.rev);
                return (
                  <li key={c.k} className="col" tabIndex={0} aria-label={label}>
                    <span className="col-hit"><span className="bar" style={{ height: (val(c) / top * 100) + '%' }} /></span>
                    <span className="tip" aria-hidden="true"><b>{c.long}</b><br />{plural(c.n, 'order')} · {money(c.rev)}</span>
                    <span className="col-x" aria-hidden="true"><span className={c.skip ? 'skip' : ''}>{c.x}</span></span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <p className="chart-cap">Total for this period: <strong className="num">{metric === 'revenue' ? money(periodTotal) : plural(periodTotal, 'order')}</strong>. Counted on the day an order is marked Completed. Revenue is the order subtotal, without delivery fees.</p>
      </section>

      <section className="card" aria-labelledby="ro-h">
        <div className="card-head"><h2 id="ro-h">Latest orders</h2><a className="btn btn-sm" href="#/orders">All orders</a></div>
        {recent.length ? <ul>{recent.map((o) => <OrderRow key={o.id} o={o} />)}</ul> : <div className="empty">No orders yet. They’ll appear here as soon as a customer sends one.</div>}
      </section>
    </>
  );
}
function niceStep(max) {
  const raw = max / 4, pow = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}
function compact(v) { return v >= 1e6 ? +(v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? +(v / 1e3).toFixed(1) + 'k' : String(v); }

// ---------------------------------------------------------------- orders
// a custom-size line arrives without a price; the owner enters it after calling the customer
const needsPrice = (o) => (o.items || []).some((it) => it.custom && it.unit_price == null);

function OrderRow({ o }) {
  return (
    <li>
      <a className="row" href={'#/orders/' + encodeURIComponent(o.id)} style={{ color: 'inherit', textDecoration: 'none' }}>
        <span className="mono muted" style={{ gridColumn: 'auto' }}>{o.ref}</span>
        <span className="row-main"><span className="ellip" style={{ fontWeight: 500 }}>{o.customer_name}</span><span className="muted small ellip">{o.region} · {o.phone}</span></span>
        <span className="row-side">
          <span className="muted small when">{dateTime(o.created_at)}</span>
          <span className="num">{money(o.subtotal)}{needsPrice(o) ? <span className="small muted"> + quote</span> : null}</span>
          <Pill s={o.status} />
        </span>
      </a>
    </li>
  );
}

function OrdersList({ orders }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(() => { const s = sessionStorage.getItem('orders_filter'); sessionStorage.removeItem('orders_filter'); return s || 'all'; });
  const qq = q.trim().toLowerCase().replace(/\s/g, '');
  const match = (o) => !qq || (o.ref + o.customer_name + o.phone + o.region).toLowerCase().replace(/\s/g, '').includes(qq);
  const sorted = orders.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const rows = sorted.filter((o) => match(o) && (status === 'all' || o.status === status));
  const chips = ['all'].concat(ORDER_STATUSES).map((s) => ({ s, n: sorted.filter((o) => match(o) && (s === 'all' || o.status === s)).length }));
  return (
    <>
      <div className="page-head"><div><h1>Orders</h1><p className="muted">Order requests from the website, last {MONTHS_SHOWN} months. Payment is cash on delivery.</p></div></div>
      <section className="card">
        <div className="toolbar">
          <label className="search"><span className="sr">Search orders</span>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" /></svg>
            <input className="input" type="search" placeholder="Order number, name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="fchips" role="group" aria-label="Filter by status">
            {chips.map((c) => <button key={c.s} className={'fchip' + (status === c.s ? ' is-on' : '')} type="button" aria-pressed={status === c.s} onClick={() => setStatus(c.s)}>{c.s === 'all' ? 'All' : c.s} <span className="fchip-n">{c.n}</span></button>)}
          </div>
        </div>
        {rows.length ? <ul>{rows.map((o) => <OrderRow key={o.id} o={o} />)}</ul> : (
          <div className="empty"><p>No orders match.</p>{q || status !== 'all' ? <button className="btn btn-sm" type="button" onClick={() => { setQ(''); setStatus('all'); }}>Clear search and filters</button> : null}</div>
        )}
      </section>
    </>
  );
}

function OrderDetail({ order: o, onStatus, onPrice }) {
  const [busy, setBusy] = useState(false);
  if (!o) return <div className="card empty"><p>Order not found.</p><a className="btn btn-sm" href="#/orders">Back to orders</a></div>;
  const idx = ORDER_FLOW.indexOf(o.status), cancelled = o.status === 'Cancelled';
  const next = !cancelled && idx >= 0 && idx < ORDER_FLOW.length - 1 ? ORDER_FLOW[idx + 1] : null;
  const pending = needsPrice(o);
  const run = async (s) => {
    if (s === 'Completed' && pending && !window.confirm('The custom size in this order has no price yet, so it won’t count in your revenue. Mark it Completed anyway?')) return;
    setBusy(true); await onStatus(o, s); setBusy(false);
  };
  const intl = String(o.phone).replace(/[^\d+]/g, '');
  const wa = customerWhatsapp(o.phone);
  return (
    <>
      <a className="back" href="#/orders" style={{ textDecoration: 'none' }}><Chevron />All orders</a>
      <div className="page-head">
        <div style={{ display: 'grid', gap: 4 }}><h1 className="mono" style={{ fontSize: 22 }}>{o.ref}</h1><p className="muted">Received {dateTime(o.created_at)}</p></div>
        <Pill s={o.status} />
      </div>

      <section className="card card-pad" style={{ display: 'grid', gap: 16 }} aria-labelledby="sx-h">
        <h2 id="sx-h" style={{ fontSize: 15, fontWeight: 600 }}>Status</h2>
        <ol className="steps" aria-label="Order progress">
          {ORDER_FLOW.map((s, j) => <li key={s} className={'step' + (!cancelled && j < idx ? ' done' : '') + (!cancelled && j === idx ? ' cur' : '')} aria-current={!cancelled && j === idx ? 'step' : undefined}><span className="step-bar" /><span>{s}</span></li>)}
        </ol>
        <div className="actions">
          {next ? <button className="btn btn-primary" type="button" disabled={busy} onClick={() => run(next)}>Mark as {next}</button> : null}
          <label className="field" style={{ gridTemplateColumns: 'auto 170px', alignItems: 'center', gap: 10 }}><span className="small muted">Set status</span>
            <select className="select" value={o.status} disabled={busy} onChange={(e) => run(e.target.value)}>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </label>
          {!cancelled && o.status !== 'Completed' ? <button className="btn btn-danger" type="button" disabled={busy} onClick={() => { if (window.confirm('Cancel order ' + o.ref + '?')) run('Cancelled'); }}>Cancel order</button> : null}
        </div>
        {o.status === 'Completed' && o.completed_at ? <p className="small muted">Completed {dateTime(o.completed_at)} — counted in that day’s revenue.</p> : <p className="small muted">Mark the order Completed once it’s delivered and paid, so it counts in your revenue.</p>}
      </section>

      <div className="detail-grid">
        <section className="card card-pad" style={{ display: 'grid', gap: 14 }} aria-labelledby="cu-h">
          <h2 id="cu-h" style={{ fontSize: 15, fontWeight: 600 }}>Customer &amp; delivery</h2>
          <dl className="dl">
            <div><dt>Name</dt><dd>{o.customer_name}</dd></div>
            <div><dt>Phone</dt><dd><a href={'tel:' + intl}>{o.phone}</a></dd></div>
            {o.email ? <div><dt>Email</dt><dd><a href={'mailto:' + o.email}>{o.email}</a></dd></div> : null}
            <div><dt>{config.regionLabel.split('/')[0].trim()}</dt><dd>{o.region}</dd></div>
            <div><dt>Address</dt><dd>{o.address}</dd></div>
            {o.notes ? <div><dt>Notes</dt><dd>{o.notes}</dd></div> : null}
          </dl>
          <div className="actions">
            <a className="btn btn-sm" href={'tel:' + intl}>Call</a>
            {wa ? <a className="btn btn-sm" href={wa + '?text=' + encodeURIComponent('Hello ' + o.customer_name + ', this is ' + config.brand.fullName + ' about your order ' + o.ref + '.')} target="_blank" rel="noopener noreferrer">WhatsApp</a> : null}
          </div>
        </section>
        <section className="card card-pad" style={{ display: 'grid', gap: 6 }} aria-labelledby="it-h">
          <h2 id="it-h" style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Items</h2>
          <ul>
            {(o.items || []).map((it, i) => (
              <li key={i} className="item-line">
                <span style={{ display: 'grid', gap: 2 }}>
                  <span style={{ fontWeight: 500 }}>{it.name} × {it.qty}</span>
                  <span className="muted small">{[it.size_label, it.size_total].filter(Boolean).join(' · ')}{it.unit_price != null ? ' · ' + money(it.unit_price) + ' each' : ''}</span>
                  {it.custom ? <CustomPrice key={o.id + i} id={'cp-' + i} item={it} onSave={(price) => onPrice(o, i, price)} /> : null}
                </span>
                <span className="num">{it.line_total != null ? money(it.line_total) : <span className="pill st-quoted">Needs price</span>}</span>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E4E2DD', paddingTop: 12, fontWeight: 600 }}><span>Subtotal{pending ? ' (custom size not priced yet)' : ''}</span><span className="num">{money(o.subtotal)}</span></div>
          <p className="small muted">Delivery fee is agreed with the customer by phone and paid on delivery.</p>
        </section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- our craft (homepage section)
// Saved in site_content under 'craft'. Until the first save, the shop shows the copy in store.config.js.
const MAX_CRAFT_ROWS = 8;
const blankRow = () => ({ title: '', copy: '', spec: '', image: '' });

function CraftEditor({ flash }) {
  const [f, setF] = useState(null);
  const [saved, setSaved] = useState([]); // photo URLs as last saved, so removed ones get deleted
  const [loadErr, setLoadErr] = useState('');
  const [failed, setFailed] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(-1);
  const [dirty, setDirty] = useState(false);
  useLeaveWarning(dirty);

  const load = useCallback(() => api.fetchContent('craft').then((v) => {
    const base = v || config.home.craft || {};
    const val = { show: !!base.show, title: base.title || '', intro: base.intro || '', details: (base.details || []).map((d) => ({ ...blankRow(), ...d })) };
    setF(val); setSaved(val.details.map((d) => d.image).filter(Boolean)); setLoadErr('');
  }).catch(() => setLoadErr('Couldn’t load this section. Check your connection.')), []);
  useEffect(() => { load(); }, [load]);

  if (!f) return loadErr ? <div className="card empty" role="alert"><p>{loadErr}</p><button className="btn btn-sm" type="button" onClick={load}>Try again</button></div> : <p className="loading">Loading…</p>;

  const set = (patch) => { setF((v) => ({ ...v, ...patch })); setDirty(true); };
  const setRow = (i, patch) => set({ details: f.details.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const move = (i, by) => { const d = f.details.slice(); [d[i], d[i + by]] = [d[i + by], d[i]]; set({ details: d }); };
  const upload = async (i, file) => {
    if (!file) return;
    setUploading(i); setFailed('');
    try { const url = await api.uploadProductImage(file, 'craft', 1600); setF((v) => ({ ...v, details: v.details.map((d, j) => (j === i ? { ...d, image: url } : d)) })); setDirty(true); }
    catch (x) { setFailed(x.message); }
    setUploading(-1);
  };

  const errors = {};
  if (tried) {
    if (f.show && !f.title.trim()) errors.title = 'Enter a heading, or untick “Show this section”.';
    f.details.forEach((d, i) => { if (!d.title.trim()) errors['row' + i] = 'Give this detail a title, or remove it.'; });
  }
  const save = async (e) => {
    e.preventDefault(); setTried(true); setFailed('');
    const hasErr = (f.show && !f.title.trim()) || f.details.some((d) => !d.title.trim());
    if (hasErr) { window.scrollTo(0, 0); return; }
    const value = { show: f.show, title: f.title.trim(), intro: f.intro.trim(), details: f.details.map((d) => ({ title: d.title.trim(), copy: d.copy.trim(), spec: d.spec.trim(), image: d.image })) };
    const images = value.details.map((d) => d.image).filter(Boolean);
    setBusy(true);
    try { await api.saveContent('craft', value, saved, images); setSaved(images); setDirty(false); setTried(false); flash('“Our craft” saved. It’s live on the homepage.'); }
    catch (x) { setFailed(x.message); window.scrollTo(0, 0); }
    setBusy(false);
  };

  return (
    <form noValidate onSubmit={save} style={{ display: 'grid', gap: 20 }}>
      <div className="page-head">
        <div><h1>Our craft</h1><p className="muted">The “Our craft” section of the homepage: how the pieces are made and finished.</p></div>
        <a className="btn btn-sm" href="/craft" target="_blank" rel="noopener">View on the site</a>
      </div>
      {Object.keys(errors).length ? <p className="note err" role="alert">Please check the highlighted fields.</p> : failed ? <p className="note err" role="alert">{failed}</p> : null}

      <section className="card card-pad form-grid" aria-labelledby="cr-h">
        <h2 id="cr-h" className="sec-h">Section</h2>
        <label className="check"><input type="checkbox" checked={f.show} onChange={(e) => set({ show: e.target.checked })} /><span>Show this section on the homepage<span className="hint">Also shows “Our Craft” in the menu.</span></span></label>
        <div className="field">
          <label htmlFor="cr-title">Heading</label>
          <input className="input" id="cr-title" value={f.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={errors.title ? 'true' : 'false'} />
          {errors.title ? <p className="err">{errors.title}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="cr-intro">Introduction</label>
          <textarea className="input" id="cr-intro" rows={3} value={f.intro} onChange={(e) => set({ intro: e.target.value })} />
        </div>
      </section>

      <section className="card card-pad form-grid" aria-labelledby="crd-h">
        <div className="sec-row"><h2 id="crd-h" className="sec-h">Details</h2><span className="small muted">{f.details.length} of {MAX_CRAFT_ROWS}</span></div>
        {f.details.length ? (
          <ul className="sizes">
            {f.details.map((d, i) => (
              <li key={i} className="size-card">
                <div className="craft-row">
                  <div className="craft-photo">
                    {d.image ? <img src={d.image} alt={d.title || 'Photo ' + (i + 1)} /> : <span className="craft-ph">No photo</span>}
                    <span className="photo-acts">
                      <label className={uploading === i ? 'is-busy' : ''}>
                        <input className="sr" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading >= 0} onChange={(e) => { upload(i, e.target.files[0]); e.target.value = ''; }} />
                        {uploading === i ? 'Uploading…' : d.image ? 'Replace' : 'Add photo'}
                      </label>
                      {d.image ? <button type="button" onClick={() => setRow(i, { image: '' })}>Remove</button> : null}
                    </span>
                  </div>
                  <div className="form-grid">
                    <div className="field"><label htmlFor={'cd-t' + i}>Title</label><input className="input" id={'cd-t' + i} placeholder="e.g. Surface" value={d.title} onChange={(e) => setRow(i, { title: e.target.value })} aria-invalid={errors['row' + i] ? 'true' : 'false'} /></div>
                    <div className="field"><label htmlFor={'cd-c' + i}>Description</label><textarea className="input" id={'cd-c' + i} rows={3} value={d.copy} onChange={(e) => setRow(i, { copy: e.target.value })} /></div>
                    <div className="field"><label htmlFor={'cd-s' + i}>Small detail <span className="muted">(optional)</span></label><input className="input" id={'cd-s' + i} placeholder="e.g. Matte canvas, 380 gsm" value={d.spec} onChange={(e) => setRow(i, { spec: e.target.value })} /></div>
                  </div>
                </div>
                {errors['row' + i] ? <p className="err">{errors['row' + i]}</p> : null}
                <div className="actions">
                  <button className="btn btn-sm" type="button" disabled={i === 0} onClick={() => move(i, -1)}>↑ Move up</button>
                  <button className="btn btn-sm" type="button" disabled={i === f.details.length - 1} onClick={() => move(i, 1)}>↓ Move down</button>
                  <button className="btn btn-sm btn-danger" type="button" onClick={() => set({ details: f.details.filter((_, j) => j !== i) })}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="small muted">No details yet.</p>}
        {f.details.length < MAX_CRAFT_ROWS ? <button className="btn btn-sm" type="button" onClick={() => set({ details: f.details.concat(blankRow()) })} style={{ justifySelf: 'start' }}>Add a detail</button> : null}
        <p className="hint">Photos: JPG, PNG or WebP. Close-ups work best — the surface, an edge, the back, the hanging kit.</p>
      </section>

      <div className="actions save-bar">
        <button className="btn btn-primary" type="submit" disabled={busy || uploading >= 0 || !dirty}>{busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
      </div>
    </form>
  );
}

// Price for a custom-size line, agreed with the customer by phone. Saving it
// updates the order subtotal (and so the revenue once the order is Completed).
function CustomPrice({ id, item, onSave }) {
  const [open, setOpen] = useState(item.unit_price == null);
  const [v, setV] = useState(item.unit_price != null ? String(item.unit_price) : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!open) return <button className="link-btn small" type="button" onClick={() => setOpen(true)}>Change price</button>;
  const save = async (e) => {
    e.preventDefault();
    if (!(Number(v) > 0)) { setErr('Enter the agreed price.'); return; }
    setBusy(true); setErr('');
    if (await onSave(Number(v))) setOpen(false);
    setBusy(false);
  };
  return (
    <form className="price-form" onSubmit={save} noValidate>
      <label className="small" htmlFor={id}>Agreed price, each ({config.currency})</label>
      <span className="price-row">
        <input className="input num" id={id} type="number" inputMode="decimal" min="0" value={v} onChange={(e) => setV(e.target.value)} />
        <button className="btn btn-sm btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save price'}</button>
      </span>
      {err ? <span className="err">{err}</span> : null}
    </form>
  );
}

// ---------------------------------------------------------------- custom requests
function RequestsList({ requests }) {
  const [status, setStatus] = useState('all');
  const rows = requests.filter((r) => status === 'all' || r.status === status);
  return (
    <>
      <div className="page-head"><div><h1>Custom requests</h1><p className="muted">Call the customer, then send them a price.</p></div></div>
      <section className="card">
        <div className="toolbar">
          <div className="fchips" role="group" aria-label="Filter by status">
            {['all'].concat(REQUEST_STATUSES).map((s) => <button key={s} className={'fchip' + (status === s ? ' is-on' : '')} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}>{s === 'all' ? 'All' : s} <span className="fchip-n">{requests.filter((r) => s === 'all' || r.status === s).length}</span></button>)}
          </div>
        </div>
        {rows.length ? (
          <ul>
            {rows.map((r) => (
              <li key={r.id}>
                <a className="row" href={'#/requests/' + encodeURIComponent(r.id)} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <span className="mono muted">{r.ref}</span>
                  <span className="row-main"><span className="ellip" style={{ fontWeight: 500 }}>{r.name}</span><span className="muted small ellip">{r.region} · {(LAYOUTS[r.layout] || { short: 'Not sure yet' }).short}</span></span>
                  <span className="row-side"><span className="muted small when">{dateTime(r.created_at)}</span><span className="small muted">{plural((r.image_paths || []).length, 'image')}</span><Pill s={r.status} /></span>
                </a>
              </li>
            ))}
          </ul>
        ) : <div className="empty">No requests with this status.</div>}
      </section>
    </>
  );
}

function RequestDetail({ req: r, onStatus }) {
  const [urls, setUrls] = useState([]);
  useEffect(() => { let on = true; if (r) api.requestImageUrls(r.image_paths).then((u) => on && setUrls(u)); return () => { on = false; }; }, [r && r.id]);
  if (!r) return <div className="card empty"><p>Request not found.</p><a className="btn btn-sm" href="#/requests">Back to requests</a></div>;
  const intl = String(r.phone).replace(/[^\d+]/g, '');
  const paths = r.image_paths || [];
  return (
    <>
      <a className="back" href="#/requests" style={{ textDecoration: 'none' }}><Chevron />All requests</a>
      <div className="page-head">
        <div style={{ display: 'grid', gap: 4 }}><h1 className="mono" style={{ fontSize: 22 }}>{r.ref}</h1><p className="muted">Received {dateTime(r.created_at)}</p></div>
        <label className="field" style={{ gridTemplateColumns: 'auto 160px', alignItems: 'center', gap: 10 }}><span className="small muted">Status</span>
          <select className="select" value={r.status} onChange={(e) => onStatus(r, e.target.value)}>{REQUEST_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
      </div>
      <div className="detail-grid">
        <section className="card card-pad" style={{ display: 'grid', gap: 14 }} aria-labelledby="rq-h">
          <h2 id="rq-h" style={{ fontSize: 15, fontWeight: 600 }}>What they want</h2>
          <dl className="dl">
            {config.features.multiPanel ? <div><dt>Arrangement</dt><dd>{(LAYOUTS[r.layout] || { label: 'Not sure yet' }).label}</dd></div> : null}
            <div><dt>Size</dt><dd>{r.size || 'Not specified'}</dd></div>
          </dl>
          <p className="quote">{r.description}</p>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>Reference images ({paths.length})</span>
            {paths.length ? (
              <ul className="req-imgs">
                {paths.map((p, i) => <li key={p}>{urls[i] ? <a href={urls[i]} target="_blank" rel="noopener noreferrer"><img src={urls[i]} alt={'Reference image ' + (i + 1)} /></a> : <span>{api.isDemo ? p : 'Loading…'}</span>}</li>)}
              </ul>
            ) : <p className="small muted">No images were attached.</p>}
          </div>
        </section>
        <section className="card card-pad" style={{ display: 'grid', gap: 14 }} aria-labelledby="rc-h">
          <h2 id="rc-h" style={{ fontSize: 15, fontWeight: 600 }}>Contact</h2>
          <dl className="dl">
            <div><dt>Name</dt><dd>{r.name}</dd></div>
            <div><dt>Phone</dt><dd><a href={'tel:' + intl}>{r.phone}</a></dd></div>
            {r.email ? <div><dt>Email</dt><dd><a href={'mailto:' + r.email}>{r.email}</a></dd></div> : null}
            <div><dt>Area</dt><dd>{r.region}</dd></div>
          </dl>
          <div className="actions"><a className="btn btn-sm" href={'tel:' + intl}>Call</a></div>
        </section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- products
// Browser "leave site?" prompt while a form has unsaved changes.
function useLeaveWarning(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}

const MAX_PHOTOS = 8;
const slugify = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const fromPrice = (p) => { const ps = (p.sizes || []).map((s) => Number(s.price) || 0); return ps.length ? (ps.length > 1 ? 'From ' : '') + money(Math.min(...ps)) : '—'; };

function Products({ arg, flash }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api.fetchAllProducts().then((d) => { setData(d); setErr(''); }).catch(() => setErr('Couldn’t load products. Check your connection.')), []);
  useEffect(() => { load(); }, [load]);

  if (!data) return err ? <div className="card empty" role="alert"><p>{err}</p><button className="btn btn-sm" type="button" onClick={load}>Try again</button></div> : <p className="loading">Loading products…</p>;
  if (!arg) return <ProductsList products={data.products} collections={data.collections} />;

  const isNew = arg === 'new';
  const product = isNew ? null : data.products.find((p) => p.id === arg);
  if (!isNew && !product) return <div className="card empty"><p>Product not found.</p><a className="btn btn-sm" href="#/products">Back to products</a></div>;
  const onSaved = (saved) => {
    setData((d) => ({ ...d, products: isNew ? d.products.concat(saved) : d.products.map((p) => (p.id === saved.id ? saved : p)) }));
    flash(saved.name + (isNew ? ' added.' : ' saved.')); navigate('products');
  };
  const onDeleted = (p) => {
    setData((d) => ({ ...d, products: d.products.filter((x) => x.id !== p.id) }));
    flash(p.name + ' deleted.'); navigate('products');
  };
  return <ProductEditor key={arg} product={product} collections={data.collections} products={data.products} onSaved={onSaved} onDeleted={onDeleted} />;
}

function ProductsList({ products, collections }) {
  const [q, setQ] = useState('');
  const [show, setShow] = useState('all'); // all | shown | hidden
  const qq = q.trim().toLowerCase();
  const match = (p) => !qq || (p.name + ' ' + p.id).toLowerCase().includes(qq);
  const inShow = (p, s) => s === 'all' || (s === 'shown' ? p.visible : !p.visible);
  const sorted = products.slice().sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
  const rows = sorted.filter((p) => match(p) && inShow(p, show));
  const collName = (id) => (collections.find((c) => c.id === id) || {}).name;
  return (
    <>
      <div className="page-head">
        <div><h1>Products</h1><p className="muted">What customers see in the shop. Changes show up straight away.</p></div>
        <a className="btn btn-primary" href="#/products/new">Add product</a>
      </div>
      <section className="card">
        <div className="toolbar">
          <label className="search"><span className="sr">Search products</span>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" /></svg>
            <input className="input" type="search" placeholder="Product name" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="fchips" role="group" aria-label="Filter">
            {[['all', 'All'], ['shown', 'In the shop'], ['hidden', 'Hidden']].map(([s, l]) => <button key={s} className={'fchip' + (show === s ? ' is-on' : '')} type="button" aria-pressed={show === s} onClick={() => setShow(s)}>{l} <span className="fchip-n">{sorted.filter((p) => match(p) && inShow(p, s)).length}</span></button>)}
          </div>
        </div>
        {rows.length ? (
          <ul className="plist">
            {rows.map((p) => (
              <li key={p.id}>
                <a className="prow" href={'#/products/' + encodeURIComponent(p.id)}>
                  <span className="pthumb" style={p.images && p.images[0] ? { backgroundImage: 'url("' + p.images[0].replace(/"/g, '%22') + '")' } : undefined}>{p.images && p.images[0] ? null : 'No photo'}</span>
                  <span className="row-main"><span className="ellip" style={{ fontWeight: 500 }}>{p.name}</span><span className="muted small ellip">{[collName(p.collection_id), config.features.multiPanel ? (LAYOUTS[p.layout] || LAYOUTS.single).short : ''].filter(Boolean).join(' · ') || 'No collection'}</span></span>
                  <span className="prow-side">
                    <span className="num">{fromPrice(p)}</span>
                    <span className="prow-pills">{!p.visible ? <Pill s="Hidden" /> : null}{p.featured ? <Pill s="Featured" /> : null}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty"><p>{products.length ? 'No products match.' : 'No products yet.'}</p>{products.length ? null : <a className="btn btn-sm btn-primary" href="#/products/new">Add your first product</a>}</div>
        )}
      </section>
    </>
  );
}

const blankSize = () => ({ label: '', total: '', panels: '', price: '' });
// Common sizes in cm, one click to add (the owner only types the price). Edit freely.
const cm = (w, h) => w + ' × ' + h + ' cm';
const SIZE_PRESETS = {
  single: [[30, 40], [40, 50], [40, 60], [50, 70], [60, 90], [70, 100]].map(([w, h]) => ({ label: cm(w, h), total: cm(w, h), panels: '' })),
  three: [[30, 40], [40, 60], [50, 70], [60, 90]].map(([w, h]) => ({ label: cm(w * 3, h), total: cm(w * 3, h), panels: '3 × (' + cm(w, h) + ')' })),
  five: [[100, 50], [150, 75], [200, 100]].map(([w, h]) => ({ label: cm(w, h), total: cm(w, h), panels: '' })),
};

function ProductEditor({ product, collections, products, onSaved, onDeleted }) {
  const isNew = !product;
  const pickable = collections.filter((c) => !c.auto_multi);
  const [f, setF] = useState(() => product
    ? { ...product, sizes: (product.sizes || []).map((s) => ({ ...blankSize(), ...s, price: String(s.price ?? '') })), images: product.images || [] }
    : { id: '', name: '', collection_id: (pickable[0] || {}).id || '', layout: 'single', description: '', images: [], sizes: [blankSize()], featured: false, visible: true, allow_custom: false,
        sort: products.reduce((m, p) => Math.max(m, Number(p.sort) || 0), 0) + 1 });
  const [idTouched, setIdTouched] = useState(false);
  const [tried, setTried] = useState(false); // after the first save attempt, errors update as the owner types
  const [failed, setFailed] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState('');
  const [dirty, setDirty] = useState(false);
  useLeaveWarning(dirty);

  const set = (patch) => { setF((v) => ({ ...v, ...patch })); setDirty(true); };
  const setName = (name) => set(isNew && !idTouched ? { name, id: slugify(name) } : { name });
  const setSize = (i, patch) => set({ sizes: f.sizes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const lay = LAYOUTS[f.layout] || LAYOUTS.single;

  const addPhotos = async (files) => {
    const list = Array.from(files).slice(0, MAX_PHOTOS - f.images.length);
    if (!list.length) return;
    setFailed('');
    const added = [];
    try {
      for (let i = 0; i < list.length; i++) {
        setUploading(list.length > 1 ? 'Uploading ' + (i + 1) + ' of ' + list.length + '…' : 'Uploading…');
        added.push(await api.uploadProductImage(list[i], f.id));
      }
    } catch (e) { setFailed(e.message); }
    setUploading('');
    if (added.length) { setF((v) => ({ ...v, images: v.images.concat(added) })); setDirty(true); }
  };
  const presets = SIZE_PRESETS[config.features.multiPanel ? f.layout : 'single'] || [];
  const addPreset = (s) => {
    const blank = f.sizes.length === 1 && !f.sizes[0].label.trim() && !String(f.sizes[0].price).trim();
    const i = blank ? 0 : f.sizes.length;
    set({ sizes: (blank ? [] : f.sizes).concat({ ...s, price: '' }) });
    setTimeout(() => { const el = document.getElementById('sz-p' + i); if (el) el.focus(); }, 0);
  };
  const movePhoto = (i) => set({ images: [f.images[i]].concat(f.images.filter((_, j) => j !== i)) });
  const removePhoto = (i) => set({ images: f.images.filter((_, j) => j !== i) });

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Enter a product name.';
    if (isNew) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.id)) e.id = 'Use lowercase English letters, numbers and dashes, e.g. neon-shrine.';
      else if (f.id === 'new') e.id = 'This link is reserved. Choose another.';
      else if (products.some((p) => p.id === f.id)) e.id = 'Another product already uses this link.';
    }
    if (!f.sizes.length) e.sizes = 'Add at least one size.';
    f.sizes.forEach((s, i) => {
      if (!s.label.trim()) e['size' + i] = 'Give this size a name, e.g. Medium.';
      else if (!(Number(s.price) > 0)) e['size' + i] = 'Enter a price above 0.';
    });
    return e;
  };
  const errors = tried ? validate() : {};

  const save = async (ev) => {
    ev.preventDefault();
    const e = validate(); setTried(true); setFailed('');
    if (Object.keys(e).length) { window.scrollTo(0, 0); return; }
    setBusy(true);
    const fields = {
      id: f.id, name: f.name.trim(), collection_id: f.collection_id || null, layout: config.features.multiPanel ? f.layout : 'single',
      description: f.description.trim(), images: f.images, featured: !!f.featured, visible: !!f.visible, allow_custom: !!f.allow_custom, sort: Number(f.sort) || 0,
      sizes: f.sizes.map((s) => ({ label: s.label.trim(), total: s.total.trim(), panels: s.panels.trim(), price: Number(s.price) })),
    };
    try { const saved = await api.saveProduct(fields, isNew, product ? product.images || [] : []); setDirty(false); onSaved(saved); }
    catch (x) { setFailed(x.message); setBusy(false); window.scrollTo(0, 0); }
  };
  const remove = async () => {
    if (!window.confirm('Delete ' + product.name + '? This can’t be undone. Past orders keep their details.\n\nTip: untick “Show in the shop” instead to hide it for now.')) return;
    setBusy(true);
    try { await api.deleteProduct(product); setDirty(false); onDeleted(product); }
    catch (x) { setFailed(x.message); setBusy(false); }
  };
  const leave = (e) => { if (dirty && !window.confirm('Leave without saving your changes?')) e.preventDefault(); };

  return (
    <form noValidate onSubmit={save} style={{ display: 'grid', gap: 20 }}>
      <a className="back" href="#/products" onClick={leave} style={{ textDecoration: 'none' }}><Chevron />All products</a>
      <div className="page-head">
        <div style={{ display: 'grid', gap: 4 }}><h1>{isNew ? 'Add product' : product.name}</h1>{isNew ? null : <p className="muted">Shop link: <span className="mono">/p/{product.id}</span></p>}</div>
        {!isNew && product.visible ? <a className="btn btn-sm" href={'/p/' + encodeURIComponent(product.id)} target="_blank" rel="noopener">View in shop</a> : null}
      </div>
      {Object.keys(errors).length ? <p className="note err" role="alert">Please check the highlighted fields.</p> : failed ? <p className="note err" role="alert">{failed}</p> : null}

      <div className="detail-grid">
        <section className="card card-pad form-grid" aria-labelledby="pd-h">
          <h2 id="pd-h" className="sec-h">Details</h2>
          <div className="field">
            <label htmlFor="pe-name">Name</label>
            <input className="input" id="pe-name" value={f.name} onChange={(e) => setName(e.target.value)} aria-invalid={errors.name ? 'true' : 'false'} />
            {errors.name ? <p className="err">{errors.name}</p> : null}
          </div>
          {isNew ? (
            <div className="field">
              <label htmlFor="pe-id">Link name</label>
              <input className="input mono" id="pe-id" value={f.id} onChange={(e) => { setIdTouched(true); set({ id: e.target.value.toLowerCase().replace(/\s+/g, '-') }); }} aria-invalid={errors.id ? 'true' : 'false'} />
              <p className="hint">The product’s web address: <span className="mono">/p/{f.id || 'your-product'}</span>. It can’t be changed later.</p>
              {errors.id ? <p className="err">{errors.id}</p> : null}
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="pe-coll">Collection</label>
            <select className="select" id="pe-coll" value={f.collection_id || ''} onChange={(e) => set({ collection_id: e.target.value })}>
              {pickable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="">No collection</option>
            </select>
          </div>
          {config.features.multiPanel ? (
            <div className="field">
              <label htmlFor="pe-layout">Arrangement</label>
              <select className="select" id="pe-layout" value={f.layout} onChange={(e) => set({ layout: e.target.value })}>
                {Object.entries(LAYOUTS).map(([k, l]) => <option key={k} value={k}>{l.label}</option>)}
              </select>
              {f.layout !== 'single' ? <p className="hint">Upload the whole artwork as one wide photo. The shop splits it across the panels.</p> : null}
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="pe-desc">Description</label>
            <textarea className="input" id="pe-desc" rows={4} value={f.description} onChange={(e) => set({ description: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="pe-sort">Position in the shop</label>
            <input className="input" id="pe-sort" type="number" inputMode="numeric" value={f.sort} onChange={(e) => set({ sort: e.target.value })} style={{ maxWidth: 140 }} />
            <p className="hint">Smaller numbers come first.</p>
          </div>
          <label className="check"><input type="checkbox" checked={!!f.visible} onChange={(e) => set({ visible: e.target.checked })} /><span>Show in the shop<span className="hint">Untick to hide it without deleting.</span></span></label>
          <label className="check"><input type="checkbox" checked={!!f.featured} onChange={(e) => set({ featured: e.target.checked })} /><span>Feature on the homepage</span></label>
        </section>

        <div style={{ display: 'grid', gap: 20 }}>
          <section className="card card-pad form-grid" aria-labelledby="ph-h">
            <div className="sec-row"><h2 id="ph-h" className="sec-h">Photos</h2><span className="small muted">{f.images.length} of {MAX_PHOTOS}</span></div>
            {f.images.length ? (
              <ul className="photos">
                {f.images.map((u, i) => (
                  <li key={u}>
                    <img src={u} alt={'Photo ' + (i + 1)} />
                    {i === 0 ? <span className="photo-main">Main</span> : null}
                    <span className="photo-acts">
                      {i > 0 ? <button type="button" onClick={() => movePhoto(i)}>Make main</button> : null}
                      <button type="button" onClick={() => removePhoto(i)}>Remove</button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="small muted">No photos yet. Without one, the shop shows a colour placeholder.</p>}
            {f.images.length < MAX_PHOTOS ? (
              <label className={'btn btn-sm upload-btn' + (uploading ? ' is-busy' : '')}>
                <input className="sr" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!!uploading} onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                {uploading || 'Add photos'}
              </label>
            ) : null}
            <p className="hint">JPG, PNG or WebP. The first photo is the main one. Large photos are resized automatically.</p>
          </section>

          <section className="card card-pad form-grid" aria-labelledby="sz-h">
            <h2 id="sz-h" className="sec-h">Sizes &amp; prices</h2>
            {presets.length ? (
              <div className="presets" role="group" aria-label="Add a standard size">
                <span className="small muted">Add a standard size:</span>
                {presets.map((s) => {
                  const taken = f.sizes.some((x) => x.total.trim() === s.total);
                  return <button key={s.label} className="preset" type="button" disabled={taken} onClick={() => addPreset(s)}>{taken ? '✓ ' : '+ '}{s.label}</button>;
                })}
              </div>
            ) : null}
            {errors.sizes ? <p className="err">{errors.sizes}</p> : null}
            <ul className="sizes">
              {f.sizes.map((s, i) => (
                <li key={i} className="size-card">
                  <div className="size-grid">
                    <div className="field"><label htmlFor={'sz-l' + i}>Size name</label><input className="input" id={'sz-l' + i} placeholder="Medium" value={s.label} onChange={(e) => setSize(i, { label: e.target.value })} /></div>
                    <div className="field"><label htmlFor={'sz-p' + i}>Price ({config.currency})</label><input className="input num" id={'sz-p' + i} type="number" inputMode="decimal" min="0" value={s.price} onChange={(e) => setSize(i, { price: e.target.value })} /></div>
                    <div className="field"><label htmlFor={'sz-t' + i}>{f.layout === 'single' ? 'Size' : 'Total size on the wall'} <span className="muted">(optional)</span></label><input className="input" id={'sz-t' + i} placeholder="150 × 75 cm" value={s.total} onChange={(e) => setSize(i, { total: e.target.value })} /></div>
                    {f.layout !== 'single' ? <div className="field"><label htmlFor={'sz-n' + i}>{lay.panelLabel} <span className="muted">(optional)</span></label><input className="input" id={'sz-n' + i} placeholder="3 × (38 × 60 cm)" value={s.panels} onChange={(e) => setSize(i, { panels: e.target.value })} /></div> : null}
                  </div>
                  {errors['size' + i] ? <p className="err">{errors['size' + i]}</p> : null}
                  {f.sizes.length > 1 ? <button className="btn btn-sm btn-danger" type="button" onClick={() => set({ sizes: f.sizes.filter((_, j) => j !== i) })} style={{ justifySelf: 'start' }}>Remove size</button> : null}
                </li>
              ))}
            </ul>
            <button className="btn btn-sm" type="button" onClick={() => set({ sizes: f.sizes.concat(blankSize()) })} style={{ justifySelf: 'start' }}>Add another size</button>
            <label className="check" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <input type="checkbox" checked={!!f.allow_custom} onChange={(e) => set({ allow_custom: e.target.checked })} />
              <span>Customers can ask for a custom size<span className="hint">They type the width × height they want. The order arrives marked “Needs price”: call them, then enter the price on the order.</span></span>
            </label>
          </section>
        </div>
      </div>

      <div className="actions save-bar">
        <button className="btn btn-primary" type="submit" disabled={busy || !!uploading}>{busy ? 'Saving…' : isNew ? 'Add product' : 'Save changes'}</button>
        <a className="btn" href="#/products" onClick={leave}>Cancel</a>
        {!isNew ? <button className="btn btn-danger" type="button" disabled={busy} onClick={remove} style={{ marginLeft: 'auto' }}>Delete product</button> : null}
      </div>
    </form>
  );
}
