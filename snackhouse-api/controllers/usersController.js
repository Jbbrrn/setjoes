const bcrypt = require('bcrypt');
const db = require('../config/database');

const normalizeUsername = (username) => {
  if (typeof username !== 'string') return null;
  const value = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(value)) return null;
  return value;
};

const normalizePassword = (password) => {
  if (password === undefined || password === null) return null;
  const value = String(password).trim();
  if (value.length < 6 || value.length > 128) return null;
  return value;
};

exports.listUsers = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT id, full_name, username, role, is_active, created_at, last_login
       FROM employees
       ORDER BY is_active DESC, full_name ASC`
    );
    return res.json({ items: rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('listUsers error:', err);
    return res.status(500).json({ error: 'Failed to load users.' });
  } finally {
    connection.release();
  }
};

exports.createUser = async (req, res) => {
  const { full_name, username, password, role } = req.body || {};
  const normalizedUsername = normalizeUsername(username);
  const normalizedPassword = normalizePassword(password);
  if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
    return res.status(400).json({ error: 'Invalid full_name' });
  }
  if (!normalizedUsername) return res.status(400).json({ error: 'Username must be 3-40 chars and use letters/numbers/._-' });
  if (!normalizedPassword) return res.status(400).json({ error: 'Password must be 6-128 chars.' });
  if (!['cashier', 'manager'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const connection = await db.getConnection();
  try {
    const passwordHash = await bcrypt.hash(normalizedPassword, 10);
    const [result] = await connection.query(
      `INSERT INTO employees (full_name, username, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [full_name.trim(), normalizedUsername, passwordHash, role]
    );
    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username already exists. Use a different username.' });
    }
    // eslint-disable-next-line no-console
    console.error('createUser error:', err);
    return res.status(500).json({ error: 'Failed to create user.' });
  } finally {
    connection.release();
  }
};

exports.updateUser = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid user id' });

  const { full_name, username, role, is_active, password } = req.body || {};
  if (full_name !== undefined && (typeof full_name !== 'string' || full_name.trim().length < 2)) {
    return res.status(400).json({ error: 'Invalid full_name' });
  }
  if (role !== undefined && !['cashier', 'manager'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (username !== undefined && !normalizeUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3-40 chars and use letters/numbers/._-' });
  }
  if (is_active !== undefined && typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'Invalid is_active' });
  }
  let passwordHash = null;
  if (password !== undefined && password !== null && String(password).trim() !== '') {
    const normalizedPassword = normalizePassword(password);
    if (!normalizedPassword) return res.status(400).json({ error: 'Password must be 6-128 chars.' });
    passwordHash = await bcrypt.hash(normalizedPassword, 10);
  }

  const fields = [];
  const values = [];
  if (full_name !== undefined) {
    fields.push('full_name = ?');
    values.push(full_name.trim());
  }
  if (role !== undefined) {
    fields.push('role = ?');
    values.push(role);
  }
  if (username !== undefined) {
    fields.push('username = ?');
    values.push(normalizeUsername(username));
  }
  if (is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(is_active ? 1 : 0);
  }
  if (passwordHash) {
    fields.push('password_hash = ?');
    values.push(passwordHash);
  }
  if (fields.length === 0) return res.status(400).json({ error: 'No changes provided' });

  const connection = await db.getConnection();
  try {
    values.push(id);
    const [result] = await connection.query(`UPDATE employees SET ${fields.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
    return res.json({ ok: true });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username already exists. Use a different username.' });
    }
    // eslint-disable-next-line no-console
    console.error('updateUser error:', err);
    return res.status(500).json({ error: 'Failed to update user.' });
  } finally {
    connection.release();
  }
};

exports.deleteUser = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid user id' });

  if (req.employee && req.employee.id === id) {
    return res.status(400).json({ error: 'You cannot delete your own account while logged in.' });
  }

  const connection = await db.getConnection();
  try {
    const [result] = await connection.query(
      'DELETE FROM employees WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
    return res.json({ ok: true });
  } catch (err) {
    if (err && (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED')) {
      return res.status(409).json({
        error: 'Cannot delete this user because it is referenced by transactions/orders. Set the account inactive instead.'
      });
    }
    // eslint-disable-next-line no-console
    console.error('deleteUser error:', err);
    return res.status(500).json({ error: 'Failed to delete user.' });
  } finally {
    connection.release();
  }
};

