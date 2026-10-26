// Sample catalogue used in DEMO MODE (when no Supabase keys are set).
// The same data is in supabase/seed.sql for the real database.
//
// Product fields:
//   layout  'single' | 'three' | 'five'   (three/five = one image split across panels)
//   images  array of image URLs; the first one is the main picture.
//           Leave empty to show the built-in colour placeholder (`art`).
//   sizes   [{ label, total, panels, price }]

export const demoCollections = [
  { id: 'anime', name: 'Anime', intro: 'Dramatic, story-driven pieces inspired by anime worlds — single framed works and multi-panel compositions.', auto_multi: false, sort: 1 },
  { id: 'gaming', name: 'Gaming', intro: 'The atmosphere of game worlds, made for the wall above your setup or anywhere else.', auto_multi: false, sort: 2 },
  { id: 'multi', name: 'Multi-Panel', intro: 'One artwork split across three or five panels to span a wall.', auto_multi: true, sort: 3 },
];

const FIVE_M = { label: 'Medium', total: '150 × 75 cm', panels: '2 × (27 × 45 cm), 2 × (27 × 61 cm), 1 × (27 × 75 cm)', price: 3900 };
const FIVE_L = { label: 'Large', total: '200 × 100 cm', panels: '2 × (36 × 60 cm), 2 × (36 × 82 cm), 1 × (36 × 100 cm)', price: 5400 };
const ONE_S = { label: 'Small', total: '40 × 50 cm', panels: '40 × 50 cm outer frame', price: 1450 };
const ONE_L = { label: 'Large', total: '60 × 75 cm', panels: '60 × 75 cm outer frame', price: 2200 };
const THREE_M = { label: 'Medium', total: '120 × 60 cm', panels: '3 × (38 × 60 cm)', price: 2600 };
const THREE_L = { label: 'Large', total: '150 × 75 cm', panels: '3 × (48 × 75 cm)', price: 3400 };

export const demoProducts = [
  { id: 'neon-shrine', name: 'Neon Shrine', collection_id: 'anime', layout: 'five', art: 'neon', images: [], featured: true, visible: true, sort: 1, created_at: '2026-10-01',
    description: 'A night skyline lit in magenta, split across five stepped panels so the glow travels the full width of the wall.', sizes: [FIVE_M, FIVE_L] },
  { id: 'last-light', name: 'Last Light', collection_id: 'anime', layout: 'single', art: 'ronin', images: [], featured: true, visible: true, sort: 2, created_at: '2026-09-20',
    description: 'A lone silhouette against a burning sky. A single framed piece built around one strong moment.', sizes: [ONE_S, ONE_L] },
  { id: 'signal-lost', name: 'Signal Lost', collection_id: 'gaming', layout: 'three', art: 'signal', images: [], featured: true, visible: true, sort: 3, created_at: '2026-09-28',
    description: 'A cold teal grid fading into a single point of light, across three equal panels.', sizes: [THREE_M, THREE_L] },
  { id: 'sakura-drift', name: 'Sakura Drift', collection_id: 'anime', layout: 'five', art: 'sakura', images: [], featured: true, visible: true, sort: 4, created_at: '2026-10-12',
    description: 'Soft pink dawn over layered peaks — the quietest piece in the collection, and the widest.', sizes: [FIVE_M, FIVE_L] },
  { id: 'boss-room', name: 'Boss Room', collection_id: 'gaming', layout: 'single', art: 'boss', images: [], featured: true, visible: true, sort: 5, created_at: '2026-08-30',
    description: 'A ring of fire in the dark. One framed piece for the moment before the final fight.', sizes: [ONE_S, ONE_L] },
  { id: 'orbit-station', name: 'Orbit Station', collection_id: 'gaming', layout: 'five', art: 'orbit', images: [], featured: true, visible: true, sort: 6, created_at: '2026-10-18',
    description: 'The curve of a blue planet seen from deep space, stretched across five stepped panels.', sizes: [FIVE_M, FIVE_L] },
  { id: 'tidecaller', name: 'Tidecaller', collection_id: 'anime', layout: 'three', art: 'tide', images: [], featured: false, visible: true, sort: 7, created_at: '2026-07-14',
    description: 'A rising wave of blues and white light, split across three panels.', sizes: [THREE_M] },
  { id: 'ember-protocol', name: 'Ember Protocol', collection_id: 'gaming', layout: 'single', art: 'ember', images: [], featured: false, visible: true, sort: 8, created_at: '2026-07-02',
    description: 'Amber smoke and sparks on charcoal. A warm, low-key framed piece.', sizes: [ONE_S] },
];
