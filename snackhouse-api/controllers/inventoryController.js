const db = require('../config/database');

const toNum = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

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
              COALESCE(inv.reorder_level, 10) AS reorder_level,
              (
                SELECT GROUP_CONCAT(v.variant_name ORDER BY v.id SEPARATOR ', ')
                FROM product_variants v
                WHERE v.product_id = p.id
                  AND (v.is_active = 1 OR v.is_active IS NULL)
              ) AS variants
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
      await connection.query(
        `INSERT INTO ingredient_inventory (ingredient_id, quantity, max_capacity)
         VALUES (?, 0, 10000)
         ON DUPLICATE KEY UPDATE ingredient_id = ingredient_id`,
        [ingId]
      );
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

exports.createIngredient = async (req, res) => {
  const { name, unit, cost_per_unit, servings_per_unit, supplier_name, reorder_level, quantity, max_capacity } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Invalid name' });
  if (!unit || typeof unit !== 'string') return res.status(400).json({ error: 'Invalid unit' });
  const cost = toNum(cost_per_unit);
  if (cost === null || cost < 0) return res.status(400).json({ error: 'Invalid cost_per_unit' });

  const servings = toNum(servings_per_unit, 1);
  const reorder = toNum(reorder_level, 0);
  const qty = toNum(quantity, 0);
  const cap = toNum(max_capacity, 10000);
  if (servings <= 0 || reorder < 0 || qty < 0 || cap <= 0) {
    return res.status(400).json({ error: 'Invalid numeric values' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [dupRows] = await connection.query('SELECT id FROM ingredients WHERE LOWER(name) = LOWER(?) LIMIT 1', [name.trim()]);
    if (dupRows.length) {
      await connection.rollback();
      return res.status(409).json({ error: 'An ingredient with that name already exists.' });
    }

    const [insert] = await connection.query(
      `INSERT INTO ingredients (name, unit, cost_per_unit, servings_per_unit, supplier_name, reorder_level)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), unit.trim(), cost, servings, supplier_name || null, reorder]
    );
    const ingredientId = insert.insertId;
    await connection.query(
      `INSERT INTO ingredient_inventory (ingredient_id, quantity, max_capacity, last_restocked)
       VALUES (?, ?, ?, IF(? > 0, NOW(), NULL))`,
      [ingredientId, qty, cap, qty]
    );

    await connection.commit();
    return res.status(201).json({ id: ingredientId });
  } catch (err) {
    await connection.rollback();
    // eslint-disable-next-line no-console
    console.error('createIngredient error:', err);
    return res.status(500).json({ error: 'Failed to create ingredient.' });
  } finally {
    connection.release();
  }
};

exports.updateIngredient = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid ingredient id' });
  const { name, unit, cost_per_unit, servings_per_unit, supplier_name, reorder_level, quantity, max_capacity } = req.body || {};

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [existsRows] = await connection.query('SELECT id FROM ingredients WHERE id = ? LIMIT 1', [id]);
    if (!existsRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    if (name !== undefined) {
      const normalizedName = String(name).trim();
      if (!normalizedName) {
        await connection.rollback();
        return res.status(400).json({ error: 'Invalid name' });
      }
      const [dupRows] = await connection.query(
        'SELECT id FROM ingredients WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1',
        [normalizedName, id]
      );
      if (dupRows.length) {
        await connection.rollback();
        return res.status(409).json({ error: 'An ingredient with that name already exists.' });
      }
    }

    const fields = [];
    const values = [];
    if (name !== undefined) {
      fields.push('name = ?');
      values.push(String(name).trim());
    }
    if (unit !== undefined) {
      fields.push('unit = ?');
      values.push(String(unit).trim());
    }
    if (cost_per_unit !== undefined) {
      const n = toNum(cost_per_unit);
      if (n === null || n < 0) {
        await connection.rollback();
        return res.status(400).json({ error: 'Invalid cost_per_unit' });
      }
      fields.push('cost_per_unit = ?');
      values.push(n);
    }
    if (servings_per_unit !== undefined) {
      const n = toNum(servings_per_unit);
      if (n === null || n <= 0) {
        await connection.rollback();
        return res.status(400).json({ error: 'Invalid servings_per_unit' });
      }
      fields.push('servings_per_unit = ?');
      values.push(n);
    }
    if (supplier_name !== undefined) {
      fields.push('supplier_name = ?');
      values.push(supplier_name || null);
    }
    if (reorder_level !== undefined) {
      const n = toNum(reorder_level);
      if (n === null || n < 0) {
        await connection.rollback();
        return res.status(400).json({ error: 'Invalid reorder_level' });
      }
      fields.push('reorder_level = ?');
      values.push(n);
    }
    if (fields.length) {
      values.push(id);
      await connection.query(`UPDATE ingredients SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    await connection.query(
      `INSERT INTO ingredient_inventory (ingredient_id, quantity, max_capacity)
       VALUES (?, 0, 10000)
       ON DUPLICATE KEY UPDATE ingredient_id = ingredient_id`,
      [id]
    );
    if (quantity !== undefined || max_capacity !== undefined) {
      const invFields = [];
      const invValues = [];
      if (quantity !== undefined) {
        const n = toNum(quantity);
        if (n === null || n < 0) {
          await connection.rollback();
          return res.status(400).json({ error: 'Invalid quantity' });
        }
        invFields.push('quantity = ?');
        invValues.push(n);
      }
      if (max_capacity !== undefined) {
        const n = toNum(max_capacity);
        if (n === null || n <= 0) {
          await connection.rollback();
          return res.status(400).json({ error: 'Invalid max_capacity' });
        }
        invFields.push('max_capacity = ?');
        invValues.push(n);
      }
      if (invFields.length) {
        invValues.push(id);
        await connection.query(`UPDATE ingredient_inventory SET ${invFields.join(', ')} WHERE ingredient_id = ?`, invValues);
      }
    }

    await connection.commit();
    return res.json({ ok: true });
  } catch (err) {
    await connection.rollback();
    // eslint-disable-next-line no-console
    console.error('updateIngredient error:', err);
    return res.status(500).json({ error: 'Failed to update ingredient.' });
  } finally {
    connection.release();
  }
};

exports.deleteIngredient = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid ingredient id' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT id, name FROM ingredients WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    const [recipeRefs] = await connection.query(
      `SELECT COUNT(*) AS cnt
       FROM recipe_items
       WHERE ingredient_id = ?`,
      [id]
    );
    if (Number(recipeRefs[0].cnt) > 0) {
      await connection.rollback();
      return res.status(409).json({
        error: `Cannot delete "${rows[0].name}" because it is used by product recipes.`
      });
    }

    await connection.query('DELETE FROM inventory_transactions WHERE ingredient_id = ?', [id]);
    await connection.query('DELETE FROM ingredient_inventory WHERE ingredient_id = ?', [id]);
    await connection.query('DELETE FROM ingredients WHERE id = ?', [id]);
    await connection.commit();
    return res.json({ ok: true });
  } catch (err) {
    await connection.rollback();
    // eslint-disable-next-line no-console
    console.error('deleteIngredient error:', err);
    return res.status(500).json({ error: 'Failed to delete ingredient.' });
  } finally {
    connection.release();
  }
};

