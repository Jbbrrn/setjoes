const express = require('express');
const {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getRecipe,
  saveRecipe,
  listVariants,
  createVariant,
  updateVariant,
  deleteVariant
} = require('../controllers/productsController');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, getProducts);

router.get('/:id/recipe', authenticateToken, requireManager, getRecipe);
router.put('/:id/recipe', authenticateToken, requireManager, saveRecipe);

router.post('/', authenticateToken, requireManager, createProduct);

router.put('/:id', authenticateToken, requireManager, updateProduct);

router.delete('/:id', authenticateToken, requireManager, deleteProduct);

router.get('/:id/variants', authenticateToken, requireManager, listVariants);
router.post('/:id/variants', authenticateToken, requireManager, createVariant);
router.put('/:id/variants/:variantId', authenticateToken, requireManager, updateVariant);
router.delete('/:id/variants/:variantId', authenticateToken, requireManager, deleteVariant);

// minimal activate/deactivate for manager UI
router.post('/:id/toggle-active', authenticateToken, requireManager, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  const db = require('../config/database');
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query('SELECT is_active, product_type, name FROM products WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const current = rows[0];
    const next = current.is_active ? 0 : 1;

    // Made-to-order items can be activated only if they have recipe ingredients.
    if (next === 1 && current.product_type === 'made-to-order') {
      const [recipeRows] = await connection.query(
        `SELECT r.id
         FROM recipes r
         JOIN recipe_items ri ON ri.recipe_id = r.id
         WHERE r.product_id = ?
         LIMIT 1`,
        [id]
      );
      if (!recipeRows.length) {
        return res.status(400).json({
          error: `Cannot activate "${current.name}" yet. Add recipe ingredients first.`
        });
      }
    }

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

