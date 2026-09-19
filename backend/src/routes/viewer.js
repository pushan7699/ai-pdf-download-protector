import { Router } from 'express';
import { ViewerController } from '../controllers/viewerController.js';
import { authenticate } from '../middleware/auth.js';
import { strictRateLimiter } from '../middleware/security.js';
import { JWTUtil } from '../utils/jwt.js';

const router = Router();
const viewer = new ViewerController();

// Auth middleware that also accepts ?token= query param (needed for <img src> requests)
const authenticateOrQuery = (req, res, next) => {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }
  // Fall back to ?token= query param
  const token = req.query.token;
  if (token) {
    try {
      req.user = JWTUtil.verifyToken(token);
      return next();
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  }
  return res.status(401).json({ success: false, message: 'No token provided' });
};

router.post('/viewer/session', authenticate, (req, res) => viewer.startSession(req, res));
router.get('/viewer/page/:pageNumber', authenticateOrQuery, (req, res) => viewer.getPage(req, res));
router.post('/viewer/session/end', authenticate, (req, res) => viewer.endSession(req, res));
router.get('/viewer/session/info', authenticate, (req, res) => viewer.getSessionInfo(req, res));
router.post('/viewer/report/download', authenticate, strictRateLimiter, (req, res) => viewer.reportDownloadAttempt(req, res));

export default router;
