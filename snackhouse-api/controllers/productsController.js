const db = require('../config/database');

// Returns products plus a computed `current_stock` for the POS stock indicator.
exports.getProducts = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const activeFilter = req.employee && req.employee.role === 'manager' ? '' : 'WHERE p.is_active = 1';
    const [rows] = await connection.query(
      `SELECT p.id, p.name, p.category_id, p.base_price, p.product_type, p.has_variants, p.is_active, p.image_url,
              c.name AS category_name, c.display_order
       FROM products p
       JOIN categories c ON c.id = p.category_id
       ${activeFilter}
       ORDER BY c.display_order ASC, p.name ASC`
    );

    // Preload variants for products that have them (POS uses this for variant modal).
    const productIds = rows.map((r) => r.id);
    const variantsByProduct = new Map();
    if (productIds.length) {
      const [variantRows] = await connection.query(
        `SELECT id, product_id, variant_name, price
         FROM product_variants
         WHERE is_active = 1 AND product_id IN (${productIds.map(() => '?').join(',')})
         ORDER BY product_id ASC, id ASC`,
        productIds
      );
      for (const v of variantRows) {
        if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
        variantsByProduct.get(v.product_id).push({
          id: v.id,
          variant_name: v.variant_name,
          price: Number(v.price)
        });
      }
    }

    // Compute current_stock:
    // - finished-goods: inventory.quantity
    // - made-to-order: min over recipe_items (ingredient_inventory.quantity / recipe_item.quantity)
    const products = [];
    for (const r of rows) {
      let current_stock = null;
      let reorder_level = null;

      if (r.product_type === 'finished-goods') {
        const [invRows] = await connection.query(
          'SELECT quantity, reorder_level FROM inventory WHERE product_id = ?',
          [r.id]
        );
        if (invRows.length) {
          current_stock = Number(invRows[0].quantity);
          reorder_level = Number(invRows[0].reorder_level);
        } else {
          current_stock = 0;
          reorder_level = 10;
        }
      } else {
        // Select best recipe: if variants exist, prefer variant-specific? For listing we use NULL variant recipe if present.
        const [recipeRows] = await connection.query(
          `SELECT id
           FROM recipes
           WHERE product_id = ? AND variant_id IS NULL
           ORDER BY id ASC
           LIMIT 1`,
          [r.id]
        );
        if (!recipeRows.length) {
          current_stock = null;
        } else {
          const recipeId = recipeRows[0].id;
          const [riRows] = await connection.query(
            `SELECT ri.quantity AS per_serving, inv.quantity AS on_hand
             FROM recipe_items ri
             JOIN ingredient_inventory inv ON inv.ingredient_id = ri.ingredient_id
             WHERE ri.recipe_id = ?`,
            [recipeId]
          );
          let possible = Infinity;
          for (const ri of riRows) {
            const per = Number(ri.per_serving);
            const onHand = Number(ri.on_hand);
            if (per <= 0) continue;
            possible = Math.min(possible, Math.floor(onHand / per));
          }
          current_stock = possible === Infinity ? null : possible;
        }
      }

      products.push({
      id: r.id,
      name: r.name,
      category_id: r.category_id,
      category_name: r.category_name,
      base_price: r.base_price,
      product_type: r.product_type,
      has_variants: !!r.has_variants,
      image_url: r.image_url,
      current_stock,
      reorder_level,
      variants: variantsByProduct.get(r.id) || []
    });
    }

    return res.json(products);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getProducts error:', err);
    return res.status(500).json({ error: 'Failed to load products.' });
  } finally {
    connection.release();
  }
};

exports.createProduct = async (req, res) => {
  const { name, category_id, base_price, product_type, image_url } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Invalid name' });
  if (!Number.isFinite(Number(category_id))) return res.status(400).json({ error: 'Invalid category_id' });
  if (!Number.isFinite(Number(base_price))) return res.status(400).json({ error: 'Invalid base_price' });
  if (!['made-to-order', 'finished-goods'].includes(product_type)) {
    return res.status(400).json({ error: 'Invalid product_type' });
  }

  const connection = await db.getConnection();
  try {
    const [result] = await connection.query(
      `INSERT INTO products (name, category_id, base_price, product_type, has_variants, is_active, image_url)
       VALUES (?, ?, ?, ?, 0, 1, ?)`,
      [name.trim(), Number(category_id), Number(base_price), product_type, image_url || null]
    );
    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('createProduct error:', err);
    return res.status(500).json({ error: 'Failed to create product.' });
  } finally {
    connection.release();
  }
};

exports.updateProduct = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  const { name, category_id, base_price, product_type, image_url } = req.body || {};

  const fields = [];
  const values = [];
  if (name !== undefined) {
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Invalid name' });
    fields.push('name = ?');
    values.push(name.trim());
  }
  if (category_id !== undefined) {
    if (!Number.isFinite(Number(category_id))) return res.status(400).json({ error: 'Invalid category_id' });
    fields.push('category_id = ?');
    values.push(Number(category_id));
  }
  if (base_price !== undefined) {
    if (!Number.isFinite(Number(base_price))) return res.status(400).json({ error: 'Invalid base_price' });
    fields.push('base_price = ?');
    values.push(Number(base_price));
  }
  if (product_type !== undefined) {
    if (!['made-to-order', 'finished-goods'].includes(product_type)) {
      return res.status(400).json({ error: 'Invalid product_type' });
    }
    fields.push('product_type = ?');
    values.push(product_type);
  }
  if (image_url !== undefined) {
    fields.push('image_url = ?');
    values.push(image_url || null);
  }
  if (!fields.length) return res.status(400).json({ error: 'No updates provided' });

  const connection = await db.getConnection();
  try {
    values.push(id);
    const [result] = await connection.query(
      `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('updateProduct error:', err);
    return res.status(500).json({ error: 'Failed to update product.' });
  } finally {
    connection.release();
  }
};

exports.deleteProduct = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

  const connection = await db.getConnection();
  try {
    const [result] = await connection.query('DELETE FROM products WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true });
  } catch (err) {
    if (err && (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED')) {
      return res.status(409).json({
        error: 'Cannot delete this product because it is referenced by inventory/orders. Deactivate it instead.'
      });
    }
    // eslint-disable-next-line no-console
    console.error('deleteProduct error:', err);
    return res.status(500).json({ error: 'Failed to delete product.' });
  } finally {
    connection.release();
  }
};

exports.getRecipe = async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isFinite(productId) || productId <= 0) return res.status(400).json({ error: 'Invalid product id' });

  const connection = await db.getConnection();
  try {
    const [recipeRows] = await connection.query(
      `SELECT id, name, instructions, prep_time_minutes
       FROM recipes
       WHERE product_id = ? AND variant_id IS NULL
       ORDER BY id ASC
       LIMIT 1`,
      [productId]
    );
    if (!recipeRows.length) return res.json({ recipe: null, items: [] });

    const recipe = recipeRows[0];
    const [items] = await connection.query(
      `SELECT ri.id, ri.ingredient_id, i.name AS ingredient_name, i.unit, ri.quantity
       FROM recipe_items ri
       JOIN ingredients i ON i.id = ri.ingredient_id
       WHERE ri.recipe_id = ?
       ORDER BY i.name ASC`,
      [recipe.id]
    );
    return res.json({ recipe, items });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getRecipe error:', err);
    return res.status(500).json({ error: 'Failed to load recipe.' });
  } finally {
    connection.release();
  }
};

exports.saveRecipe = async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isFinite(productId) || productId <= 0) return res.status(400).json({ error: 'Invalid product id' });
  const { items, name } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Recipe items are required' });
  }
  for (const it of items) {
    if (!Number.isFinite(Number(it.ingredient_id))) {
      return res.status(400).json({ error: 'Invalid ingredient_id' });
    }
    if (!Number.isFinite(Number(it.quantity)) || Number(it.quantity) <= 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [productRows] = await connection.query(
      'SELECT id, name, product_type FROM products WHERE id = ? LIMIT 1',
      [productId]
    );
    if (!productRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Product not found' });
    }
    if (productRows[0].product_type !== 'made-to-order') {
      await connection.rollback();
      return res.status(400).json({ error: 'Only made-to-order products can have recipes' });
    }

    const [recipeRows] = await connection.query(
      `SELECT id FROM recipes
       WHERE product_id = ? AND variant_id IS NULL
       ORDER BY id ASC
       LIMIT 1`,
      [productId]
    );

    let recipeId;
    if (recipeRows.length) {
      recipeId = recipeRows[0].id;
      await connection.query(
        'UPDATE recipes SET name = ?, updated_at = NOW() WHERE id = ?',
        [name || `${productRows[0].name} Recipe`, recipeId]
      );
    } else {
      const [insert] = await connection.query(
        'INSERT INTO recipes (product_id, variant_id, name) VALUES (?, NULL, ?)',
        [productId, name || `${productRows[0].name} Recipe`]
      );
      recipeId = insert.insertId;
    }

    await connection.query('DELETE FROM recipe_items WHERE recipe_id = ?', [recipeId]);
    for (const it of items) {
      await connection.query(
        `INSERT INTO recipe_items (recipe_id, ingredient_id, quantity)
         VALUES (?, ?, ?)`,
        [recipeId, Number(it.ingredient_id), Number(it.quantity)]
      );
    }

    await connection.commit();
    return res.json({ ok: true, recipe_id: recipeId });
  } catch (err) {
    await connection.rollback();
    // eslint-disable-next-line no-console
    console.error('saveRecipe error:', err);
    return res.status(500).json({ error: 'Failed to save recipe.' });
  } finally {
    connection.release();
  }
};

