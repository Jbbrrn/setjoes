const db = require('../config/database');
const {
  roundMoney,
  sumRecipeCost,
  getMadeToOrderCostDefaultRecipe,
  syncMadeToOrderCostPriceCache
} = require('../utils/productCost');

const ensureFinishedGoodsInventory = async (connection, productId) => {
  await connection.query(
    `INSERT INTO inventory (product_id, quantity, reorder_level)
     VALUES (?, 0, 10)
     ON DUPLICATE KEY UPDATE product_id = product_id`,
    [productId]
  );
};

// Returns products plus a computed `current_stock` for the POS stock indicator.
exports.getProducts = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const includeInactive = String(req.query.include_inactive || '') === '1';
    const canSeeInactive = req.employee && req.employee.role === 'manager' && includeInactive;
    const activeFilter = canSeeInactive ? '' : 'WHERE p.is_active = 1';
    const [rows] = await connection.query(
      `SELECT p.id, p.name, p.category_id, p.base_price, p.cost_price, p.product_type, p.has_variants, p.is_active, p.image_url,
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
          current_stock = 0;
        } else {
          const recipeId = recipeRows[0].id;
          const [riRows] = await connection.query(
            `SELECT ri.quantity AS per_serving, inv.quantity AS on_hand
             FROM recipe_items ri
             LEFT JOIN ingredient_inventory inv ON inv.ingredient_id = ri.ingredient_id
             WHERE ri.recipe_id = ?`,
            [recipeId]
          );
          if (!riRows.length) {
            current_stock = 0;
          } else {
          let possible = Infinity;
          for (const ri of riRows) {
            const per = Number(ri.per_serving);
            const onHand = Number(ri.on_hand || 0);
            if (per <= 0) continue;
            possible = Math.min(possible, Math.floor(onHand / per));
          }
          current_stock = possible === Infinity ? 0 : possible;
          }
        }
      }

      let cost_price = r.cost_price != null && r.cost_price !== '' ? roundMoney(r.cost_price) : null;
      if (r.product_type === 'made-to-order') {
        cost_price = await getMadeToOrderCostDefaultRecipe(connection, r.id);
      }

      products.push({
      id: r.id,
      name: r.name,
      category_id: r.category_id,
      category_name: r.category_name,
      base_price: Number(r.base_price),
      cost_price,
      product_type: r.product_type,
      has_variants: !!r.has_variants,
      is_active: !!r.is_active,
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
  const { name, category_id, base_price, product_type, image_url, cost_price } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Invalid name' });
  if (!Number.isFinite(Number(category_id))) return res.status(400).json({ error: 'Invalid category_id' });
  if (!Number.isFinite(Number(base_price))) return res.status(400).json({ error: 'Invalid base_price' });
  if (!['made-to-order', 'finished-goods'].includes(product_type)) {
    return res.status(400).json({ error: 'Invalid product_type' });
  }

  let costPriceVal = null;
  if (product_type === 'finished-goods' && cost_price !== undefined && cost_price !== null && cost_price !== '') {
    if (!Number.isFinite(Number(cost_price)) || Number(cost_price) < 0) {
      return res.status(400).json({ error: 'Invalid cost_price (must be >= 0)' });
    }
    costPriceVal = roundMoney(cost_price);
  }

  const connection = await db.getConnection();
  try {
    const normalizedName = name.trim();
    const [dupRows] = await connection.query(
      'SELECT id FROM products WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [normalizedName]
    );
    if (dupRows.length) {
      return res.status(409).json({ error: 'A product with that name already exists.' });
    }

    const [result] = await connection.query(
      `INSERT INTO products (name, category_id, base_price, cost_price, product_type, has_variants, is_active, image_url)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        normalizedName,
        Number(category_id),
        Number(base_price),
        costPriceVal,
        product_type,
        product_type === 'made-to-order' ? 0 : 1,
        image_url || null
      ]
    );
    if (product_type === 'finished-goods') {
      await ensureFinishedGoodsInventory(connection, result.insertId);
    }
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
  const { name, category_id, base_price, product_type, image_url, cost_price } = req.body || {};

  const clearCostWhenSwitchingToMadeToOrder =
    product_type !== undefined && product_type === 'made-to-order' && cost_price === undefined;

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
  if (cost_price !== undefined) {
    if (cost_price === null || cost_price === '') {
      fields.push('cost_price = ?');
      values.push(null);
    } else {
      if (!Number.isFinite(Number(cost_price)) || Number(cost_price) < 0) {
        return res.status(400).json({ error: 'Invalid cost_price' });
      }
      fields.push('cost_price = ?');
      values.push(roundMoney(cost_price));
    }
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
    if (cost_price !== undefined || product_type !== undefined || clearCostWhenSwitchingToMadeToOrder) {
      const [typeRows] = await connection.query('SELECT product_type FROM products WHERE id = ? LIMIT 1', [id]);
      if (!typeRows.length) {
        return res.status(404).json({ error: 'Not found' });
      }
      const existingType = typeRows[0].product_type;
      const effectiveType = product_type !== undefined ? product_type : existingType;
      if (cost_price !== undefined && effectiveType === 'made-to-order') {
        return res.status(400).json({ error: 'Cost price for made-to-order products is calculated from the recipe.' });
      }
      if (clearCostWhenSwitchingToMadeToOrder && existingType === 'finished-goods') {
        fields.push('cost_price = ?');
        values.push(null);
      }
    }

    if (name !== undefined) {
      const normalizedName = String(name).trim();
      const [dupRows] = await connection.query(
        'SELECT id FROM products WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1',
        [normalizedName, id]
      );
      if (dupRows.length) {
        return res.status(409).json({ error: 'A product with that name already exists.' });
      }
    }

    values.push(id);
    const [result] = await connection.query(
      `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
    if (product_type === 'finished-goods') {
      await ensureFinishedGoodsInventory(connection, id);
    }
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
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT id, is_active FROM products WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Not found' });
    }
    if (rows[0].is_active) {
      await connection.rollback();
      return res.status(400).json({ error: 'Deactivate the product first before permanent delete.' });
    }

    const [orderRefs] = await connection.query('SELECT COUNT(*) AS cnt FROM order_items WHERE product_id = ?', [id]);
    if (Number(orderRefs[0].cnt) > 0) {
      await connection.rollback();
      return res.status(409).json({
        error: 'Cannot permanently delete this product because it has existing sales history.'
      });
    }

    await connection.query('DELETE FROM inventory_transactions WHERE product_id = ?', [id]);
    await connection.query('DELETE FROM inventory WHERE product_id = ?', [id]);
    await connection.query('DELETE FROM recipe_items WHERE recipe_id IN (SELECT id FROM recipes WHERE product_id = ?)', [id]);
    await connection.query('DELETE FROM recipes WHERE product_id = ?', [id]);
    await connection.query('DELETE FROM product_variants WHERE product_id = ?', [id]);

    const [result] = await connection.query('DELETE FROM products WHERE id = ?', [id]);
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ error: 'Not found' });
    }
    await connection.commit();
    return res.json({ ok: true });
  } catch (err) {
    await connection.rollback();
    if (err && (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED')) {
      return res.status(409).json({
        error: 'Cannot permanently delete this product because it is referenced by existing records.'
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
  const variantIdRaw = req.query.variant_id;
  const hasVariantFilter = variantIdRaw !== undefined && variantIdRaw !== null && String(variantIdRaw) !== '';
  const variantId = hasVariantFilter ? Number(variantIdRaw) : null;
  if (hasVariantFilter && (!Number.isFinite(variantId) || variantId <= 0)) {
    return res.status(400).json({ error: 'Invalid variant_id' });
  }

  const connection = await db.getConnection();
  try {
    if (hasVariantFilter) {
      const [variantRows] = await connection.query(
        'SELECT id FROM product_variants WHERE id = ? AND product_id = ? LIMIT 1',
        [variantId, productId]
      );
      if (!variantRows.length) return res.status(404).json({ error: 'Variant not found for this product' });
    }

    const [recipeRows] = await connection.query(
      `SELECT id, name, instructions, prep_time_minutes
       FROM recipes
       WHERE product_id = ?
         AND (
           (? = 1 AND variant_id = ?)
           OR (? = 0 AND variant_id IS NULL)
         )
       ORDER BY id ASC
       LIMIT 1`,
      [productId, hasVariantFilter ? 1 : 0, variantId, hasVariantFilter ? 1 : 0]
    );
    if (!recipeRows.length) return res.json({ recipe: null, items: [], computed_cost: null });

    const recipe = recipeRows[0];
    const [items] = await connection.query(
      `SELECT ri.id, ri.ingredient_id, i.name AS ingredient_name, i.unit, i.cost_per_unit, ri.quantity
       FROM recipe_items ri
       JOIN ingredients i ON i.id = ri.ingredient_id
       WHERE ri.recipe_id = ?
       ORDER BY i.name ASC`,
      [recipe.id]
    );
    const computed_cost = await sumRecipeCost(connection, recipe.id);
    return res.json({ recipe, items, computed_cost });
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
  const variantIdRaw = req.query.variant_id;
  const hasVariantFilter = variantIdRaw !== undefined && variantIdRaw !== null && String(variantIdRaw) !== '';
  const variantId = hasVariantFilter ? Number(variantIdRaw) : null;
  if (hasVariantFilter && (!Number.isFinite(variantId) || variantId <= 0)) {
    return res.status(400).json({ error: 'Invalid variant_id' });
  }
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
    if (hasVariantFilter) {
      const [variantRows] = await connection.query(
        'SELECT id FROM product_variants WHERE id = ? AND product_id = ? LIMIT 1',
        [variantId, productId]
      );
      if (!variantRows.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Variant not found for this product' });
      }
    }

    const [recipeRows] = await connection.query(
      `SELECT id FROM recipes
       WHERE product_id = ?
         AND (
           (? = 1 AND variant_id = ?)
           OR (? = 0 AND variant_id IS NULL)
         )
       ORDER BY id ASC
       LIMIT 1`,
      [productId, hasVariantFilter ? 1 : 0, variantId, hasVariantFilter ? 1 : 0]
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
        'INSERT INTO recipes (product_id, variant_id, name) VALUES (?, ?, ?)',
        [productId, hasVariantFilter ? variantId : null, name || `${productRows[0].name} Recipe`]
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
    if (!hasVariantFilter) {
      await syncMadeToOrderCostPriceCache(connection, productId);
    }
    const computed_cost = await sumRecipeCost(connection, recipeId);
    return res.json({ ok: true, recipe_id: recipeId, computed_cost });
  } catch (err) {
    await connection.rollback();
    // eslint-disable-next-line no-console
    console.error('saveRecipe error:', err);
    return res.status(500).json({ error: 'Failed to save recipe.' });
  } finally {
    connection.release();
  }
};

exports.listVariants = async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isFinite(productId) || productId <= 0) return res.status(400).json({ error: 'Invalid product id' });
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT id, product_id, variant_name, price, is_active
       FROM product_variants
       WHERE product_id = ?
       ORDER BY id ASC`,
      [productId]
    );
    return res.json(rows.map((r) => ({ ...r, price: Number(r.price), is_active: !!r.is_active })));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('listVariants error:', err);
    return res.status(500).json({ error: 'Failed to load variants.' });
  } finally {
    connection.release();
  }
};

exports.createVariant = async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isFinite(productId) || productId <= 0) return res.status(400).json({ error: 'Invalid product id' });
  const { variant_name, price } = req.body || {};
  if (!variant_name || typeof variant_name !== 'string') return res.status(400).json({ error: 'Invalid variant_name' });
  if (!Number.isFinite(Number(price))) return res.status(400).json({ error: 'Invalid price' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [productRows] = await connection.query(
      'SELECT id, product_type FROM products WHERE id = ? LIMIT 1',
      [productId]
    );
    if (!productRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Product not found' });
    }
    if (productRows[0].product_type === 'finished-goods') {
      await connection.rollback();
      return res.status(400).json({
        error: 'Finished goods use base price only — create a separate product per SKU instead of variants.'
      });
    }

    const name = variant_name.trim();
    const [dupRows] = await connection.query(
      `SELECT id FROM product_variants
       WHERE product_id = ? AND LOWER(variant_name) = LOWER(?)
       LIMIT 1`,
      [productId, name]
    );
    if (dupRows.length) {
      await connection.rollback();
      return res.status(409).json({ error: 'A variant with that name already exists for this product.' });
    }

    const [insert] = await connection.query(
      `INSERT INTO product_variants (product_id, variant_name, price, is_active)
       VALUES (?, ?, ?, 1)`,
      [productId, name, Number(price)]
    );
    await connection.query('UPDATE products SET has_variants = 1 WHERE id = ?', [productId]);
    await connection.commit();
    return res.status(201).json({ id: insert.insertId });
  } catch (err) {
    await connection.rollback();
    // eslint-disable-next-line no-console
    console.error('createVariant error:', err);
    return res.status(500).json({ error: 'Failed to create variant.' });
  } finally {
    connection.release();
  }
};

exports.updateVariant = async (req, res) => {
  const productId = Number(req.params.id);
  const variantId = Number(req.params.variantId);
  if (!Number.isFinite(productId) || productId <= 0) return res.status(400).json({ error: 'Invalid product id' });
  if (!Number.isFinite(variantId) || variantId <= 0) return res.status(400).json({ error: 'Invalid variant id' });
  const { variant_name, price, is_active } = req.body || {};

  const fields = [];
  const values = [];
  if (variant_name !== undefined) {
    if (!variant_name || typeof variant_name !== 'string') return res.status(400).json({ error: 'Invalid variant_name' });
    fields.push('variant_name = ?');
    values.push(String(variant_name).trim());
  }
  if (price !== undefined) {
    if (!Number.isFinite(Number(price))) return res.status(400).json({ error: 'Invalid price' });
    fields.push('price = ?');
    values.push(Number(price));
  }
  if (is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(is_active ? 1 : 0);
  }
  if (!fields.length) return res.status(400).json({ error: 'No updates provided' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [ptypeRows] = await connection.query(
      'SELECT product_type FROM products WHERE id = ? LIMIT 1',
      [productId]
    );
    if (!ptypeRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Product not found' });
    }
    if (ptypeRows[0].product_type === 'finished-goods') {
      await connection.rollback();
      return res.status(400).json({
        error: 'Finished goods cannot use variants. Delete this variant to use base price only, or remove variants from Menu.'
      });
    }

    if (variant_name !== undefined) {
      const name = String(variant_name).trim();
      const [dupRows] = await connection.query(
        `SELECT id FROM product_variants
         WHERE product_id = ? AND LOWER(variant_name) = LOWER(?) AND id <> ?
         LIMIT 1`,
        [productId, name, variantId]
      );
      if (dupRows.length) {
        await connection.rollback();
        return res.status(409).json({ error: 'A variant with that name already exists for this product.' });
      }
    }

    values.push(productId, variantId);
    const [result] = await connection.query(
      `UPDATE product_variants SET ${fields.join(', ')} WHERE product_id = ? AND id = ?`,
      values
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ error: 'Variant not found' });
    }

    const [activeRows] = await connection.query(
      'SELECT COUNT(*) AS cnt FROM product_variants WHERE product_id = ? AND is_active = 1',
      [productId]
    );
    await connection.query('UPDATE products SET has_variants = ? WHERE id = ?', [Number(activeRows[0].cnt) > 0 ? 1 : 0, productId]);

    await connection.commit();
    return res.json({ ok: true });
  } catch (err) {
    await connection.rollback();
    // eslint-disable-next-line no-console
    console.error('updateVariant error:', err);
    return res.status(500).json({ error: 'Failed to update variant.' });
  } finally {
    connection.release();
  }
};

exports.deleteVariant = async (req, res) => {
  const productId = Number(req.params.id);
  const variantId = Number(req.params.variantId);
  if (!Number.isFinite(productId) || productId <= 0) return res.status(400).json({ error: 'Invalid product id' });
  if (!Number.isFinite(variantId) || variantId <= 0) return res.status(400).json({ error: 'Invalid variant id' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query('DELETE FROM product_variants WHERE product_id = ? AND id = ?', [productId, variantId]);
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ error: 'Variant not found' });
    }

    const [activeRows] = await connection.query(
      'SELECT COUNT(*) AS cnt FROM product_variants WHERE product_id = ? AND is_active = 1',
      [productId]
    );
    await connection.query('UPDATE products SET has_variants = ? WHERE id = ?', [Number(activeRows[0].cnt) > 0 ? 1 : 0, productId]);

    await connection.commit();
    return res.json({ ok: true });
  } catch (err) {
    await connection.rollback();
    // eslint-disable-next-line no-console
    console.error('deleteVariant error:', err);
    return res.status(500).json({ error: 'Failed to delete variant.' });
  } finally {
    connection.release();
  }
};

