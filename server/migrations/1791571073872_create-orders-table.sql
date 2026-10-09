-- Up Migration
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'cancelled');

CREATE TABLE orders (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status               order_status NOT NULL DEFAULT 'pending',
  total_amount         NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),

  shipping_name        VARCHAR(100) NOT NULL,
  shipping_line1       VARCHAR(200) NOT NULL,
  shipping_line2       VARCHAR(200),
  shipping_city        VARCHAR(100) NOT NULL,
  shipping_postal_code VARCHAR(20)  NOT NULL,
  shipping_country     VARCHAR(100) NOT NULL,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX orders_user_id_idx ON orders (user_id);

-- Down Migration
DROP TABLE orders;
DROP TYPE order_status;