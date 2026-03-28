/**
 * Ensures products.image_url is MEDIUMTEXT (base64 images exceed VARCHAR(255)).
 * Idempotent: skips if already mediumtext.
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
    const [rows] = await conn.query(
      `SELECT DATA_TYPE, COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'image_url'`
    );
    if (!rows.length) {
      // eslint-disable-next-line no-console
      console.error('Column products.image_url not found.');
      process.exit(1);
    }
    const dt = String(rows[0].DATA_TYPE || '').toLowerCase();
    if (dt === 'mediumtext' || dt === 'longtext' || dt === 'text') {
      // eslint-disable-next-line no-console
      console.log(`products.image_url is already ${rows[0].COLUMN_TYPE} — skipped`);
    } else {
      await conn.query('ALTER TABLE products MODIFY COLUMN image_url MEDIUMTEXT NULL');
      // eslint-disable-next-line no-console
      console.log('Altered products.image_url to MEDIUMTEXT');
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
