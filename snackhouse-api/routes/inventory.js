const express = require('express');
const { authenticateToken, requireManager } = require('../middleware/auth');
const {
  getIngredients,
  getFinishedGoods,
  adjustStock,
  getLowStock
} = require('../controllers/inventoryController');

const router = express.Router();

router.get('/ingredients', authenticateToken, requireManager, getIngredients);
router.get('/finished-goods', authenticateToken, requireManager, getFinishedGoods);
router.get('/low-stock', authenticateToken, requireManager, getLowStock);
router.post('/adjust', authenticateToken, requireManager, adjustStock);

module.exports = router;

