import { UserModel } from '../models/User.js';
import { AccessLogModel } from '../models/AccessLog.js';
import { JWTUtil } from '../utils/jwt.js';
import { logger, securityLogger } from '../utils/logger.js';
import { EventType } from '../types/index.js';

export class AuthController {
  async register(req, res) {
    try {
      const { email, password, full_name } = req.body;

      if (!email || !password || !full_name) {
        return res.status(400).json({ success: false, message: 'Email, password, and full name are required' });
      }

      const existing = await UserModel.findByEmail(email);
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }

      const user = await UserModel.create(email, password, full_name, 'user');

      await AccessLogModel.create(EventType.LOGIN, user.id, null, null, { action: 'register' }, req.ip, req.headers['user-agent']);

      logger.info('New user registered', { userId: user.id, email: user.email });

      res.status(201).json({ success: true, message: 'Account created successfully', data: { user } });
    } catch (error) {
      logger.error('Register error:', error);
      res.status(500).json({ success: false, message: 'Registration failed' });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
      }

      const isLocked = await UserModel.isLocked(email);
      if (isLocked) {
        return res.status(429).json({ success: false, message: 'Account temporarily locked. Try again in 15 minutes.' });
      }

      const user = await UserModel.findByEmail(email);
      if (!user) {
        await UserModel.incrementFailedAttempts(email).catch(() => {});
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const validPassword = await UserModel.verifyPassword(user, password);
      if (!validPassword) {
        await UserModel.incrementFailedAttempts(email);
        securityLogger.warn('Failed login', { email, ip: req.ip });
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      if (user.is_blocked) {
        return res.status(403).json({ success: false, message: 'Account is blocked. Contact support.' });
      }

      await UserModel.updateLastLogin(user.id);
      await UserModel.resetFailedAttempts(email);

      const tokenPayload = { userId: user.id, email: user.email, role: user.role };
      const accessToken = JWTUtil.generateAccessToken(tokenPayload);
      const refreshToken = JWTUtil.generateRefreshToken(tokenPayload);

      await AccessLogModel.create(EventType.LOGIN, user.id, null, null, null, req.ip, req.headers['user-agent']);

      logger.info('User logged in', { userId: user.id });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  }

  async logout(req, res) {
    try {
      if (req.user) {
        await AccessLogModel.create(EventType.LOGOUT, req.user.userId, null, null, null, req.ip, req.headers['user-agent']);
      }
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({ success: false, message: 'Logout failed' });
    }
  }

  async refreshToken(req, res) {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) return res.status(400).json({ success: false, message: 'Refresh token required' });

      const decoded = JWTUtil.verifyToken(refresh_token);
      const user = await UserModel.findById(decoded.userId);
      if (!user || user.is_blocked) return res.status(401).json({ success: false, message: 'Invalid token' });

      const tokenPayload = { userId: user.id, email: user.email, role: user.role };
      const accessToken = JWTUtil.generateAccessToken(tokenPayload);

      res.json({ success: true, data: { access_token: accessToken } });
    } catch (error) {
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  }

  async getMe(req, res) {
    try {
      const user = await UserModel.findByIdSafe(req.user.userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, data: { user } });
    } catch (error) {
      logger.error('GetMe error:', error);
      res.status(500).json({ success: false, message: 'Failed to get user info' });
    }
  }
}
