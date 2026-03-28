const express = require('express');
const { authenticateToken, requireManager } = require('../middleware/auth');
const { createOrder, voidOrder, listOrders } = require('../controllers/ordersController');

const router = express.Router();

router.get('/history', authenticateToken, listOrders);
router.post('/', authenticateToken, createOrder);
router.post('/:id/void', authenticateToken, requireManager, voidOrder);

module.exports = router;

