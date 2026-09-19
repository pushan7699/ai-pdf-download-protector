import { Router } from 'express';
import { UserController } from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
const users = new UserController();

router.get('/users', authenticate, authorize('admin'), (req, res) => users.getUsers(req, res));
router.get('/users/:id', authenticate, authorize('admin'), (req, res) => users.getUser(req, res));
router.post('/users/:id/block', authenticate, authorize('admin'), (req, res) => users.blockUser(req, res));
router.post('/users/:id/unblock', authenticate, authorize('admin'), (req, res) => users.unblockUser(req, res));
router.delete('/users/:id', authenticate, authorize('admin'), (req, res) => users.deleteUser(req, res));
router.get('/users/:id/activity', authenticate, authorize('admin'), (req, res) => users.getUserActivity(req, res));

export default router;
