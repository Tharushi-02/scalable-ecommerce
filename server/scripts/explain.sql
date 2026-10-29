\echo '=== Q1: home page, newest first ==='
EXPLAIN ANALYZE
SELECT p.id, p.name, p.price, c.name AS category
  FROM products p JOIN categories c ON c.id = p.category_id
 WHERE p.is_active = TRUE
 ORDER BY p.created_at DESC, p.id DESC
 LIMIT 20 OFFSET 0;

\echo '=== Q2: total count for pagination ==='
EXPLAIN ANALYZE
SELECT COUNT(*)
  FROM products p JOIN categories c ON c.id = p.category_id
 WHERE p.is_active = TRUE;

\echo '=== Q3: one category, cheapest first ==='
EXPLAIN ANALYZE
SELECT p.id, p.name, p.price
  FROM products p JOIN categories c ON c.id = p.category_id
 WHERE p.is_active = TRUE AND c.slug = 'books'
 ORDER BY p.price ASC, p.id ASC
 LIMIT 20;

\echo '=== Q4: search "chair" ==='
EXPLAIN ANALYZE
SELECT p.id, p.name, p.price
  FROM products p JOIN categories c ON c.id = p.category_id
 WHERE p.is_active = TRUE
   AND (p.name ILIKE '%chair%' OR p.description ILIKE '%chair%')
 ORDER BY p.created_at DESC, p.id DESC
 LIMIT 20;

\echo '=== Q5: a deep page (page 5,000) ==='
EXPLAIN ANALYZE
SELECT p.id, p.name, p.price
  FROM products p
 WHERE p.is_active = TRUE
 ORDER BY p.created_at DESC, p.id DESC
 LIMIT 20 OFFSET 99980;

\echo '=== Q6: search a rare phrase ==='
EXPLAIN ANALYZE
SELECT p.id, p.name, p.price
  FROM products p JOIN categories c ON c.id = p.category_id
 WHERE p.is_active = TRUE
   AND (p.name ILIKE '%item 123457.%' OR p.description ILIKE '%item 123457.%')
 ORDER BY p.created_at DESC, p.id DESC
 LIMIT 20;