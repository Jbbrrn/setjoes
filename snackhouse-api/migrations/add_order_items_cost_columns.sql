-- Snapshot cost at sale time for reporting (historical margin).
ALTER TABLE order_items
  ADD COLUMN unit_cost DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'Cost per unit at checkout' AFTER subtotal,
  ADD COLUMN cost_subtotal DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'unit_cost * quantity' AFTER unit_cost;
