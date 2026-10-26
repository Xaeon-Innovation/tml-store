// All data access goes through this file.
// With Supabase keys set it talks to your database; without them it runs
// in demo mode, keeping sample orders in this browser's localStorage.
import { supabase, isDemo } from './supabase.js';
import config from '../config/store.config.js';
import { demoCollections, demoProducts } from '../config/demo-data.js';

export { isDemo };

// ------------------------------------------------------------------ catalogue
export async function fetchCatalog() {
  if (isDemo) return { collections: demoCollections, products: demo.products().filter((p) => p.visible) };
  const [c, p] = await Promise.all([
    supabase.from('collections').select('*').order('sort'),
    supabase.from('products').select('*').eq('visible', true).order('sort'),
  ]);
  if (c.error) throw c.error;
  if (p.error) throw p.error;
  return { collections: c.data, products: p.data };
}

// ------------------------------------------------------------------ orders
// items: [{ product_id, size_index, qty }]. Prices are always worked out on
// the server from the products table, never trusted from the browser.
export async function placeOrder(customer, items) {
  if (isDemo) return demo.placeOrder(customer, items);
  const { data, error } = await supabase.rpc('place_order', {
    p_customer: customer, p_items: items, p_ref_prefix: config.orderRefPrefix,
  });
  if (error) throw friendly(error);
  return data; // { ref, subtotal }
}

// fields: { name, phone, email, region, layout, size, description }
export async function submitCustomRequest(fields, files) {
  if (isDemo) return demo.submitRequest(fields, files);
  const paths = [];
  for (const f of files.slice(0, 6)) {
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
    const path = crypto.randomUUID() + '/' + safe;
    const { error } = await supabase.storage.from('references').upload(path, f, { contentType: f.type, upsert: false });
    if (error) throw new Error('One of the images could not be uploaded. Try a smaller JPG or PNG (under 8 MB).');
    paths.push(path);
  }
  const { data, error } = await supabase.rpc('submit_custom_request', {
    p_request: { ...fields, image_paths: paths }, p_ref_prefix: config.customRefPrefix,
  });
  if (error) throw friendly(error);
  return data; // { ref }
}

function friendly(error) {
  const m = String((error && error.message) || '');
  if (/invalid_|missing_/.test(m)) return new Error('Some details were not accepted. Check the form and try again.');
  if (/Failed to fetch|NetworkError/i.test(m)) return new Error('No connection. Check your internet and try again.');
  return new Error('Something went wrong sending your request. Please try again, or contact us directly.');
}

// ------------------------------------------------------------------ owner
export async function getSession() {
  if (isDemo) return sessionStorage.getItem('demo_admin') ? { user: { email: sessionStorage.getItem('demo_admin') } } : null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}
export async function signIn(email, password) {
  if (isDemo) { sessionStorage.setItem('demo_admin', email); return { user: { email } }; }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Email or password is incorrect.');
  const { data: ok } = await supabase.rpc('is_admin');
  if (!ok) { await supabase.auth.signOut(); throw new Error('This account is not an owner account for this store.'); }
  return data.session;
}
export async function signOut() {
  if (isDemo) { sessionStorage.removeItem('demo_admin'); return; }
  await supabase.auth.signOut();
}

// Orders created or completed since `sinceIso`.
export async function fetchOrders(sinceIso) {
  if (isDemo) return demo.orders().filter((o) => o.created_at >= sinceIso || (o.completed_at && o.completed_at >= sinceIso));
  const { data, error } = await supabase.from('orders').select('*')
    .or(`created_at.gte."${sinceIso}",completed_at.gte."${sinceIso}"`)
    .order('created_at', { ascending: false }).limit(5000);
  if (error) throw error;
  return data;
}
export async function updateOrderStatus(id, status) {
  if (isDemo) return demo.setOrderStatus(id, status);
  const { data, error } = await supabase.from('orders').update({ status }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Price agreed by phone for a custom-size line (index `line` in order.items).
// The database recalculates the subtotal; returns the updated order.
export async function setCustomPrice(orderId, line, unitPrice) {
  if (isDemo) return demo.setCustomPrice(orderId, line, unitPrice);
  const { data, error } = await supabase.rpc('price_custom_line', { p_order: orderId, p_line: line, p_unit_price: unitPrice });
  if (error) throw error;
  return data;
}

export async function fetchRequests() {
  if (isDemo) return demo.requests();
  const { data, error } = await supabase.from('custom_requests').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data;
}
export async function updateRequestStatus(id, status) {
  if (isDemo) return demo.setRequestStatus(id, status);
  const { data, error } = await supabase.from('custom_requests').update({ status }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function requestImageUrls(paths) {
  if (isDemo || !paths || !paths.length) return [];
  const { data, error } = await supabase.storage.from('references').createSignedUrls(paths, 3600);
  if (error) return [];
  return data.map((d) => d.signedUrl).filter(Boolean);
}

// ------------------------------------------------------------------ products (dashboard)
// Hidden products included. RLS only lets admins see hidden ones or write.
export async function fetchAllProducts() {
  if (isDemo) return { collections: demoCollections, products: demo.products() };
  const [c, p] = await Promise.all([
    supabase.from('collections').select('*').order('sort'),
    supabase.from('products').select('*').order('sort').order('created_at'),
  ]);
  if (c.error) throw c.error;
  if (p.error) throw p.error;
  return { collections: c.data, products: p.data };
}
// `fields`: the editable columns only. `prevImages`: the images before editing,
// so photos the owner removed are deleted from storage after a successful save.
export async function saveProduct(fields, isNew, prevImages = []) {
  if (isDemo) return demo.saveProduct(fields, isNew);
  const q = isNew ? supabase.from('products').insert(fields) : supabase.from('products').update(fields).eq('id', fields.id);
  const { data, error } = await q.select().single();
  if (error) throw productError(error);
  removeProductImages(prevImages.filter((u) => !fields.images.includes(u)));
  return data;
}
export async function deleteProduct(p) {
  if (isDemo) return demo.deleteProduct(p.id);
  const { error } = await supabase.from('products').delete().eq('id', p.id);
  if (error) throw productError(error);
  removeProductImages(p.images || []);
}
// Returns the public URL of the uploaded photo.
export async function uploadProductImage(file, productId) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG or WebP image.');
  if (isDemo) return blobToDataUrl(await shrinkImage(file, 1200)); // small, so it fits in localStorage
  const blob = await shrinkImage(file, 3000);
  if (blob.size > 10 * 1024 * 1024) throw new Error('That photo is too large. Use one under 10 MB.');
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = (productId || 'new') + '/' + crypto.randomUUID().slice(0, 8) + '.' + ext;
  const { error } = await supabase.storage.from('product-images').upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error('The photo could not be uploaded. Check your connection and try again.');
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}
// Best effort: only touches files in our own bucket; a leftover file does no harm.
function removeProductImages(urls) {
  const marker = '/storage/v1/object/public/product-images/';
  const paths = urls.filter((u) => u.includes(marker)).map((u) => decodeURIComponent(u.split(marker)[1]));
  if (paths.length) supabase.storage.from('product-images').remove(paths).catch(() => {});
}
function productError(error) {
  if (error.code === '23505') return new Error('Another product already uses this link. Choose a different one.');
  if (error.code === '42501') return new Error('This account isn’t allowed to change products.');
  if (/Failed to fetch|NetworkError/i.test(error.message || '')) return new Error('No connection. Check your internet and try again.');
  return new Error('The product couldn’t be saved. Check the form and try again.');
}

// Phone photos are often 5–10 MB. Scale down to `max` px on the long side and
// re-encode as JPEG, which keeps the shop fast. Small files are left alone.
async function shrinkImage(file, max) {
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { return file; }
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 1.5e6) { bmp.close(); return file; }
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
  const out = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  return out || file;
}
function blobToDataUrl(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
}

// ------------------------------------------------------------------ demo mode
function makeRef(prefix, date) {
  const d = date || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return prefix + '-' + String(d.getUTCFullYear()).slice(2) + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + '-' + Math.floor(1000 + Math.random() * 9000);
}
function priceItems(items, list = demo.products()) {
  return items.map((it) => {
    const p = list.find((x) => x.id === it.product_id);
    const qty = Math.max(1, Math.min(10, it.qty | 0));
    if (it.custom) {
      if (!p || !p.allow_custom) throw new Error('A product in your bag is no longer available.');
      return { product_id: p.id, name: p.name, size_label: 'Custom size', size_total: it.custom.width + ' × ' + it.custom.height + ' cm', unit_price: null, qty, line_total: null, custom: true };
    }
    const s = p && p.sizes[it.size_index];
    if (!s) throw new Error('A product in your bag is no longer available.');
    return { product_id: p.id, name: p.name, size_label: s.label, size_total: s.total, unit_price: s.price, qty, line_total: s.price * qty };
  });
}
const sumLines = (lines) => lines.reduce((a, l) => a + (l.line_total || 0), 0);

const demo = {
  load(key, seed) {
    try { const v = JSON.parse(localStorage.getItem(key)); if (Array.isArray(v)) return v; } catch (e) { /* ignore */ }
    const s = seed(); try { localStorage.setItem(key, JSON.stringify(s)); } catch (e) { /* ignore */ }
    return s;
  },
  save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  orders() { return this.load('demo_orders_v1', seedOrders); },
  requests() { return this.load('demo_requests_v1', seedRequests); },
  products() { return this.load('demo_products_v1', () => demoProducts); },
  async saveProduct(fields, isNew) {
    await wait(300);
    const list = this.products();
    if (isNew && list.some((p) => p.id === fields.id)) throw new Error('Another product already uses this link. Choose a different one.');
    const old = list.find((p) => p.id === fields.id);
    const saved = { art: 'neon', created_at: new Date().toISOString(), ...old, ...fields };
    const next = isNew ? list.concat(saved) : list.map((p) => (p.id === fields.id ? saved : p));
    try { localStorage.setItem('demo_products_v1', JSON.stringify(next)); }
    catch (e) { throw new Error('Demo mode stores photos in this browser, and it’s full. Remove a photo or connect Supabase.'); }
    return saved;
  },
  async deleteProduct(id) { await wait(200); this.save('demo_products_v1', this.products().filter((p) => p.id !== id)); },
  async placeOrder(customer, items) {
    await wait(700);
    const lines = priceItems(items);
    const subtotal = sumLines(lines);
    const o = { id: crypto.randomUUID(), ref: makeRef(config.orderRefPrefix), customer_name: customer.name, phone: customer.phone, email: customer.email || '',
      region: customer.region, address: customer.address, notes: customer.notes || '', items: lines, subtotal, status: 'New', created_at: new Date().toISOString(), completed_at: null };
    this.save('demo_orders_v1', [o].concat(this.orders()));
    return { ref: o.ref, subtotal };
  },
  async setOrderStatus(id, status) {
    await wait(200);
    let out;
    const list = this.orders().map((o) => {
      if (o.id !== id) return o;
      out = { ...o, status, completed_at: status === 'Completed' ? (o.completed_at || new Date().toISOString()) : null };
      return out;
    });
    this.save('demo_orders_v1', list);
    return out;
  },
  async setCustomPrice(id, line, unitPrice) {
    await wait(200);
    let out;
    const list = this.orders().map((o) => {
      if (o.id !== id || !o.items[line] || !o.items[line].custom) return o;
      const items = o.items.map((it, i) => (i === line ? { ...it, unit_price: unitPrice, line_total: unitPrice * it.qty } : it));
      out = { ...o, items, subtotal: sumLines(items) };
      return out;
    });
    if (!out) throw new Error('not_found');
    this.save('demo_orders_v1', list);
    return out;
  },
  async submitRequest(fields, files) {
    await wait(700);
    const r = { id: crypto.randomUUID(), ref: makeRef(config.customRefPrefix), ...fields, image_paths: files.map((f) => f.name), status: 'New', created_at: new Date().toISOString() };
    this.save('demo_requests_v1', [r].concat(this.requests()));
    return { ref: r.ref };
  },
  async setRequestStatus(id, status) {
    let out;
    const list = this.requests().map((r) => (r.id === id ? (out = { ...r, status }) : r));
    this.save('demo_requests_v1', list);
    return out;
  },
};
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ~45 sample orders spread over the last 80 days, so the dashboard has something to show.
function seedOrders() {
  const names = ['Omar Hassan', 'Mariam Adel', 'Youssef Tarek', 'Salma Fathy', 'Karim Mostafa', 'Hana Ibrahim', 'Ahmed Gamal', 'Laila Sherif', 'Mahmoud Reda', 'Farida Nabil', 'Ziad Khaled', 'Rana Magdy', 'Hassan Wael', 'Jana Ashraf', 'Tamer Saeed'];
  const regions = ['Cairo', 'Giza', 'Alexandria', 'Dakahlia', 'Sharqia', 'Port Said'];
  let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const now = Date.now(), DAY = 864e5, out = [];
  for (let i = 0; i < 46; i++) {
    const ageDays = i < 4 ? rnd() * 0.6 : Math.pow(rnd(), 0.8) * 80;
    const created = new Date(now - ageDays * DAY - rnd() * 3600e3);
    const n = 1 + (rnd() < 0.2 ? 1 : 0);
    const items = [];
    for (let k = 0; k < n; k++) { const p = demoProducts[Math.floor(rnd() * demoProducts.length)]; items.push({ product_id: p.id, size_index: Math.floor(rnd() * p.sizes.length), qty: rnd() < 0.15 ? 2 : 1 }); }
    const lines = priceItems(items, demoProducts);
    let status, completed = null;
    if (ageDays < 1.2) status = rnd() < 0.7 ? 'New' : 'Confirmed';
    else if (ageDays < 4) status = ['Confirmed', 'Shipped', 'Completed'][Math.floor(rnd() * 3)];
    else status = rnd() < 0.1 ? 'Cancelled' : 'Completed';
    if (status === 'Completed') { const c = created.getTime() + (1 + rnd() * 4) * DAY; completed = new Date(Math.min(c, now - 3600e3)).toISOString(); }
    const name = names[Math.floor(rnd() * names.length)];
    out.push({ id: 'demo-' + i, ref: makeRef(config.orderRefPrefix, created), customer_name: name, phone: '010 ' + String(10000000 + Math.floor(rnd() * 89999999)).replace(/(\d{4})(\d{4})/, '$1 $2'),
      email: '', region: regions[Math.floor(rnd() * regions.length)], address: '[Street and building]', notes: '', items: lines,
      subtotal: lines.reduce((a, l) => a + l.line_total, 0), status, created_at: created.toISOString(), completed_at: completed });
  }
  return out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
function seedRequests() {
  const now = Date.now(), DAY = 864e5;
  return [
    { id: 'demo-r1', ref: makeRef(config.customRefPrefix, new Date(now - 0.2 * DAY)), name: 'Nour Samy', phone: '010 4455 6601', email: '', region: 'Cairo', layout: 'five', size: 'Around 180 × 90 cm, above a sofa', description: 'A five-panel piece of a city at night from my own photo. Mostly blues and purples, no text.', image_paths: ['city.jpg', 'colours.jpg'], status: 'New', created_at: new Date(now - 0.2 * DAY).toISOString() },
    { id: 'demo-r2', ref: makeRef(config.customRefPrefix, new Date(now - 2 * DAY)), name: 'Mostafa Hegazy', phone: '012 5566 7702', email: '', region: 'Giza', layout: 'single', size: '60 × 75 cm', description: 'A framed print of artwork I drew myself, for a gift.', image_paths: ['drawing.png'], status: 'Contacted', created_at: new Date(now - 2 * DAY).toISOString() },
    { id: 'demo-r3', ref: makeRef(config.customRefPrefix, new Date(now - 6 * DAY)), name: 'Habiba Fouad', phone: '011 6677 8803', email: '', region: 'Alexandria', layout: 'unsure', size: '', description: 'A landscape from a game I love for a 2.5 m wall. Not sure if three or five panels works better.', image_paths: [], status: 'Quoted', created_at: new Date(now - 6 * DAY).toISOString() },
  ];
}
