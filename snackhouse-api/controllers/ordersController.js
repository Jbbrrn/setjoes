const db = require('../config/database');
const {
  getUnitCostForSaleLine,
  getRecipeIdForSaleLine,
  roundMoney: roundCostMoney
} = require('../utils/productCost');

const toMoney = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
class BadRequestError extends Error {}
const PH_TZ = 'Asia/Manila';

const getPhDateParts = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return { year, month, day, ymd: `${year}-${month}-${day}` };
};

const validateOrderPayload = (body) => {
  const items = body && body.items;
  if (!Array.isArray(items) || items.length === 0) return 'Invalid items';

  for (const item of items) {
    if (!item || typeof item.product_id !== 'number') return 'Invalid product_id';
    if (typeof item.quantity !== 'number' || item.quantity <= 0) return 'Invalid quantity';
    if (item.variant_id !== undefined && item.variant_id !== null && typeof item.variant_id !== 'number') {
      return 'Invalid variant_id';
    }
  }

  const payment_method = body.payment_method;
  if (!['cash', 'gcash'].includes(payment_method)) return 'Invalid payment_method';

  const amount_paid = body.amount_paid;
  if (typeof amount_paid !== 'number' || amount_paid < 0) return 'Invalid amount_paid';

  return null;
};

exports.createOrder = async (req, res) => {
  const validationError = validateOrderPayload(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { items, payment_method, amount_paid, order_type } = req.body;
  const employee_id = req.employee.id;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Price resolution + subtotal
    const resolvedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const [productRows] = await connection.query(
        'SELECT id, name, base_price, cost_price, product_type, has_variants FROM products WHERE id = ? AND is_active = 1',
        [item.product_id]
      );
      if (!productRows.length) throw new Error(`Product ${item.product_id} not found`);

      const product = productRows[0];
      let unit_price = Number(product.base_price);

      let variant_name = null;
      if (item.variant_id) {
        const [variantRows] = await connection.query(
          'SELECT id, variant_name, price FROM product_variants WHERE id = ? AND product_id = ? AND is_active = 1',
          [item.variant_id, item.product_id]
        );
        if (!variantRows.length) throw new Error(`Variant ${item.variant_id} not found for product ${item.product_id}`);
        unit_price = Number(variantRows[0].price);
        variant_name = variantRows[0].variant_name;
      }

      const lineSubtotal = toMoney(unit_price * item.quantity);
      subtotal = toMoney(subtotal + lineSubtotal);

      const variantIdForCost = item.variant_id != null ? Number(item.variant_id) : null;
      const unit_cost = await getUnitCostForSaleLine(connection, {
        product_id: product.id,
        product_type: product.product_type,
        variant_id: variantIdForCost,
        cost_price: product.cost_price
      });
      const cost_subtotal =
        unit_cost != null ? roundCostMoney(unit_cost * item.quantity) : null;

      resolvedItems.push({
        product_id: item.product_id,
        product_name: product.name,
        product_type: product.product_type,
        variant_id: item.variant_id || null,
        variant_name,
        quantity: item.quantity,
        unit_price: toMoney(unit_price),
        subtotal: lineSubtotal,
        unit_cost,
        cost_subtotal
      });
    }

    // VAT disabled entirely
    const vat_amount = 0;
    const total_amount = subtotal;

    if (Number(amount_paid) < total_amount) {
      return res.status(400).json({ error: 'Amount paid is less than total.' });
    }

    // Order number: ORD-YYYYMMDD-### (per day)
    const phToday = getPhDateParts();
    const [seqRows] = await connection.query(`SELECT COUNT(*) AS cnt FROM orders WHERE DATE(created_at) = ?`, [
      phToday.ymd
    ]);
    const seq = Number(seqRows[0].cnt) + 1;
    const order_number = `ORD-${phToday.year}${phToday.month}${phToday.day}-${String(seq).padStart(3, '0')}`;

    const [orderResult] = await connection.query(
      `INSERT INTO orders (order_number, employee_id, order_type, subtotal, vat_amount, total_amount, status, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, 'completed', NOW())`,
      [order_number, employee_id, order_type || 'takeout', subtotal, vat_amount, total_amount]
    );
    const order_id = orderResult.insertId;

    // Insert order items + inventory deductions
    for (const it of resolvedItems) {
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price, subtotal, unit_cost, cost_subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order_id,
          it.product_id,
          it.variant_id,
          it.quantity,
          it.unit_price,
          it.subtotal,
          it.unit_cost,
          it.cost_subtotal
        ]
      );

      if (it.product_type === 'finished-goods') {
        await connection.query(
          `INSERT INTO inventory (product_id, quantity, reorder_level)
           VALUES (?, 0, 10)
           ON DUPLICATE KEY UPDATE product_id = product_id`,
          [it.product_id]
        );

        const [invRows] = await connection.query(
          'SELECT quantity FROM inventory WHERE product_id = ? FOR UPDATE',
          [it.product_id]
        );
        if (!invRows.length) throw new BadRequestError(`No inventory record for product ${it.product_id}`);
        const before = Number(invRows[0].quantity);
        if (before < it.quantity) throw new BadRequestError(`Insufficient stock for product ${it.product_id}`);
        const after = before - it.quantity;

        await connection.query('UPDATE inventory SET quantity = ? WHERE product_id = ?', [after, it.product_id]);
        await connection.query(
          `INSERT INTO inventory_transactions
           (product_id, transaction_type, quantity_change, quantity_before, quantity_after, reason, reference_id, performed_by)
           VALUES (?, 'sale', ?, ?, ?, NULL, ?, ?)`,
          [it.product_id, -it.quantity, before, after, order_id, employee_id]
        );
      } else {
        const recipe_id = await getRecipeIdForSaleLine(
          connection,
          it.product_id,
          it.variant_id != null ? Number(it.variant_id) : null
        );
        if (!recipe_id) {
          throw new BadRequestError(
            `Cannot sell ${it.product_name}: made-to-order product has no recipe configured.`
          );
        }
        const [recipeItems] = await connection.query(
          'SELECT ingredient_id, quantity FROM recipe_items WHERE recipe_id = ?',
          [recipe_id]
        );
        if (!recipeItems.length) {
          throw new BadRequestError(
            `Cannot sell ${it.product_name}: recipe has no ingredients configured.`
          );
        }

        for (const ri of recipeItems) {
          const qtyToDeduct = Number(ri.quantity) * it.quantity;
          const [stockRows] = await connection.query(
            'SELECT quantity FROM ingredient_inventory WHERE ingredient_id = ? FOR UPDATE',
            [ri.ingredient_id]
          );
          if (!stockRows.length) throw new BadRequestError(`No ingredient inventory for ingredient ${ri.ingredient_id}`);
          const before = Number(stockRows[0].quantity);
          if (before < qtyToDeduct) throw new BadRequestError(`Insufficient ingredient stock for ingredient ${ri.ingredient_id}`);
          const after = toMoney(before - qtyToDeduct);

          await connection.query(
            'UPDATE ingredient_inventory SET quantity = ? WHERE ingredient_id = ?',
            [after, ri.ingredient_id]
          );
          await connection.query(
            `INSERT INTO inventory_transactions
             (ingredient_id, transaction_type, quantity_change, quantity_before, quantity_after, reason, reference_id, performed_by)
             VALUES (?, 'sale', ?, ?, ?, NULL, ?, ?)`,
            [ri.ingredient_id, -qtyToDeduct, before, after, order_id, employee_id]
          );
        }
      }
    }

    const change_given = toMoney(Number(amount_paid) - total_amount);
    await connection.query(
      `INSERT INTO payments (order_id, payment_method, amount_paid, change_given, processed_by)
       VALUES (?, ?, ?, ?, ?)`,
      [order_id, payment_method, amount_paid, change_given, employee_id]
    );

    const [empRows] = await connection.query('SELECT full_name FROM employees WHERE id = ?', [employee_id]);
    const cashier_name = empRows.length ? empRows[0].full_name : null;

    await connection.commit();

    return res.status(201).json({
      order_id,
      order_number,
      cashier_name,
      created_at: new Date().toISOString(),
      items: resolvedItems,
      subtotal,
      vat_amount,
      total_amount,
      payment: { payment_method, amount_paid, change_given }
    });
  } catch (err) {
    await connection.rollback();
    if (err instanceof BadRequestError) {
      return res.status(400).json({ error: err.message });
    }
    // eslint-disable-next-line no-console
    console.error('createOrder error:', err);
    return res.status(500).json({ error: 'An error occurred. Please try again.' });
  } finally {
    connection.release();
  }
};

exports.voidOrder = async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isFinite(orderId) || orderId <= 0) return res.status(400).json({ error: 'Invalid order id' });

  const employee_id = req.employee.id;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      `SELECT id, status FROM orders WHERE id = ? FOR UPDATE`,
      [orderId]
    );
    if (!orderRows.length) return res.status(404).json({ error: 'Order not found' });
    if (orderRows[0].status === 'voided') return res.status(400).json({ error: 'Order already voided' });
    if (orderRows[0].status !== 'completed') return res.status(400).json({ error: 'Only completed orders can be voided' });

    // Reverse all sale transactions for this order reference.
    const [txnRows] = await connection.query(
      `SELECT id, ingredient_id, product_id, quantity_change
       FROM inventory_transactions
       WHERE reference_id = ? AND transaction_type = 'sale'
       ORDER BY id ASC`,
      [orderId]
    );

    for (const t of txnRows) {
      const delta = Number(t.quantity_change);
      if (t.product_id) {
        const [invRows] = await connection.query(
          'SELECT quantity FROM inventory WHERE product_id = ? FOR UPDATE',
          [t.product_id]
        );
        if (!invRows.length) continue;
        const before = Number(invRows[0].quantity);
        const after = before - delta; // delta is negative for sale; subtracting adds back
        await connection.query('UPDATE inventory SET quantity = ? WHERE product_id = ?', [after, t.product_id]);
        await connection.query(
          `INSERT INTO inventory_transactions
           (product_id, transaction_type, quantity_change, quantity_before, quantity_after, reason, reference_id, performed_by)
           VALUES (?, 'adjustment', ?, ?, ?, 'void order', ?, ?)`,
          [t.product_id, -delta, before, after, orderId, employee_id]
        );
      } else if (t.ingredient_id) {
        const [stockRows] = await connection.query(
          'SELECT quantity FROM ingredient_inventory WHERE ingredient_id = ? FOR UPDATE',
          [t.ingredient_id]
        );
        if (!stockRows.length) continue;
        const before = Number(stockRows[0].quantity);
        const after = before - delta; // delta negative -> add back
        await connection.query(
          'UPDATE ingredient_inventory SET quantity = ? WHERE ingredient_id = ?',
          [after, t.ingredient_id]
        );
        await connection.query(
          `INSERT INTO inventory_transactions
           (ingredient_id, transaction_type, quantity_change, quantity_before, quantity_after, reason, reference_id, performed_by)
           VALUES (?, 'adjustment', ?, ?, ?, 'void order', ?, ?)`,
          [t.ingredient_id, -delta, before, after, orderId, employee_id]
        );
      }
    }

    await connection.query(`UPDATE orders SET status = 'voided' WHERE id = ?`, [orderId]);

    await connection.commit();
    return res.json({ ok: true, order_id: orderId, reversed_transactions: txnRows.length });
  } catch (err) {
    await connection.rollback();
    // eslint-disable-next-line no-console
    console.error('voidOrder error:', err);
    return res.status(500).json({ error: 'An error occurred. Please try again.' });
  } finally {
    connection.release();
  }
};

