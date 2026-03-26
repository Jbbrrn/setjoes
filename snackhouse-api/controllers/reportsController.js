const db = require('../config/database');

const parseDate = (s) => {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  // Return YYYY-MM-DD to keep MySQL date comparisons simple.
  return d.toISOString().slice(0, 10);
};

exports.getSummary = async (req, res) => {
  const date = parseDate(req.query.date);
  if (!date) return res.status(400).json({ error: 'Invalid date' });

  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT
         COALESCE(SUM(total_amount), 0) AS total_sales,
         COALESCE(COUNT(*), 0) AS total_orders,
         COALESCE(AVG(total_amount), 0) AS avg_order
       FROM orders
       WHERE DATE(created_at) = ? AND status = 'completed'`,
      [date]
    );

    return res.json(rows[0]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getSummary error:', err);
    return res.status(500).json({ error: 'Failed to load summary.' });
  } finally {
    connection.release();
  }
};

exports.getSalesChart = async (req, res) => {
  const startDate = parseDate(req.query.start_date);
  const endDate = parseDate(req.query.end_date);
  if (!startDate || !endDate) return res.status(400).json({ error: 'Invalid date range' });

  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT DATE(created_at) AS day,
              COALESCE(SUM(total_amount), 0) AS total_sales
       FROM orders
       WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
         AND status = 'completed'
       GROUP BY DATE(created_at)
       ORDER BY day ASC`,
      [startDate, endDate]
    );
    return res.json({ points: rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getSalesChart error:', err);
    return res.status(500).json({ error: 'Failed to load sales chart.' });
  } finally {
    connection.release();
  }
};

exports.getTopProducts = async (req, res) => {
  const date = parseDate(req.query.date);
  const limit = Number(req.query.limit || 10);
  if (!date) return res.status(400).json({ error: 'Invalid date' });

  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT
         p.name AS product_name,
         SUM(oi.quantity) AS quantity_sold,
         SUM(oi.subtotal) AS revenue
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE DATE(o.created_at) = ? AND o.status = 'completed'
       GROUP BY p.id, p.name
       ORDER BY revenue DESC
       LIMIT ?`,
      [date, limit]
    );
    return res.json({ items: rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getTopProducts error:', err);
    return res.status(500).json({ error: 'Failed to load top products.' });
  } finally {
    connection.release();
  }
};

exports.getPaymentBreakdown = async (req, res) => {
  const date = parseDate(req.query.date);
  if (!date) return res.status(400).json({ error: 'Invalid date' });

  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT payment_method, SUM(amount_paid) AS total_amount
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE DATE(o.created_at) = ? AND o.status = 'completed'
       GROUP BY payment_method`,
      [date]
    );

    // Return Cash + GCash normalized keys for UI.
    const breakdown = { cash: 0, gcash: 0 };
    for (const r of rows) breakdown[r.payment_method] = Number(r.total_amount);
    return res.json(breakdown);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getPaymentBreakdown error:', err);
    return res.status(500).json({ error: 'Failed to load payment breakdown.' });
  } finally {
    connection.release();
  }
};

exports.exportCSV = async (req, res) => {
  const startDate = parseDate(req.query.start_date);
  const endDate = parseDate(req.query.end_date);
  if (!startDate || !endDate) return res.status(400).json({ error: 'Invalid date range' });

  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT
         o.order_number,
         e.full_name AS cashier,
         p.payment_method,
         p.amount_paid,
         p.change_given,
         o.total_amount AS order_total,
         o.created_at
       FROM orders o
       JOIN employees e ON e.id = o.employee_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)
         AND o.status = 'completed'
       ORDER BY o.created_at ASC`,
      [startDate, endDate]
    );

    const header = ['order_number', 'cashier', 'payment_method', 'amount_paid', 'change_given', 'order_total', 'created_at'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.order_number,
          String(r.cashier).replace(/,/g, ' '),
          r.payment_method,
          r.amount_paid,
          r.change_given,
          r.order_total,
          r.created_at
        ].join(',')
      );
    }

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=snackhouse_export.csv');
    return res.send(csv);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('exportCSV error:', err);
    return res.status(500).json({ error: 'Failed to export CSV.' });
  } finally {
    connection.release();
  }
};

