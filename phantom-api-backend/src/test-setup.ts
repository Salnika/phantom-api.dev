// Set environment to 'test' before anything else
process.env.NODE_ENV = 'test';

import { beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { clearMetaCache } from './services/metaService';
import { resetDatabaseConnection, tableManager } from './database';

/**
 * Vitest setup file for configuring the test environment.
 * This file sets up a separate test database for each test file and manages environment variables.
 */

const TEST_DATA_DIR = path.join(__dirname, '../data');

beforeAll(() => {
  // Create the main data directory if it doesn't exist
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
});

beforeEach(async (context) => {
  // Generate a unique database for each test file to ensure isolation
  const testFileName = context.task.file.name;
  const dbId = crypto.createHash('sha1').update(testFileName).digest('hex').slice(0, 8);
  const testDbPath = path.join(TEST_DATA_DIR, `test-${dbId}.db`);

  // Set environment variables for the test
  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = testDbPath;
  process.env.PORT = '3001';

  // Reset database connection and clean up old db file
  resetDatabaseConnection();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Clear metadata cache and files
  clearMetaCache();
  const metaDir = path.join(__dirname, '../meta');
  if (fs.existsSync(metaDir)) {
    fs.readdirSync(metaDir).forEach(file => {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(metaDir, file));
      }
    });
  }

  // Initialize table manager to create tables for the new database
  await tableManager.initialize();
});

afterAll(() => {
  // Clean up all test databases after the run
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.readdirSync(TEST_DATA_DIR).forEach(file => {
      if (file.startsWith('test-') && file.endsWith('.db')) {
        fs.unlinkSync(path.join(TEST_DATA_DIR, file));
      }
    });
  }
});