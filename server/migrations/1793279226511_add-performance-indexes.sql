-- Up Migration

-- Home page, search results and deep pages: newest first (only active products are ever listed)
CREATE INDEX products_active_newest_idx
  ON products (created_at DESC, id DESC) WHERE is_active;

-- Sort by price (low to high reads it forwards, high to low reads it backwards)
CREATE INDEX products_active_price_idx
  ON products (price, id) WHERE is_active;

-- One category: newest first, or by price
CREATE INDEX products_active_category_newest_idx
  ON products (category_id, created_at DESC, id DESC) WHERE is_active;
CREATE INDEX products_active_category_price_idx
  ON products (category_id, price, id) WHERE is_active;

-- Order history: one user's orders, newest first (replaces the plain user_id index)
CREATE INDEX orders_user_newest_idx ON orders (user_id, created_at DESC, id DESC);
DROP INDEX orders_user_id_idx;

-- Down Migration
CREATE INDEX orders_user_id_idx ON orders (user_id);
DROP INDEX orders_user_newest_idx;
DROP INDEX products_active_category_price_idx;
DROP INDEX products_active_category_newest_idx;
DROP INDEX products_active_price_idx;
DROP INDEX products_active_newest_idx;