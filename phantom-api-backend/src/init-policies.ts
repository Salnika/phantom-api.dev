import { tableManager } from './database';
import { logger } from './logger';

/**
 * Initializes policy tables in the database.
 * This function creates or updates the 'Policy', 'PolicyRule', 'UserPolicy', and 'RolePolicy' tables.
 * It also ensures that default policies are created if they don't already exist.
 * @returns A Promise that resolves when the policy tables are initialized.
 * @throws An error if the initialization process fails.
 */
async function initializePolicyTables() {
  try {
    logger.info('Initializing policy tables...');

    // Policy table
    const policySchema = {
      fields: {
        id: { type: 'string', primaryKey: true },
        name: { type: 'string', unique: true, required: true },
        description: { type: 'text' },
        type: { type: 'enum', values: ['ROLE_BASED', 'ATTRIBUTE_BASED', 'CUSTOM'], required: true },
        rules: { type: 'json', required: true },
        isActive: { type: 'boolean', default: true },
        priority: { type: 'integer', default: 100 },
        createdBy: { type: 'string', required: true },
        tags: { type: 'json', default: '[]' },
        createdAt: { type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        updatedAt: { type: 'datetime', default: 'CURRENT_TIMESTAMP' }
      }
    };

    // PolicyRule table
    const policyRuleSchema = {
      fields: {
        id: { type: 'string', primaryKey: true },
        policyId: { type: 'string', required: true, foreignKey: { table: 'Policy', column: 'id', onDelete: 'CASCADE' } },
        resource: { type: 'string', required: true },
        action: { type: 'enum', values: ['create', 'read', 'update', 'delete', 'list', 'export', 'import', '*'], required: true },
        effect: { type: 'enum', values: ['ALLOW', 'DENY'], default: 'ALLOW' },
        conditions: { type: 'json', default: '[]' },
        priority: { type: 'integer', default: 100 },
        description: { type: 'text' },
        isActive: { type: 'boolean', default: true },
        createdAt: { type: 'datetime', default: 'CURRENT_TIMESTAMP' }
      }
    };

    // UserPolicy table
    const userPolicySchema = {
      fields: {
        id: { type: 'string', primaryKey: true },
        userId: { type: 'string', required: true },
        policyId: { type: 'string', required: true, foreignKey: { table: 'Policy', column: 'id', onDelete: 'CASCADE' } },
        assignedBy: { type: 'string', required: true },
        assignedAt: { type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        expiresAt: { type: 'datetime' },
        isActive: { type: 'boolean', default: true },
        context: { type: 'json', default: '{}' }
      }
    };

    // RolePolicy table
    const rolePolicySchema = {
      fields: {
        id: { type: 'string', primaryKey: true },
        role: { type: 'enum', values: ['anon', 'user', 'admin', 'moderator', 'viewer', 'editor'], required: true },
        policyId: { type: 'string', required: true, foreignKey: { table: 'Policy', column: 'id', onDelete: 'CASCADE' } },
        assignedBy: { type: 'string', required: true },
        assignedAt: { type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        isActive: { type: 'boolean', default: true },
        priority: { type: 'integer', default: 100 }
      }
    };

    // Create tables
    await tableManager.createTableFromSchema('Policy', policySchema);
    logger.info('✓ Policy table created/updated');

    await tableManager.createTableFromSchema('PolicyRule', policyRuleSchema);
    logger.info('✓ PolicyRule table created/updated');

    await tableManager.createTableFromSchema('UserPolicy', userPolicySchema);
    logger.info('✓ UserPolicy table created/updated');

    await tableManager.createTableFromSchema('RolePolicy', rolePolicySchema);
    logger.info('✓ RolePolicy table created/updated');

    // Create some default policies
    await createDefaultPolicies();

    logger.info('Policy tables initialization completed successfully!');

  } catch (error) {
    logger.error('Error initializing policy tables:', error);
    throw error;
  }
}

/**
 * Creates default policies and assigns them to roles if they do not already exist.
 * This includes an 'Admin Full Access' policy for the 'admin' role
 * and a 'User Basic Access' policy for the 'user' role.
 */
async function createDefaultPolicies() {
  try {
    // Check if policies already exist
    const existingPolicies = await tableManager.findAll('Policy', 10, 0);
    if (existingPolicies.length > 0) {
      logger.info('Default policies already exist, skipping creation');
      return;
    }

    // Admin full access policy
    const adminPolicy = {
      id: 'policy_admin_full_access',
      name: 'Admin Full Access',
      description: 'Full access to all resources for administrators',
      type: 'ROLE_BASED',
      rules: JSON.stringify([
        {
          id: 'rule_admin_all',
          resource: '*',
          action: '*',
          effect: 'ALLOW',
          priority: 100,
          isActive: true,
          conditions: []
        }
      ]),
      isActive: true,
      priority: 100,
      createdBy: 'system',
      tags: JSON.stringify(['admin', 'system'])
    };

    await tableManager.create('Policy', adminPolicy);
    logger.info('✓ Created admin policy');

    // Assign admin policy to admin role
    const adminRolePolicy = {
      id: 'role_policy_admin',
      role: 'admin',
      policyId: 'policy_admin_full_access',
      assignedBy: 'system',
      isActive: true,
      priority: 100
    };

    await tableManager.create('RolePolicy', adminRolePolicy);
    logger.info('✓ Assigned admin policy to admin role');

    // User basic access policy
    const userPolicy = {
      id: 'policy_user_basic',
      name: 'User Basic Access',
      description: 'Basic access for regular users',
      type: 'ROLE_BASED',
      rules: JSON.stringify([
        {
          id: 'rule_user_read',
          resource: '*',
          action: 'read',
          effect: 'ALLOW',
          priority: 100,
          isActive: true,
          conditions: []
        }
      ]),
      isActive: true,
      priority: 50,
      createdBy: 'system',
      tags: JSON.stringify(['user', 'basic'])
    };

    await tableManager.create('Policy', userPolicy);
    logger.info('✓ Created user policy');

    // Assign user policy to user role
    const userRolePolicy = {
      id: 'role_policy_user',
      role: 'user',
      policyId: 'policy_user_basic',
      assignedBy: 'system',
      isActive: true,
      priority: 50
    };

    await tableManager.create('RolePolicy', userRolePolicy);
    logger.info('✓ Assigned user policy to user role');

  } catch (error) {
    logger.error('Error creating default policies:', error);
    // Don't throw, just log the error
  }
}

// Note: Initialization is handled in the main server startup process

export { initializePolicyTables };