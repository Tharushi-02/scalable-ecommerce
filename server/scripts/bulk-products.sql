-- Adds 200,000 test products for performance work.
-- Names are built from word lists so that searches like "chair" find realistic matches.
-- Remove them with:  DELETE FROM products WHERE slug LIKE 'bulk-%';   (or npm run seed)

INSERT INTO products (category_id, name, slug, description, price, stock, image_url, created_at, updated_at)
SELECT
  1 + (g % 12),                                                       -- spread over the 12 categories
  initcap(adj.word || ' ' || mat.word || ' ' || noun.word),          -- e.g. "Rustic Steel Chair"
  'bulk-' || g,                                                       -- unique slug
  'A ' || adj.word || ' ' || noun.word || ' made of ' || mat.word || '. Item ' || g || '.',
  round((5 + random() * 1995)::numeric, 2),                           -- price 5.00 to 2000.00
  (random() * 200)::int,                                              -- stock 0 to 200
  'https://picsum.photos/seed/bulk-' || (g % 1000) || '/640/480',
  now() - random() * interval '365 days',                             -- spread over the last year
  now()
FROM generate_series(1, 200000) AS g
CROSS JOIN LATERAL (SELECT (ARRAY['small','ergonomic','rustic','sleek','handmade','modern',
  'vintage','compact','premium','classic'])[1 + g % 10] AS word) AS adj
CROSS JOIN LATERAL (SELECT (ARRAY['steel','wooden','cotton','leather','plastic','granite',
  'bamboo','glass'])[1 + (g / 10) % 8] AS word) AS mat
CROSS JOIN LATERAL (SELECT (ARRAY['chair','table','lamp','keyboard','mouse','shirt','shoes',
  'hat','bottle','bag','clock','pillow','gloves','towel','speaker'])[1 + (g / 80) % 15] AS word) AS noun;

-- Refresh Postgres' statistics about the table (it uses them to plan queries)
ANALYZE products;

SELECT COUNT(*) AS total_products FROM products;