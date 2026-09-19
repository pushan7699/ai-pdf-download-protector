import { HashUtil } from '../src/utils/hash';
import { JWTUtil } from '../src/utils/jwt';

describe('HashUtil', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123!';
      const hash = await HashUtil.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await HashUtil.hashPassword(password);
      const hash2 = await HashUtil.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await HashUtil.hashPassword(password);
      const isValid = await HashUtil.comparePassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await HashUtil.hashPassword(password);
      const isValid = await HashUtil.comparePassword(wrongPassword, hash);
      
      expect(isValid).toBe(false);
    });
  });
});

describe('JWTUtil', () => {
  const payload = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    role: 'user' as const,
  };

  describe('generateAccessToken', () => {
    it('should generate a valid token', () => {
      const token = JWTUtil.generateAccessToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const token = JWTUtil.generateAccessToken(payload);
      const decoded = JWTUtil.verifyToken(token);
      
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      
      expect(() => {
        JWTUtil.verifyToken(invalidToken);
      }).toThrow();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a refresh token', () => {
      const refreshToken = JWTUtil.generateRefreshToken(payload);
      
      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
    });
  });
});
