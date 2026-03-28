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

exports.updateCategory = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  const { name, display_order } = req.body || {};

  const connection = await db.getConnection();
  try {
    const [existing] = await connection.query('SELECT id FROM categories WHERE id = ? LIMIT 1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Category not found.' });

    const fields = [];
    const values = [];
    if (name !== undefined) {
      if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Invalid name' });
      const normalized = name.trim();
      const [dupRows] = await connection.query(
        'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1',
        [normalized, id]
      );
      if (dupRows.length) return res.status(409).json({ error: 'Another category already uses that name.' });
      fields.push('name = ?');
      values.push(normalized);
    }
    if (display_order !== undefined) {
      if (!Number.isFinite(Number(display_order))) return res.status(400).json({ error: 'Invalid display_order' });
      fields.push('display_order = ?');
      values.push(Number(display_order));
    }
    if (!fields.length) return res.status(400).json({ error: 'No updates provided' });

    values.push(id);
    await connection.query(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ ok: true });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'That category name is already taken.' });
    }
    // eslint-disable-next-line no-console
    console.error('updateCategory error:', err);
    return res.status(500).json({ error: 'Failed to update category.' });
  } finally {
    connection.release();
  }
};

exports.deleteCategory = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

  const connection = await db.getConnection();
  try {
    const [existing] = await connection.query('SELECT id FROM categories WHERE id = ? LIMIT 1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Category not found.' });

    const [[{ n }]] = await connection.query(
      'SELECT COUNT(*) AS n FROM products WHERE category_id = ?',
      [id]
    );
    if (Number(n) > 0) {
      return res.status(409).json({
        error:
          'Cannot delete this category while products are still assigned to it. Reassign or delete those products first.'
      });
    }
    await connection.query('DELETE FROM categories WHERE id = ?', [id]);
    return res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('deleteCategory error:', err);
    return res.status(500).json({ error: 'Failed to delete category.' });
  } finally {
    connection.release();
  }
};
