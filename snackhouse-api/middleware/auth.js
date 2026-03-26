const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.employee = decoded;
    return next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireManager = (req, res, next) => {
  if (!req.employee || req.employee.role !== 'manager') {
    return res.status(403).json({ error: 'Manager access required' });
  }
  return next();
};

module.exports = { authenticateToken, requireManager };

