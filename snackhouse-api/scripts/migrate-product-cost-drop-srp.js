/**
 * Adds products.cost_price if missing; drops products.srp if present.
 * Uses .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT).
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
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'
       AND COLUMN_NAME IN ('cost_price', 'srp')`
    );
    const names = new Set(cols.map((c) => c.COLUMN_NAME));

    if (!names.has('cost_price')) {
      await conn.query(
        `ALTER TABLE products
         ADD COLUMN cost_price DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'optional; made-to-order computed in API' AFTER base_price`
      );
      // eslint-disable-next-line no-console
      console.log('Added column: cost_price');
    } else {
      // eslint-disable-next-line no-console
      console.log('Column cost_price already exists — skipped');
    }

    const [colsAfter] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'srp'`
    );
    if (colsAfter.length) {
      await conn.query('ALTER TABLE products DROP COLUMN srp');
      // eslint-disable-next-line no-console
      console.log('Dropped column: srp');
    } else {
      // eslint-disable-next-line no-console
      console.log('Column srp not found — nothing to drop');
    }

    // eslint-disable-next-line no-console
    console.log('Migration finished OK.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
