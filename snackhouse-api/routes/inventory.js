const express = require('express');
const { authenticateToken, requireManager } = require('../middleware/auth');
const {
  getIngredients,
  getFinishedGoods,
  adjustStock,
  getLowStock,
  createIngredient,
  updateIngredient,
  deleteIngredient
} = require('../controllers/inventoryController');

const router = express.Router();

router.get('/ingredients', authenticateToken, requireManager, getIngredients);
router.get('/finished-goods', authenticateToken, requireManager, getFinishedGoods);
router.get('/low-stock', authenticateToken, requireManager, getLowStock);
router.post('/adjust', authenticateToken, requireManager, adjustStock);
router.post('/ingredients', authenticateToken, requireManager, createIngredient);
router.put('/ingredients/:id', authenticateToken, requireManager, updateIngredient);
router.delete('/ingredients/:id', authenticateToken, requireManager, deleteIngredient);

module.exports = router;

