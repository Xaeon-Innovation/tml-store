import config from '../config/store.config.js';

export const LAYOUTS = {
  single: { label: 'Single framed piece', short: 'Framed', panels: 1, panelLabel: 'Frame size' },
  three: { label: 'Three panels, equal height', short: 'Three panels', panels: 3, panelLabel: 'Each panel' },
  five: { label: 'Five panels, stepped', short: 'Five panels', panels: 5, panelLabel: 'Panels' },
};
export const layoutOf = (p) => LAYOUTS[p && p.layout] || LAYOUTS.single;

export const ORDER_STATUSES = ['New', 'Confirmed', 'Shipped', 'Completed', 'Cancelled'];
export const ORDER_FLOW = ['New', 'Confirmed', 'Shipped', 'Completed'];
export const REQUEST_STATUSES = ['New', 'Contacted', 'Quoted', 'Closed'];

export function money(n) {
  return config.currency + ' ' + Number(n || 0).toLocaleString(config.numberLocale, { maximumFractionDigits: 2 });
}
export function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

// Date helpers that respect the store's timezone (not the visitor's).
const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
export function dayKey(iso) { return iso ? keyFmt.format(new Date(iso)) : ''; }      // 2026-10-26
export function monthKey(iso) { return dayKey(iso).slice(0, 7); }                  // 2026-10
export function todayKey() { return keyFmt.format(new Date()); }
export function shiftDay(key, delta) {
  const d = new Date(key + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10);
}
export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + delta, 1)); return d.toISOString().slice(0, 7);
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function monthLabel(mk) { return MONTHS[+mk.slice(5, 7) - 1] + ' ' + mk.slice(0, 4); }
export function shortDate(key) { return (+key.slice(8, 10)) + ' ' + MONTHS[+key.slice(5, 7) - 1]; }
export function dateTime(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
export function longToday() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
}

export function validPhone(v) { const d = String(v || '').replace(/[\s\-().]/g, ''); return /^\+?\d{8,15}$/.test(d); }
export function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()); }

export function whatsappLink(text) {
  const n = String(config.contact.whatsapp || '').replace(/\D/g, '');
  return n ? 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '') : '';
}

// Customer phone → wa.me link. Local numbers (e.g. 010…) get the store's country code.
export function customerWhatsapp(phone) {
  let d = String(phone || '').trim();
  const plus = d.startsWith('+') || d.startsWith('00');
  d = d.replace(/\D/g, '').replace(/^00/, '');
  if (!d) return '';
  if (!plus) d = String(config.phoneCountryCode || '').replace(/\D/g, '') + d.replace(/^0+/, '');
  return 'https://wa.me/' + d;
}
