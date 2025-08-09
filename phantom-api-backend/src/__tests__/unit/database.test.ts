import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicTableManager, sqliteRaw, resetDatabaseConnection, tableManager as globalTableManager } from '../../database';

describe('Database Operations', () => {
  let tableManager: DynamicTableManager = globalTableManager;
  const testTable = 'TestUser';

  beforeEach(async () => {
    // Reset and initialize the database for each test
    resetDatabaseConnection();
    tableManager.reset();
    await tableManager.initialize();
    
    // Create a test table with a specific schema
    await tableManager.createTableFromSchema(testTable, testSchema);
  });

  describe('CRUD Operations', () => {
    beforeEach(async () => {
      sqliteRaw.exec(`DELETE FROM ${testTable}`);
    });
    it('should create records successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        isActive: 1 // SQLite stores booleans as integers
      };

      const result = await tableManager.create(testTable, userData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(userData.name);
      expect(result.email).toBe(userData.email);
    });

    it('should read records by ID', async () => {
      const userData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        age: 25
      };

      const created = await tableManager.create(testTable, userData);
      const found = await tableManager.findById(testTable, created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.name).toBe(userData.name);
    });

        it('should read all records with pagination', async () => {
      // Create multiple records
      const users = [
        { id: 'pagination_user_1', name: 'User 1', email: 'user1@example.com' },
        { id: 'pagination_user_2', name: 'User 2', email: 'user2@example.com' },
        { id: 'pagination_user_3', name: 'User 3', email: 'user3@example.com' }
      ];

      for (const user of users) {
        await tableManager.create(testTable, user);
      }

      const results = await tableManager.findAll(testTable, 2, 0);

      expect(results).toHaveLength(2);
      expect(results[0].name).toBeDefined();
    });

    it('should update records', async () => {
      const userData = {
        name: 'Original Name',
        email: 'original@example.com'
      };

      const created = await tableManager.create(testTable, userData);
      const updated = await tableManager.update(testTable, created.id, {
        name: 'Updated Name'
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.email).toBe(userData.email); // Should remain unchanged
    });

    it('should delete records', async () => {
      const userData = {
        name: 'To Delete',
        email: 'delete@example.com'
      };

      const created = await tableManager.create(testTable, userData);
      const deleted = await tableManager.delete(testTable, created.id);

      expect(deleted).toBe(true);

      const found = await tableManager.findById(testTable, created.id);
      expect(found).toBeNull();
    });
  });

  describe('Parameter Sanitization', () => {
    it('should sanitize SQL injection attempts', async () => {
      const maliciousData = {
        name: "Robert'; DROP TABLE TestUser; --",
        email: 'hacker@example.com'
      };

      // Should not throw error and should sanitize input
      const result = await tableManager.create(testTable, maliciousData);
      expect(result).toBeDefined();

      // Table should still exist
      const allUsers = await tableManager.findAll(testTable);
      expect(Array.isArray(allUsers)).toBe(true);
    });

    it('should handle null and undefined values', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        age: null,
        isActive: undefined
      };

      const result = await tableManager.create(testTable, userData);
      expect(result).toBeDefined();
      expect(result.age).toBeNull();
    });

    it('should convert objects to JSON strings', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        metadata: { preferences: { theme: 'dark' } }
      };

      const result = await tableManager.create(testTable, userData);
      expect(result).toBeDefined();
      expect(result.metadata).toEqual({ preferences: { theme: 'dark' } });
    });
  });

  describe('Query Filtering', () => {
    beforeEach(async () => {
      sqliteRaw.exec(`DELETE FROM ${testTable}`); // Clear table before each test in this block
      // Create test data with unique IDs
      const users = [
        { id: 'alice_1', name: 'Alice', email: 'alice@example.com', age: 25, isActive: 1 },
        { id: 'bob_1', name: 'Bob', email: 'bob@example.com', age: 30, isActive: 0 },
        { id: 'charlie_1', name: 'Charlie', email: 'charlie@example.com', age: 35, isActive: 1 }
      ];

      for (const user of users) {
        await tableManager.create(testTable, user);
      }
    });

    it('should filter by exact match', async () => {
      const results = await tableManager.findAll(testTable, 10, 0, [], undefined, undefined, {
        name: { eq: 'Alice' }
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alice');
    });

    it('should filter by greater than', async () => {
      const results = await tableManager.findAll(testTable, 10, 0, [], undefined, undefined, {
        age: { gt: 25 }
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      results.forEach(user => {
        expect(user.age).toBeGreaterThan(25);
      });
    });

    it('should filter by multiple conditions', async () => {
      const results = await tableManager.findAll(testTable, 10, 0, [], undefined, undefined, {
        age: { gt: 25 },
        isActive: { eq: 1 }
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Charlie');
    });
  });
});
