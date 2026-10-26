import { useEffect, useState } from 'react';

// Tiny router with two modes:
//   'path' (shop)      real URLs like /p/neon-shrine, so search engines can index every page.
//                      The host must serve index.html for unknown paths (wrangler.jsonc does).
//   'hash' (dashboard) #/orders/… — works anywhere and is never indexed.
// Shop routes:
//   /                 home
//   /craft            home, scrolled to the craft section
//   /shop             all pieces
//   /shop/<collection>
//   /p/<product-id>
//   /checkout
//   /order/<ref>      confirmation
//   /custom           custom request
//   /custom/<ref>     custom request confirmation
let mode = 'hash';
export function setRouterMode(m) {
  mode = m;
  if (m !== 'path') return;
  // old links (#/p/neon-shrine) keep working: move them to the real path
  const fromHash = () => {
    if (!/^#\/./.test(window.location.hash)) return;
    window.history.replaceState(null, '', '/' + window.location.hash.slice(2));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  fromHash();
  window.addEventListener('hashchange', fromHash);
}

export function parseHash(hash) {
  const parts = (hash || '').replace(/^#?\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'home', arg: parts[1] || '' };
}
const current = () => parseHash(mode === 'path' ? window.location.pathname : window.location.hash);

export function useRoute() {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const on = () => setRoute(current());
    const ev = mode === 'path' ? 'popstate' : 'hashchange';
    window.addEventListener(ev, on);
    return () => window.removeEventListener(ev, on);
  }, []);
  return route;
}

export function navigate(path) {
  const clean = path.replace(/^[#/]+/, '');
  if (mode === 'path') {
    if (window.location.pathname + window.location.search !== '/' + clean) window.history.pushState(null, '', '/' + clean);
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }
  const target = '#/' + clean;
  if (window.location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = target;
}
export const href = (path) => (mode === 'path' ? '/' : '#/') + path.replace(/^[#/]+/, '');

// Shop only: plain <a href="/shop"> links switch pages without a full reload.
export function interceptLinks(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname.startsWith('/admin') || /\.\w+$/.test(url.pathname)) return;
  if (url.pathname === window.location.pathname && url.hash) return; // in-page anchor
  e.preventDefault();
  navigate(url.pathname.slice(1));
}
