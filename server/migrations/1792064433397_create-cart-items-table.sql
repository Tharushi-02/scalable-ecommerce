-- Up Migration
CREATE TABLE cart_items (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX cart_items_product_id_idx ON cart_items (product_id);

-- Down Migration
DROP TABLE cart_items;
