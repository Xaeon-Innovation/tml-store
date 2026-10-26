import { useEffect, useState } from 'react';
import config from '../config/store.config.js';
import { placeOrder, submitCustomRequest } from '../lib/api.js';
import { money, validEmail, validPhone, whatsappLink } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { Art, ErrorSummary, Field, Glyph, Icon, fieldProps, focusFirstError } from './shared.jsx';

function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => {
    const v = e.target.value;
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((er) => { if (!er[k]) return er; const n = { ...er }; delete n[k]; return n; });
  };
  return { values, setValues, errors, setErrors, set };
}

function RegionSelect({ id, value, onChange, error }) {
  return (
    <select className="select input" {...fieldProps(id, error)} autoComplete="address-level1" value={value} onChange={onChange}>
      <option value="">Select…</option>
      {config.regions.map((r) => <option key={r} value={r}>{r}</option>)}
    </select>
  );
}

function SummaryLines({ lines }) {
  return (
    <ul style={{ display: 'grid', gap: 12 }}>
      {lines.map((l) => (
        <li key={l.key} className="sum-line">
          <span className="mini">{l.product ? <Art product={l.product} /> : null}</span>
          <span className="sum-meta"><span>{l.name} × {l.qty}</span><span>{l.sizeLabel}</span></span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(l.lineTotal)}</span>
        </li>
      ))}
    </ul>
  );
}

// =====================================================================
// CHECKOUT (order request, cash on delivery)
// =====================================================================
export function Checkout({ lines, subtotal, onPlaced, openBag }) {
  const f = useForm({ name: '', phone: '', email: '', region: '', address: '', notes: '', company: '' });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');
  const v = f.values, e = f.errors;

  const submit = async (ev) => {
    ev.preventDefault();
    if (busy) return;
    const errs = {};
    if (!v.name.trim()) errs.name = 'Enter your full name.';
    if (!v.phone.trim()) errs.phone = 'Enter a phone number so we can confirm your order.';
    else if (!validPhone(v.phone)) errs.phone = 'Enter a valid phone number, for example ' + config.phoneExample + '.';
    if (v.email.trim() && !validEmail(v.email)) errs.email = 'Enter a valid email address, or leave it blank.';
    if (!v.region) errs.region = 'Choose your ' + config.regionLabel.toLowerCase() + '.';
    if (v.address.trim().length < 6) errs.address = 'Enter the delivery address, including the street and building.';
    f.setErrors(errs);
    if (Object.keys(errs).length) { focusFirstError(errs, 'co'); return; }
    if (v.company) return; // spam bot filled the hidden field
    setBusy(true); setFailed('');
    try {
      const customer = { name: v.name.trim(), phone: v.phone.trim(), email: v.email.trim(), region: v.region, address: v.address.trim(), notes: v.notes.trim() };
      const res = await placeOrder(customer, lines.map((l) => ({ product_id: l.productId, size_index: l.sizeIdx, qty: l.qty })));
      onPlaced({ ref: res.ref, subtotal: res.subtotal, lines, phone: customer.phone, region: customer.region, name: customer.name });
    } catch (err) {
      setFailed(err.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <section className="wrap form-page">
      <button className="back" type="button" onClick={openBag}><Icon.back />Back to bag</button>
      <header className="form-head">
        <h1 className="display h1">Order request</h1>
        <p>No payment is taken online — you pay cash on delivery. Send us your details and we’ll call you to confirm the order and delivery fee.</p>
      </header>
      {!lines.length ? (
        <div className="empty">
          <h2 className="display" style={{ fontSize: 32 }}>Your bag is empty.</h2>
          <p>Add a piece to your bag to send an order request.</p>
          <div className="empty-actions"><a className="btn btn-primary" href="#/shop">Explore collections</a></div>
        </div>
      ) : (
        <div className="co-grid">
          <form className="form" noValidate onSubmit={submit}>
            <ErrorSummary errors={e} prefix="co" />
            {failed ? <p className="form-err" role="alert">{failed}</p> : null}
            <fieldset>
              <legend className="label">Your details</legend>
              <Field id="co-name" label="Full name" error={e.name}><input className="input" type="text" autoComplete="name" {...fieldProps('co-name', e.name)} value={v.name} onChange={f.set('name')} /></Field>
              <div className="two">
                <Field id="co-phone" label="Phone number" error={e.phone}><input className="input" type="tel" inputMode="tel" autoComplete="tel" {...fieldProps('co-phone', e.phone)} value={v.phone} onChange={f.set('phone')} /></Field>
                <Field id="co-email" label="Email" optional error={e.email}><input className="input" type="email" autoComplete="email" {...fieldProps('co-email', e.email)} value={v.email} onChange={f.set('email')} /></Field>
              </div>
            </fieldset>
            <fieldset>
              <legend className="label">Delivery</legend>
              <Field id="co-region" label={config.regionLabel} error={e.region}><RegionSelect id="co-region" value={v.region} onChange={f.set('region')} error={e.region} /></Field>
              <Field id="co-address" label="Delivery address" error={e.address}><textarea className="input" rows={3} autoComplete="street-address" {...fieldProps('co-address', e.address)} value={v.address} onChange={f.set('address')} /></Field>
              <Field id="co-notes" label="Notes" optional hint="Landmarks, preferred contact times, or anything we should know."><textarea className="input" rows={3} {...fieldProps('co-notes', null, true)} value={v.notes} onChange={f.set('notes')} /></Field>
              <label className="hp" aria-hidden="true">Company<input tabIndex={-1} autoComplete="off" value={v.company} onChange={f.set('company')} /></label>
            </fieldset>
            <div style={{ display: 'grid', gap: 12 }}>
              <button className="btn btn-primary btn-block" type="submit" disabled={busy} aria-busy={busy}>
                {busy ? <><span className="spinner" aria-hidden="true" />Sending your request…</> : 'Submit order request'}
              </button>
              <p className="submit-note">We’ll call you to confirm before anything is made or sent. Payment is cash on delivery.</p>
            </div>
          </form>
          <aside className="summary" aria-labelledby="sum-h">
            <h2 id="sum-h">Order summary</h2>
            <SummaryLines lines={lines} />
            <div className="sum-row"><span>Delivery</span><span>Confirmed by phone</span></div>
            <div className="sum-tot"><span>Subtotal</span><strong style={{ fontWeight: 500 }}>{money(subtotal)}</strong></div>
            <button className="rm" type="button" onClick={openBag} style={{ justifySelf: 'start' }}>Edit bag</button>
          </aside>
        </div>
      )}
    </section>
  );
}

// =====================================================================
// ORDER CONFIRMATION
// =====================================================================
export function Confirm({ refCode }) {
  let o = null;
  try { o = JSON.parse(sessionStorage.getItem('order_' + refCode)); } catch (e) { /* ignore */ }
  const wa = config.features.whatsappConfirm ? whatsappLink('Hello, I just sent order request ' + refCode + (o ? ' (' + o.name + ')' : '') + '. Please confirm it.') : '';
  return (
    <section className="wrap">
      <div className="done">
        <span className="done-mark" aria-hidden="true"><Icon.check /></span>
        <h1 className="display h1">Order request received.</h1>
        <p style={{ fontSize: 18 }}>We’ll call you to confirm the details.</p>
        <div style={{ display: 'grid', gap: 8 }}><span className="label">Order reference</span><span className="ref">{refCode}</span></div>
        <p className="status-note"><Icon.info /><span>Nothing has been charged. You pay cash when your order is delivered.</span></p>
        <ol className="steps">
          <li><span className="label">01</span><span><strong>We check availability</strong> for the pieces and sizes you chose.</span></li>
          <li><span className="label">02</span><span><strong>We call you{o ? ' on ' + o.phone : ''}</strong> to confirm delivery{o ? ' to ' + o.region : ''} and the delivery fee.</span></li>
          <li><span className="label">03</span><span><strong>Your order is delivered</strong> and you pay cash on delivery.</span></li>
        </ol>
        {wa ? <a className="btn btn-ghost wa-btn" href={wa} target="_blank" rel="noopener noreferrer"><Icon.whatsapp />Confirm on WhatsApp</a> : null}
        {o ? (
          <div className="summary">
            <h2>Submitted items</h2>
            <SummaryLines lines={o.lines} />
            <div className="sum-tot"><span>Subtotal · before delivery</span><strong style={{ fontWeight: 500 }}>{money(o.subtotal)}</strong></div>
          </div>
        ) : null}
        <a className="btn btn-ghost" href="#/shop">Continue browsing</a>
      </div>
    </section>
  );
}

// =====================================================================
// CUSTOM REQUEST
// =====================================================================
const LAYOUT_OPTS = [{ id: 'single', label: 'Single framed' }, { id: 'three', label: 'Three panels' }, { id: 'five', label: 'Five panels' }, { id: 'unsure', label: 'Not sure yet' }];
const MAX_FILES = 6, MAX_MB = 8;

export function Custom() {
  const f = useForm({ layout: '', size: '', description: '', name: '', phone: '', email: '', region: '', company: '' });
  const [files, setFiles] = useState([]);
  const [fileErr, setFileErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');
  const v = f.values, e = f.errors;
  const multi = config.features.multiPanel;

  useEffect(() => {
    try {
      const pre = JSON.parse(sessionStorage.getItem('custom_prefill'));
      if (pre) { f.setValues((s) => ({ ...s, layout: pre.layout || '', description: pre.description || '' })); sessionStorage.removeItem('custom_prefill'); }
    } catch (err) { /* ignore */ }
  }, []);
  useEffect(() => () => files.forEach((x) => URL.revokeObjectURL(x.url)), []);

  const addFiles = (ev) => {
    const list = Array.from(ev.target.files || []);
    const ok = list.filter((x) => /^image\/(jpeg|png|webp)$/.test(x.type) && x.size <= MAX_MB * 1048576);
    setFileErr(ok.length < list.length ? 'Some files were skipped — use JPG, PNG or WebP images under ' + MAX_MB + ' MB.' : '');
    setFiles((cur) => cur.concat(ok.map((file, i) => ({ id: Date.now() + '-' + i, file, url: URL.createObjectURL(file) }))).slice(0, MAX_FILES));
    ev.target.value = '';
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (busy) return;
    const errs = {};
    if (multi && !v.layout) errs.layout = 'Choose an arrangement — or “Not sure yet”.';
    if (v.description.trim().length < 10) errs.description = 'Tell us a little more about the idea (at least a sentence).';
    if (!v.name.trim()) errs.name = 'Enter your name.';
    if (!v.phone.trim()) errs.phone = 'Enter a phone number so we can contact you.';
    else if (!validPhone(v.phone)) errs.phone = 'Enter a valid phone number, for example ' + config.phoneExample + '.';
    if (v.email.trim() && !validEmail(v.email)) errs.email = 'Enter a valid email address, or leave it blank.';
    if (!v.region) errs.region = 'Choose your ' + config.regionLabel.toLowerCase() + '.';
    f.setErrors(errs);
    if (Object.keys(errs).length) { focusFirstError(errs, 'cu'); return; }
    if (v.company) return;
    setBusy(true); setFailed('');
    try {
      const res = await submitCustomRequest({ layout: multi ? v.layout : 'single', size: v.size.trim(), description: v.description.trim(), name: v.name.trim(), phone: v.phone.trim(), email: v.email.trim(), region: v.region }, files.map((x) => x.file));
      navigate('custom/' + encodeURIComponent(res.ref));
    } catch (err) {
      setFailed(err.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <section className="wrap form-page">
      <header className="form-head">
        <p className="label">Custom orders</p>
        <h1 className="display h1">Request a custom piece</h1>
        <p>Tell us about the piece you have in mind. Every request is reviewed individually — we’ll contact you with pricing and next steps.</p>
      </header>
      <div className="co-grid">
        <form className="form" noValidate onSubmit={submit}>
          <ErrorSummary errors={e} prefix="cu" />
          {failed ? <p className="form-err" role="alert">{failed}</p> : null}
          <fieldset>
            <legend className="label">Your idea</legend>
            {multi ? (
              <div className={'field' + (e.layout ? ' has-err' : '')}>
                <span className="flabel" id="cu-layout-l">Size or panel arrangement</span>
                <div className="arr-opts" role="radiogroup" id="cu-layout" aria-labelledby="cu-layout-l" aria-describedby={e.layout ? 'cu-layout-err' : undefined}>
                  {LAYOUT_OPTS.map((o) => (
                    <label key={o.id} className={'arr-opt' + (v.layout === o.id ? ' is-sel' : '')}>
                      <input className="sr" type="radio" name="cu-layout" value={o.id} checked={v.layout === o.id} onChange={f.set('layout')} />
                      {o.id === 'unsure' ? <span className="glyph" aria-hidden="true" /> : <Glyph layout={o.id} />}
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
                {e.layout ? <p className="err" id="cu-layout-err">{e.layout}</p> : null}
              </div>
            ) : null}
            <Field id="cu-size" label="Approximate size" optional hint="For example “150 × 75 cm” or “the wall above a 2-metre sofa”."><input className="input" type="text" {...fieldProps('cu-size', null, true)} value={v.size} onChange={f.set('size')} /></Field>
            <div className="field">
              <span className="flabel" id="cu-files-l">Reference images <span className="opt">(optional, up to {MAX_FILES})</span></span>
              {files.length < MAX_FILES ? (
                <div className="drop">
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addFiles} aria-labelledby="cu-files-l" aria-describedby="cu-files-hint" />
                  <Icon.upload />
                  <span className="drop-t">Add images</span>
                  <span className="hint" id="cu-files-hint">JPG, PNG or WebP, up to {MAX_MB} MB each.</span>
                </div>
              ) : null}
              {fileErr ? <p className="err">{fileErr}</p> : null}
              {files.length ? (
                <ul className="files">
                  {files.map((x) => (
                    <li key={x.id} className="file"><img src={x.url} alt={'Reference image: ' + x.file.name} />
                      <button className="file-x" type="button" aria-label={'Remove ' + x.file.name} onClick={() => { URL.revokeObjectURL(x.url); setFiles((c) => c.filter((y) => y.id !== x.id)); }}><Icon.x12 /></button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <Field id="cu-description" label="Describe the idea" error={e.description}><textarea className="input" rows={5} {...fieldProps('cu-description', e.description)} value={v.description} onChange={f.set('description')} /></Field>
          </fieldset>
          <fieldset>
            <legend className="label">Your details</legend>
            <Field id="cu-name" label="Name" error={e.name}><input className="input" type="text" autoComplete="name" {...fieldProps('cu-name', e.name)} value={v.name} onChange={f.set('name')} /></Field>
            <div className="two">
              <Field id="cu-phone" label="Phone number" error={e.phone}><input className="input" type="tel" inputMode="tel" autoComplete="tel" {...fieldProps('cu-phone', e.phone)} value={v.phone} onChange={f.set('phone')} /></Field>
              <Field id="cu-email" label="Email" optional error={e.email}><input className="input" type="email" autoComplete="email" {...fieldProps('cu-email', e.email)} value={v.email} onChange={f.set('email')} /></Field>
            </div>
            <Field id="cu-region" label={config.regionLabel} error={e.region}><RegionSelect id="cu-region" value={v.region} onChange={f.set('region')} error={e.region} /></Field>
            <label className="hp" aria-hidden="true">Company<input tabIndex={-1} autoComplete="off" value={v.company} onChange={f.set('company')} /></label>
          </fieldset>
          <div style={{ display: 'grid', gap: 12 }}>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy} aria-busy={busy}>
              {busy ? <><span className="spinner" aria-hidden="true" />Sending your request…</> : 'Request a custom piece'}
            </button>
            <p className="submit-note">No automatic quote and no payment — we’ll review your request and contact you.</p>
          </div>
        </form>
        <aside className="custom-aside">
          <p className="label">How it works</p>
          <ol>
            <li><span className="label">01</span><span><strong>Send your idea</strong>A reference image, the size and a short description.</span></li>
            <li><span className="label">02</span><span><strong>We review it</strong>We check the details and may ask a few questions.</span></li>
            <li><span className="label">03</span><span><strong>You get a price</strong>We contact you with pricing. Nothing is made until you agree.</span></li>
          </ol>
        </aside>
      </div>
    </section>
  );
}

export function CustomDone({ refCode }) {
  return (
    <section className="wrap">
      <div className="done">
        <span className="done-mark" aria-hidden="true"><Icon.check /></span>
        <h1 className="display h1">Request received.</h1>
        <p style={{ fontSize: 18, maxWidth: '46ch' }}>We’ll review your request and contact you with pricing and next steps.</p>
        <div style={{ display: 'grid', gap: 8 }}><span className="label">Request reference</span><span className="ref">{refCode}</span></div>
        <p className="status-note"><Icon.info /><span>Nothing has been charged, and nothing is made until you’ve agreed a price with us.</span></p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <a className="btn btn-ghost" href="#/shop">Explore collections</a>
          <a className="btn btn-ghost" href="#/">Back to home</a>
        </div>
      </div>
    </section>
  );
}
