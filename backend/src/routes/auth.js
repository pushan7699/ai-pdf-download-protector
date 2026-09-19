import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/security.js';

const router = Router();
const auth = new AuthController();

router.post('/register', authRateLimiter, (req, res) => auth.register(req, res));
router.post('/login', authRateLimiter, (req, res) => auth.login(req, res));
router.post('/logout', authenticate, (req, res) => auth.logout(req, res));
router.post('/refresh', (req, res) => auth.refreshToken(req, res));
router.get('/me', authenticate, (req, res) => auth.getMe(req, res));

export default router;
