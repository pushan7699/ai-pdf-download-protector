import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export class JWTUtil {
  static generateAccessToken(payload) {
    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  }

  static generateRefreshToken(payload) {
    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.refreshExpiresIn });
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  static decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  static generateSessionToken() {
    const payload = {
      sessionId: this.generateRandomString(32),
      timestamp: Date.now(),
    };
    return jwt.sign(payload, config.session.secret, { expiresIn: config.session.tokenExpiresIn });
  }

  static verifySessionToken(token) {
    try {
      return jwt.verify(token, config.session.secret);
    } catch (error) {
      throw new Error('Invalid or expired session token');
    }
  }

  static generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
