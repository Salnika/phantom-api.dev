import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceController } from '../../controllers/resource';
import { resetDatabaseConnection } from '../../database';

describe('Automatic Field Creation', () => {
  let controller: ResourceController;

  beforeEach(async () => {
    resetDatabaseConnection();
    controller = new ResourceController();
  });

  it('should automatically add new fields when creating resources', async () => {
    const mockReq: any = {
      params: { resource: 'Product' },
      body: {
        name: 'Test Product',
        price: 29.99
      },
      user: { role: 'admin' }
    };

    const responses: any[] = [];
    const mockRes: any = {
      status: (code: number) => ({
        json: (data: any) => {
          responses.push({ status: code, data });
          return mockRes;
        }
      }),
      json: (data: any) => {
        responses.push({ data });
        return mockRes;
      }
    };

    // First creation
    await controller.create(mockReq, mockRes);
    expect(responses[0].status).toBe(201);

    // Add new field
    mockReq.body = {
      name: 'Another Product',
      price: 39.99,
      category: 'Electronics', // New field
      isActive: true // Another new field
    };

    await controller.create(mockReq, mockRes);
    expect(responses[1].status).toBe(201);

    // Check schema includes new fields
    const schema = await controller.getResourceSchema('Product');
    expect(schema).toBeDefined();
    expect(schema.fields.category).toBeDefined();
    expect(schema.fields.category.type).toBe('string');
    expect(schema.fields.isActive).toBeDefined();
    expect(schema.fields.isActive.type).toBe('boolean');
  });

  it('should automatically add new fields when updating resources', async () => {
    const mockReq: any = {
      params: { resource: 'User', id: 'test-id' },
      body: {
        email: 'test@example.com',
        name: 'Test User'
      },
      user: { role: 'admin' }
    };

    const responses: any[] = [];
    const mockRes: any = {
      status: (code: number) => ({
        json: (data: any) => {
          responses.push({ status: code, data });
          return mockRes;
        }
      }),
      json: (data: any) => {
        responses.push({ data });
        return mockRes;
      }
    };

    // Create initial resource
    const createReq = { ...mockReq, params: { resource: 'User' } };
    await controller.create(createReq, mockRes);
    const createdUser = responses[0].data.data;
    expect(responses[0].status).toBe(201);
    expect(createdUser).toBeDefined();

    // Update with new fields
    mockReq.params.id = createdUser.id;
    mockReq.body = {
      email: 'updated@example.com',
      name: 'Updated User',
      age: 30, // New field
      preferences: { theme: 'dark' } // New field
    };

    await controller.update(mockReq, mockRes);
    expect(responses[1].status).toBe(200);

    // Check schema includes new fields
    const schema = await controller.getResourceSchema('User');
    expect(schema).toBeDefined();
    expect(schema.fields.age).toBeDefined();
    expect(schema.fields.age.type).toBe('integer');
    expect(schema.fields.preferences).toBeDefined();
    expect(schema.fields.preferences.type).toBe('json');
  });
});