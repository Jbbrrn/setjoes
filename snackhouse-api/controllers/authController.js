const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const normalizeUsername = (username) => {
  if (typeof username !== 'string') return null;
  const u = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(u)) return null;
  return u;
};

const normalizePassword = (password) => {
  if (typeof password !== 'string') return null;
  const p = password.trim();
  if (p.length < 6 || p.length > 128) return null;
  return p;
};

exports.login = async (req, res) => {
  const username = normalizeUsername(req.body && req.body.username);
  const password = normalizePassword(req.body && req.body.password);
  if (!username) return res.status(400).json({ error: 'Valid username is required' });
  if (!password) return res.status(400).json({ error: 'Password must be 6-128 chars' });

  try {
    const connection = await db.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT id, full_name, username, password_hash, role, is_active
         FROM employees
         WHERE username = ? AND is_active = 1
         LIMIT 1`,
        [username]
      );
      const employee = rows[0] || null;

      if (!employee) return res.status(401).json({ error: 'Invalid username or password' });
      const ok = await bcrypt.compare(password, employee.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid username or password' });

      // Issue token with role for RBAC.
      const token = jwt.sign(
        { id: employee.id, role: employee.role, full_name: employee.full_name },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );

      await connection.release();
      return res.status(200).json({
        token,
        employee: { id: employee.id, full_name: employee.full_name, role: employee.role }
      });
    } catch (innerErr) {
      connection.release();
      throw innerErr;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Login error:', err);
    return res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
};

