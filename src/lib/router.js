import { useEffect, useState } from 'react';

// Tiny hash router: works on any static host with no server rewrites.
//   #/                 home
//   #/shop             all pieces
//   #/shop/<collection>
//   #/p/<product-id>
//   #/checkout
//   #/order/<ref>      confirmation
//   #/custom           custom request
//   #/custom/<ref>     custom request confirmation
export function parseHash(hash) {
  const parts = (hash || '').replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'home', arg: parts[1] || '' };
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(path) {
  const target = '#/' + path.replace(/^\/+/, '');
  if (window.location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = target;
}
export const href = (path) => '#/' + path.replace(/^\/+/, '');
