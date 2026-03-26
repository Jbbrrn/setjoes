const db = require('../config/database');

exports.listCategories = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT id, name, display_order FROM categories ORDER BY display_order ASC, name ASC'
    );
    return res.json(rows);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('listCategories error:', err);
    return res.status(500).json({ error: 'Failed to load categories.' });
  } finally {
    connection.release();
  }
};

exports.createCategory = async (req, res) => {
  const { name, display_order } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Invalid name' });

  const connection = await db.getConnection();
  try {
    const normalized = name.trim();
    const [dupRows] = await connection.query('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) LIMIT 1', [normalized]);
    if (dupRows.length) return res.status(409).json({ error: 'Category already exists.' });

    const [insert] = await connection.query(
      'INSERT INTO categories (name, display_order) VALUES (?, ?)',
      [normalized, Number.isFinite(Number(display_order)) ? Number(display_order) : 0]
    );
    return res.status(201).json({ id: insert.insertId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('createCategory error:', err);
    return res.status(500).json({ error: 'Failed to create category.' });
  } finally {
    connection.release();
  }
};

