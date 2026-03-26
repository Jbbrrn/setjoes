const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { createOrder, voidOrder } = require('../controllers/ordersController');

const router = express.Router();

router.post('/', authenticateToken, createOrder);
router.post('/:id/void', authenticateToken, voidOrder);

module.exports = router;

