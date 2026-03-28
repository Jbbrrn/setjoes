const express = require('express');
const { authenticateToken, requireManager } = require('../middleware/auth');
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoriesController');

const router = express.Router();

router.get('/', authenticateToken, listCategories);
router.post('/', authenticateToken, requireManager, createCategory);
router.put('/:id', authenticateToken, requireManager, updateCategory);
router.delete('/:id', authenticateToken, requireManager, deleteCategory);

module.exports = router;

