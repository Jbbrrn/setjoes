const express = require('express');
const { authenticateToken, requireManager } = require('../middleware/auth');
const { listCategories, createCategory } = require('../controllers/categoriesController');

const router = express.Router();

router.get('/', authenticateToken, listCategories);
router.post('/', authenticateToken, requireManager, createCategory);

module.exports = router;

