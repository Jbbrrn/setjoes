-- Run once against your Snackhouse database.
-- Retail price is `base_price` only. This adds optional `cost_price` for margin (finished goods)
-- and made-to-order recipe cost is computed in the API from ingredients.
ALTER TABLE products
  ADD COLUMN cost_price DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'finished-goods: optional manual; made-to-order: computed from recipe in API' AFTER base_price;

-- If you added a separate `srp` column earlier, drop it (use base_price as the selling price):
-- ALTER TABLE products DROP COLUMN srp;

-- Line-item cost snapshots for sales reports: see add_order_items_cost_columns.sql
-- or run: node scripts/migrate-order-items-cost.js
