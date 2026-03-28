/**
 * Adds order_items.unit_cost and order_items.cost_subtotal if missing.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });
  try {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items'
       AND COLUMN_NAME IN ('unit_cost', 'cost_subtotal')`
    );
    const names = new Set(cols.map((c) => c.COLUMN_NAME));
    if (!names.has('unit_cost')) {
      await conn.query(
        `ALTER TABLE order_items
         ADD COLUMN unit_cost DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'Cost per unit at checkout' AFTER subtotal`
      );
      // eslint-disable-next-line no-console
      console.log('Added order_items.unit_cost');
    } else {
      // eslint-disable-next-line no-console
      console.log('order_items.unit_cost already exists — skipped');
    }
    const [cols2] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'cost_subtotal'`
    );
    if (!cols2.length) {
      await conn.query(
        `ALTER TABLE order_items
         ADD COLUMN cost_subtotal DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'unit_cost * quantity' AFTER unit_cost`
      );
      // eslint-disable-next-line no-console
      console.log('Added order_items.cost_subtotal');
    } else {
      // eslint-disable-next-line no-console
      console.log('order_items.cost_subtotal already exists — skipped');
    }
    // eslint-disable-next-line no-console
    console.log('Done.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
