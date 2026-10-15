-- Up Migration
CREATE TYPE payment_kind AS ENUM ('charge', 'refund');
CREATE TYPE payment_status AS ENUM ('succeeded', 'failed');

CREATE TABLE payments (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id       BIGINT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  kind           payment_kind NOT NULL,
  status         payment_status NOT NULL,
  amount         NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  card_last4     CHAR(4),
  provider_ref   VARCHAR(64),
  failure_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX payments_order_id_idx ON payments (order_id);

-- At most one successful charge and one successful refund per order
CREATE UNIQUE INDEX payments_one_charge_per_order
  ON payments (order_id) WHERE kind = 'charge' AND status = 'succeeded';
CREATE UNIQUE INDEX payments_one_refund_per_order
  ON payments (order_id) WHERE kind = 'refund' AND status = 'succeeded';

ALTER TABLE orders
  ADD COLUMN paid_at      TIMESTAMPTZ,
  ADD COLUMN shipped_at   TIMESTAMPTZ,
  ADD COLUMN delivered_at TIMESTAMPTZ,
  ADD COLUMN cancelled_at TIMESTAMPTZ;

-- Down Migration
ALTER TABLE orders
  DROP COLUMN cancelled_at,
  DROP COLUMN delivered_at,
  DROP COLUMN shipped_at,
  DROP COLUMN paid_at;

DROP TABLE payments;
DROP TYPE payment_status;
DROP TYPE payment_kind;