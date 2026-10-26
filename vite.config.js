import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import storeConfig from './src/config/store.config.js';
import { siteHead } from './src/lib/seo.js';

// Two pages: the shop (/) and the owner dashboard (/admin/).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), seo(env)],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          admin: resolve(__dirname, 'admin/index.html'),
        },
      },
    },
  };
});

// - Bakes the base search/preview tags into the shop's index.html (the Worker
//   swaps them for page-specific ones).
// - Writes dist/site.json so the Worker can read the catalogue. These are the
//   same public values already inside the shop's JavaScript.
function seo(env) {
  return {
    name: 'store-seo',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (resolve(ctx.filename) !== resolve(__dirname, 'index.html')) return html;
        return html.replace('<!--seo-->', siteHead(storeConfig));
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'site.json', source: JSON.stringify({ supabaseUrl: env.VITE_SUPABASE_URL || '', anonKey: env.VITE_SUPABASE_ANON_KEY || '' }) });
    },
  };
}
