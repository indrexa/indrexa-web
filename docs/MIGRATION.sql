-- MIGRATION SQL — DO NOT RUN — FOR REVIEW ONLY
-- Adds retailer-specific offer fields to product_price_history.
-- Review and run manually in the Supabase SQL editor.

ALTER TABLE product_price_history
  ADD COLUMN IF NOT EXISTS retailer_id text,
  ADD COLUMN IF NOT EXISTS affiliate_url text,
  ADD COLUMN IF NOT EXISTS free_shipping_available boolean,
  ADD COLUMN IF NOT EXISTS free_shipping_note text,
  ADD COLUMN IF NOT EXISTS min_order_for_free_shipping numeric;

COMMENT ON COLUMN product_price_history.retailer_id IS
  'Retailer-specific product identifier (e.g. Amazon ASIN, Walmart item ID)';

COMMENT ON COLUMN product_price_history.affiliate_url IS
  'Tracked outbound product URL for this retailer offer';

COMMENT ON COLUMN product_price_history.free_shipping_available IS
  'Whether free shipping is available for this offer (estimate only)';

COMMENT ON COLUMN product_price_history.free_shipping_note IS
  'Human-readable shipping note (e.g. free with Prime)';

COMMENT ON COLUMN product_price_history.min_order_for_free_shipping IS
  'Minimum order amount in USD required for free shipping, if applicable';

CREATE INDEX IF NOT EXISTS idx_product_price_history_retailer_id
  ON product_price_history (retailer, retailer_id);

CREATE INDEX IF NOT EXISTS idx_product_price_history_product_retailer_checked
  ON product_price_history (product_id, retailer, checked_at DESC);
