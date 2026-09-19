import { JWTUtil } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    try {
      const decoded = JWTUtil.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      logger.warn('Invalid token', { ip: req.ip });
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      logger.warn('Unauthorized access', { userId: req.user.userId, role: req.user.role, path: req.path });
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
};

export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        req.user = JWTUtil.verifyToken(token);
      } catch (_) {
        // invalid token is fine for optional auth
      }
    }
    next();
  } catch (_) {
    next();
  }
};
