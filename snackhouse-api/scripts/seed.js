const bcrypt = require('bcrypt');
require('dotenv').config();

const db = require('../config/database');

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  return rows.length > 0;
}

async function indexesForColumn(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT DISTINCT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows.map((r) => r.INDEX_NAME).filter((name) => name && name !== 'PRIMARY');
}

async function seed() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Ensure auth columns exist for username/password login.
    if (!(await columnExists(connection, 'employees', 'username'))) {
      await connection.query(`ALTER TABLE employees ADD COLUMN username VARCHAR(80) NULL`);
    }
    if (!(await columnExists(connection, 'employees', 'password_hash'))) {
      await connection.query(`ALTER TABLE employees ADD COLUMN password_hash VARCHAR(255) NULL`);
    }
    // Remove legacy PIN auth column entirely.
    if (await columnExists(connection, 'employees', 'pin')) {
      const pinIndexes = await indexesForColumn(connection, 'employees', 'pin');
      for (const idx of pinIndexes) {
        await connection.query(`ALTER TABLE employees DROP INDEX \`${idx}\``);
      }
      await connection.query(`ALTER TABLE employees DROP COLUMN pin`);
    }
    if (!(await indexExists(connection, 'employees', 'uq_employees_username'))) {
      await connection.query(`CREATE UNIQUE INDEX uq_employees_username ON employees(username)`);
    }

    const managerPasswordHash = await bcrypt.hash('admin123', 10);
    const cashierPasswordHash = await bcrypt.hash('cashier123', 10);

    await connection.query(
      `INSERT INTO employees (full_name, username, password_hash, role, is_active)
       VALUES (?, ?, ?, 'manager', 1), (?, ?, ?, 'cashier', 1)
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role = VALUES(role), is_active = VALUES(is_active),
                               password_hash = VALUES(password_hash)`,
      [
        'Manager',
        'manager',
        managerPasswordHash,
        'Juan Dela Cruz',
        'cashier',
        cashierPasswordHash
      ]
    );

    // Categories
    await connection.query(
      `INSERT INTO categories (id, name, display_order, color)
       VALUES
         (1, 'Pizza', 1, '#FFB6C1'),
         (2, 'Burgers', 2, '#FFC0CB'),
         (3, 'Drinks', 3, '#FFB6C1'),
         (4, 'Snacks', 4, '#FFC0CB')
       ON DUPLICATE KEY UPDATE name=VALUES(name), display_order=VALUES(display_order), color=VALUES(color)`
    );

    // Ingredients (id stable for sample recipes)
    await connection.query(
      `INSERT INTO ingredients (id, name, unit, cost_per_unit, supplier_name, reorder_level)
       VALUES
         (1, 'Pizza Dough', 'grams', 0.5000, 'ABC Foods', 1000),
         (2, 'Mozzarella Cheese', 'grams', 1.2000, 'XYZ Dairy', 1000),
         (3, 'Tomato Sauce', 'ml', 0.3000, 'Sauce Co', 500),
         (4, 'Pepperoni', 'grams', 1.5000, 'Meats Inc', 500),
         (5, 'Coffee', 'grams', 0.8000, 'Coffee Roasters', 300),
         (6, 'Milk', 'ml', 0.0500, 'Dairy Supply', 1000),
         (7, 'Sugar', 'grams', 0.0200, 'Sweet Supply', 500)
       ON DUPLICATE KEY UPDATE name=VALUES(name), unit=VALUES(unit), cost_per_unit=VALUES(cost_per_unit),
                               supplier_name=VALUES(supplier_name), reorder_level=VALUES(reorder_level)`
    );

    // Ingredient inventory
    await connection.query(
      `INSERT INTO ingredient_inventory (ingredient_id, quantity, max_capacity, last_restocked)
       VALUES
         (1, 8000, 10000, NOW()),
         (2, 8000, 10000, NOW()),
         (3, 5000, 10000, NOW()),
         (4, 4000, 10000, NOW()),
         (5, 2000, 5000, NOW()),
         (6, 12000, 20000, NOW()),
         (7, 5000, 10000, NOW())
       ON DUPLICATE KEY UPDATE quantity=VALUES(quantity), max_capacity=VALUES(max_capacity), last_restocked=VALUES(last_restocked)`
    );

    // Products
    await connection.query(
      `INSERT INTO products (id, name, category_id, base_price, product_type, has_variants, is_active)
       VALUES
         (1, 'Pepperoni Pizza', 1, 299.00, 'made-to-order', 0, 1),
         (2, 'Cheeseburger', 2, 149.00, 'made-to-order', 0, 1),
         (3, 'Coke 330ml', 3, 45.00, 'finished-goods', 0, 1),
         (4, 'Iced Coffee', 3, 65.00, 'made-to-order', 1, 1)
       ON DUPLICATE KEY UPDATE name=VALUES(name), category_id=VALUES(category_id), base_price=VALUES(base_price),
                               product_type=VALUES(product_type), has_variants=VALUES(has_variants), is_active=VALUES(is_active)`
    );

    // Product variants for Iced Coffee
    await connection.query(
      `INSERT INTO product_variants (id, product_id, variant_name, price, is_active)
       VALUES
         (1, 4, 'Small', 65.00, 1),
         (2, 4, 'Large', 85.00, 1)
       ON DUPLICATE KEY UPDATE variant_name=VALUES(variant_name), price=VALUES(price), is_active=VALUES(is_active)`
    );

    // Finished goods inventory (Coke)
    await connection.query(
      `INSERT INTO inventory (product_id, quantity, reorder_level)
       VALUES (3, 100, 10)
       ON DUPLICATE KEY UPDATE quantity=VALUES(quantity), reorder_level=VALUES(reorder_level)`
    );

    // Recipes
    await connection.query(
      `INSERT INTO recipes (id, product_id, variant_id, name)
       VALUES
         (1, 1, NULL, 'Pepperoni Pizza Recipe'),
         (2, 4, 1, 'Iced Coffee Small Recipe'),
         (3, 4, 2, 'Iced Coffee Large Recipe')
       ON DUPLICATE KEY UPDATE product_id=VALUES(product_id), variant_id=VALUES(variant_id), name=VALUES(name)`
    );

    // Recipe items
    await connection.query('DELETE FROM recipe_items WHERE recipe_id IN (1,2,3)');
    await connection.query(
      `INSERT INTO recipe_items (recipe_id, ingredient_id, quantity)
       VALUES
         (1, 1, 300),
         (1, 2, 250),
         (1, 3, 100),
         (1, 4, 80),
         (2, 5, 15),
         (2, 6, 200),
         (2, 7, 10),
         (3, 5, 20),
         (3, 6, 300),
         (3, 7, 15)`
    );

    await connection.commit();
    // eslint-disable-next-line no-console
    console.log('Seed complete.');
  } catch (err) {
    await connection.rollback();
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    connection.release();
  }
}

seed();

