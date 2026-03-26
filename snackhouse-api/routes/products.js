const express = require('express');
const {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getRecipe,
  saveRecipe
} = require('../controllers/productsController');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, getProducts);

router.get('/:id/recipe', authenticateToken, requireManager, getRecipe);
router.put('/:id/recipe', authenticateToken, requireManager, saveRecipe);

router.post('/', authenticateToken, requireManager, createProduct);

router.put('/:id', authenticateToken, requireManager, updateProduct);

router.delete('/:id', authenticateToken, requireManager, deleteProduct);

// minimal activate/deactivate for manager UI
router.post('/:id/toggle-active', authenticateToken, requireManager, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  const db = require('../config/database');
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query('SELECT is_active FROM products WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const next = rows[0].is_active ? 0 : 1;
    await connection.query('UPDATE products SET is_active = ? WHERE id = ?', [next, id]);
    return res.json({ id, is_active: !!next });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return res.status(500).json({ error: 'Failed' });
  } finally {
    connection.release();
  }
});

module.exports = router;

