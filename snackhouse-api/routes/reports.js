const express = require('express');
const { authenticateToken, requireManager } = require('../middleware/auth');
const {
  getSummary,
  getSalesChart,
  getTopProducts,
  getPaymentBreakdown,
  exportCSV
} = require('../controllers/reportsController');

const router = express.Router();

router.get('/summary', authenticateToken, requireManager, getSummary);
router.get('/sales-chart', authenticateToken, requireManager, getSalesChart);
router.get('/top-products', authenticateToken, requireManager, getTopProducts);
router.get('/payment-breakdown', authenticateToken, requireManager, getPaymentBreakdown);
router.get('/export-csv', authenticateToken, requireManager, exportCSV);

module.exports = router;

