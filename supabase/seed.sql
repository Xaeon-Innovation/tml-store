-- Sample catalogue (optional). Run after schema.sql to fill the shop with the demo pieces.
-- Delete or edit them later in Supabase → Table Editor.

insert into public.collections (id, name, intro, auto_multi, sort) values
  ('anime', 'Anime', 'Dramatic, story-driven pieces inspired by anime worlds — single framed works and multi-panel compositions.', false, 1),
  ('gaming', 'Gaming', 'The atmosphere of game worlds, made for the wall above your setup or anywhere else.', false, 2),
  ('multi', 'Multi-Panel', 'One artwork split across three or five panels to span a wall.', true, 3)
on conflict (id) do nothing;

insert into public.products (id, name, collection_id, layout, description, art, sizes, featured, visible, sort, created_at) values
  ('neon-shrine', 'Neon Shrine', 'anime', 'five', 'A night skyline lit in magenta, split across five stepped panels so the glow travels the full width of the wall.', 'neon',
   '[{"label":"Medium","total":"150 × 75 cm","panels":"2 × (27 × 45 cm), 2 × (27 × 61 cm), 1 × (27 × 75 cm)","price":3900},{"label":"Large","total":"200 × 100 cm","panels":"2 × (36 × 60 cm), 2 × (36 × 82 cm), 1 × (36 × 100 cm)","price":5400}]'::jsonb, true, true, 1, '2026-10-01'),
  ('last-light', 'Last Light', 'anime', 'single', 'A lone silhouette against a burning sky. A single framed piece built around one strong moment.', 'ronin',
   '[{"label":"Small","total":"40 × 50 cm","panels":"40 × 50 cm outer frame","price":1450},{"label":"Large","total":"60 × 75 cm","panels":"60 × 75 cm outer frame","price":2200}]'::jsonb, true, true, 2, '2026-09-20'),
  ('signal-lost', 'Signal Lost', 'gaming', 'three', 'A cold teal grid fading into a single point of light, across three equal panels.', 'signal',
   '[{"label":"Medium","total":"120 × 60 cm","panels":"3 × (38 × 60 cm)","price":2600},{"label":"Large","total":"150 × 75 cm","panels":"3 × (48 × 75 cm)","price":3400}]'::jsonb, true, true, 3, '2026-09-28'),
  ('sakura-drift', 'Sakura Drift', 'anime', 'five', 'Soft pink dawn over layered peaks — the quietest piece in the collection, and the widest.', 'sakura',
   '[{"label":"Medium","total":"150 × 75 cm","panels":"2 × (27 × 45 cm), 2 × (27 × 61 cm), 1 × (27 × 75 cm)","price":3900},{"label":"Large","total":"200 × 100 cm","panels":"2 × (36 × 60 cm), 2 × (36 × 82 cm), 1 × (36 × 100 cm)","price":5400}]'::jsonb, true, true, 4, '2026-10-12'),
  ('boss-room', 'Boss Room', 'gaming', 'single', 'A ring of fire in the dark. One framed piece for the moment before the final fight.', 'boss',
   '[{"label":"Small","total":"40 × 50 cm","panels":"40 × 50 cm outer frame","price":1450},{"label":"Large","total":"60 × 75 cm","panels":"60 × 75 cm outer frame","price":2200}]'::jsonb, true, true, 5, '2026-08-30'),
  ('orbit-station', 'Orbit Station', 'gaming', 'five', 'The curve of a blue planet seen from deep space, stretched across five stepped panels.', 'orbit',
   '[{"label":"Medium","total":"150 × 75 cm","panels":"2 × (27 × 45 cm), 2 × (27 × 61 cm), 1 × (27 × 75 cm)","price":3900},{"label":"Large","total":"200 × 100 cm","panels":"2 × (36 × 60 cm), 2 × (36 × 82 cm), 1 × (36 × 100 cm)","price":5400}]'::jsonb, true, true, 6, '2026-10-18'),
  ('tidecaller', 'Tidecaller', 'anime', 'three', 'A rising wave of blues and white light, split across three panels.', 'tide',
   '[{"label":"Medium","total":"120 × 60 cm","panels":"3 × (38 × 60 cm)","price":2600}]'::jsonb, false, true, 7, '2026-07-14'),
  ('ember-protocol', 'Ember Protocol', 'gaming', 'single', 'Amber smoke and sparks on charcoal. A warm, low-key framed piece.', 'ember',
   '[{"label":"Small","total":"40 × 50 cm","panels":"40 × 50 cm outer frame","price":1450}]'::jsonb, false, true, 8, '2026-07-02')
on conflict (id) do nothing;
