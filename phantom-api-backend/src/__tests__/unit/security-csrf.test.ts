import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { Express } from 'express';

describe('CSRF Protection Security Tests', () => {
  let app: Express;
  
  beforeEach(async () => {
    // Set test environment to enable CSRF protection
    process.env.NODE_ENV = 'production';
    app = await createApp();
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  describe('/csrf-token endpoint', () => {
    it('should provide a CSRF token', async () => {
      const response = await request(app)
        .get('/csrf-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.csrfToken).toBeDefined();
      expect(typeof response.body.csrfToken).toBe('string');
      expect(response.body.csrfToken.length).toBeGreaterThan(0);
    });

    it('should set CSRF cookie', async () => {
      const response = await request(app)
        .get('/csrf-token')
        .expect(200);

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => cookie.includes('_csrf'))).toBe(true);
    });
  });

  describe('Admin API CSRF Protection', () => {
    let csrfToken: string;
    let cookies: string[];

    beforeEach(async () => {
      // Get CSRF token first
      const tokenResponse = await request(app)
        .get('/csrf-token')
        .expect(200);
      
      csrfToken = tokenResponse.body.csrfToken;
      cookies = tokenResponse.headers['set-cookie'];
    });

    it('should reject admin API requests without CSRF token', async () => {
      const response = await request(app)
        .post('/admin/api/resources')
        .set('Cookie', cookies)
        .send({ resource: 'test' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('CSRF_TOKEN_INVALID');
    });

    it('should accept admin API requests with valid CSRF token in header', async () => {
      const response = await request(app)
        .get('/admin/api/resources')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrfToken);
      
      // Note: This might return 401 due to authentication, but should not be 403 CSRF error
      expect(response.status).not.toBe(403);
    });

    it('should accept admin API requests with valid CSRF token in body', async () => {
      const response = await request(app)
        .post('/admin/api/cache/clear')
        .set('Cookie', cookies)
        .send({ 
          _csrf: csrfToken,
          resource: 'test'
        });
      
      // Note: This might return 401/403 due to authentication/authorization, 
      // but should not be CSRF error specifically
      expect(response.status).not.toBe(403);
      if (response.status === 403) {
        expect(response.body.code).not.toBe('CSRF_TOKEN_INVALID');
      }
    });
  });

  describe('Public API Routes (No CSRF)', () => {
    it('should allow public API requests without CSRF token', async () => {
      const response = await request(app)
        .post('/api/User/create')
        .send({
          email: 'test@example.com',
          name: 'Test User'
        });
      
      // Should not return CSRF error (might return other errors)
      expect(response.status).not.toBe(403);
      if (response.status === 403) {
        expect(response.body.code).not.toBe('CSRF_TOKEN_INVALID');
      }
    });

    it('should allow auth requests without CSRF token', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password'
        });
      
      // Should not return CSRF error (might return other errors)
      expect(response.status).not.toBe(403);
      if (response.status === 403) {
        expect(response.body.code).not.toBe('CSRF_TOKEN_INVALID');
      }
    });
  });

  describe('CSRF Token Validation', () => {
    it('should reject requests with invalid CSRF token', async () => {
      // Get valid cookie first
      const tokenResponse = await request(app)
        .get('/csrf-token')
        .expect(200);
      
      const cookies = tokenResponse.headers['set-cookie'];

      const response = await request(app)
        .post('/admin/api/resources')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', 'invalid-token')
        .send({ resource: 'test' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('CSRF_TOKEN_INVALID');
    });

    it('should reject requests with mismatched CSRF token', async () => {
      // Get one token
      const tokenResponse1 = await request(app)
        .get('/csrf-token')
        .expect(200);

      // Get another token  
      const tokenResponse2 = await request(app)
        .get('/csrf-token')
        .expect(200);

      // Use token from session 2 with cookies from session 1
      const response = await request(app)
        .post('/admin/api/resources')
        .set('Cookie', tokenResponse1.headers['set-cookie'])
        .set('X-CSRF-Token', tokenResponse2.body.csrfToken)
        .send({ resource: 'test' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('CSRF_TOKEN_INVALID');
    });
  });
});