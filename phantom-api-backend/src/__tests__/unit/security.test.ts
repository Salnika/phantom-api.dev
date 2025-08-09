import { describe, it, expect, beforeEach } from 'vitest';
import { generateToken, hashPassword, comparePassword } from '../../middleware/auth';

describe('Security Features', () => {
  beforeEach(() => {
    // Ensure JWT_SECRET is set for tests
  });
  describe('JWT Token Management', () => {
    it('should generate valid tokens', () => {
      const payload = { id: 'test', role: 'user' };
      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should generate different tokens for different payloads', () => {
      const token1 = generateToken({ id: 'user1', role: 'user' });
      const token2 = generateToken({ id: 'user2', role: 'admin' });

      expect(token1).not.toBe(token2);
    });
  });

  describe('Password Security', () => {
    it('should hash passwords securely', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should verify correct passwords', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      const isValid = await comparePassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect passwords', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await hashPassword(password);
      const isValid = await comparePassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });
  });
});