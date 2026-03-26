const db = require('../config/database');

exports.getIngredients = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT i.id, i.name, i.unit, i.cost_per_unit, i.servings_per_unit, i.supplier_name,
              COALESCE(inv.quantity, 0) AS quantity,
              COALESCE(inv.max_capacity, 10000) AS max_capacity,
              i.reorder_level,
              inv.last_restocked
       FROM ingredients i
       LEFT JOIN ingredient_inventory inv ON inv.ingredient_id = i.id
       ORDER BY i.name ASC`
    );
    return res.json(rows);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getIngredients error:', err);
    return res.status(500).json({ error: 'Failed to load ingredients.' });
  } finally {
    connection.release();
  }
};

exports.getFinishedGoods = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT p.id,
              p.name,
              p.base_price,
              COALESCE(inv.quantity, 0) AS quantity,
              COALESCE(inv.reorder_level, 10) AS reorder_level
       FROM products p
       LEFT JOIN inventory inv ON inv.product_id = p.id
       WHERE p.product_type = 'finished-goods'
       AND p.is_active = 1
       ORDER BY p.name ASC`
    );
    return res.json(rows);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getFinishedGoods error:', err);
    return res.status(500).json({ error: 'Failed to load finished goods.' });
  } finally {
    connection.release();
  }
};

exports.getLowStock = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT i.id, i.name, inv.quantity, i.reorder_level, i.supplier_name
       FROM ingredients i
       JOIN ingredient_inventory inv ON inv.ingredient_id = i.id
       WHERE inv.quantity <= i.reorder_level
       ORDER BY inv.quantity ASC`
    );
    return res.json(rows);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getLowStock error:', err);
    return res.status(500).json({ error: 'Failed to load low stock.' });
  } finally {
    connection.release();
  }
};

exports.adjustStock = async (req, res) => {
  const { ingredient_id, product_id, quantity_change, reason, adjustment_type } = req.body || {};

  if (!['restock', 'waste', 'adjustment'].includes(adjustment_type)) {
    return res.status(400).json({ error: 'Invalid adjustment_type' });
  }

  const rawDelta = Number(quantity_change);
  if (!Number.isFinite(rawDelta) || rawDelta === 0) return res.status(400).json({ error: 'Invalid quantity_change' });
  const delta =
    adjustment_type === 'waste'
      ? -Math.abs(rawDelta)
      : adjustment_type === 'restock'
      ? Math.abs(rawDelta)
      : rawDelta;

  const employee_id = req.employee.id;

  const hasIngredient = ingredient_id !== undefined && ingredient_id !== null;
  const hasProduct = product_id !== undefined && product_id !== null;
  if (hasIngredient === hasProduct) {
    return res.status(400).json({ error: 'Provide exactly one of ingredient_id or product_id' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    if (hasIngredient) {
      const ingId = Number(ingredient_id);
      const [rows] = await connection.query(
        'SELECT quantity FROM ingredient_inventory WHERE ingredient_id = ? FOR UPDATE',
        [ingId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Ingredient inventory not found' });
      const before = Number(rows[0].quantity);
      const after = before + delta;
      if (after < 0) return res.status(400).json({ error: 'Resulting stock would be negative' });

      await connection.query(
        'UPDATE ingredient_inventory SET quantity = ?, last_restocked = IF(?, NOW(), last_restocked) WHERE ingredient_id = ?',
        [after, adjustment_type === 'restock', ingId]
      );
      await connection.query(
        `INSERT INTO inventory_transactions
         (ingredient_id, transaction_type, quantity_change, quantity_before, quantity_after, reason, reference_id, performed_by)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
        [ingId, adjustment_type, delta, before, after, reason || null, employee_id]
      );
    } else {
      const prodId = Number(product_id);
      await connection.query(
        `INSERT INTO inventory (product_id, quantity, reorder_level)
         VALUES (?, 0, 10)
         ON DUPLICATE KEY UPDATE product_id = product_id`,
        [prodId]
      );
      const [rows] = await connection.query('SELECT quantity FROM inventory WHERE product_id = ? FOR UPDATE', [prodId]);
      if (!rows.length) return res.status(404).json({ error: 'Finished-goods inventory not found' });
      const before = Number(rows[0].quantity);
      const after = before + Math.trunc(delta);
      if (after < 0) return res.status(400).json({ error: 'Resulting stock would be negative' });

      await connection.query('UPDATE inventory SET quantity = ? WHERE product_id = ?', [after, prodId]);
      await connection.query(
        `INSERT INTO inventory_transactions
         (product_id, transaction_type, quantity_change, quantity_before, quantity_after, reason, reference_id, performed_by)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
        [prodId, adjustment_type, Math.trunc(delta), before, after, reason || null, employee_id]
      );
    }

    await connection.commit();
    return res.json({ ok: true });
  } catch (err) {
    await connection.rollback();
    // eslint-disable-next-line no-console
    console.error('adjustStock error:', err);
    return res.status(500).json({ error: 'Failed to adjust stock.' });
  } finally {
    connection.release();
  }
};

