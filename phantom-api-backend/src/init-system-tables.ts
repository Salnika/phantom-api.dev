import { tableManager } from './database';
import { logger } from './logger';
import bcrypt from 'bcryptjs';

/**
 * Initializes system tables (e.g., system_User, system_Role) in the database.
 * This function creates or updates these tables and ensures default system data (roles, admin user) are present.
 * @returns A Promise that resolves when the system tables are initialized.
 * @throws An error if the initialization process fails.
 */
async function initializeSystemTables() {
  try {
    logger.info('Initializing system tables...');

    // SystemUser table
    const systemUserSchema = {
      fields: {
        email: { type: 'string', required: true, unique: true, format: 'email' },
        password: { type: 'string', required: true },
        roleId: { type: 'relation', target: 'system_Role', required: true }
      }
    };

    // SystemRole table
    const systemRoleSchema = {
      fields: {
        name: { type: 'string', required: true, unique: true },
        permissions: { type: 'json', default: [] }
      }
    };

    // Create tables
    await tableManager.createTableFromSchema('system_User', systemUserSchema);
    logger.info('✓ system_User table created/updated');

    await tableManager.createTableFromSchema('system_Role', systemRoleSchema);
    logger.info('✓ system_Role table created/updated');

    // Create default roles and admin user
    await createDefaultSystemData();

    logger.info('System tables initialization completed successfully!');

  } catch (error) {
    logger.error('Error initializing system tables:', error);
    throw error;
  }
}

/**
 * Creates default system data, including an admin role and a default admin user,
 * if they do not already exist in the database.
 */
async function createDefaultSystemData() {
  try {
    // Check if admin role already exists
    const existingAdminRole = await tableManager.findAll('system_Role', 1, 0, [], undefined, undefined, { name: { eq: 'admin' } });
    let adminRole;

    if (existingAdminRole.length === 0) {
      adminRole = await tableManager.create('system_Role', { name: 'admin', permissions: JSON.stringify(['*']) });
      logger.info('✓ Created default admin role');
    } else {
      adminRole = existingAdminRole[0];
      logger.info('Default admin role already exists, skipping creation');
    }

    // Check if default admin user exists
    const existingAdminUser = await tableManager.findAll('system_User', 1, 0, [], undefined, undefined, { email: { eq: 'admin@example.com' } });

    if (existingAdminUser.length === 0) {
      const hashedPassword = await bcrypt.hash('adminpassword', 10); // Hash default password
      await tableManager.create('system_User', {
        email: 'admin@example.com',
        password: hashedPassword,
        roleId: adminRole.id
      });
      logger.info('✓ Created default admin user');
    } else {
      logger.info('Default admin user already exists, skipping creation');
    }

  } catch (error) {
    logger.error('Error creating default system data:', error);
    // Don't throw, just log the error
  }
}

export { initializeSystemTables };