const express = require('express');
const { authenticateToken, requireManager } = require('../middleware/auth');
const { listUsers, createUser, updateUser, deleteUser } = require('../controllers/usersController');

const router = express.Router();

router.use(authenticateToken, requireManager);

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;

