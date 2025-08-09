import { tableManager } from '../database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../logger';

export interface PolicyCondition {
  /** The field to evaluate (e.g., 'user.role', 'resource.id'). */
  field: string;
  /** The operator to use for evaluation (e.g., 'eq', 'gt', 'contains'). */
  operator: 'eq' | 'neq' | 'in' | 'notIn' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'exists' | 'startsWith' | 'endsWith';
  /** The value to compare against. */
  value: any;
  /** Optional: The context type where the field is located (e.g., 'user', 'resource'). */
  context?: 'user' | 'resource' | 'environment' | 'request';
}

/**
 * Defines a single rule within a policy.
 */
export interface PolicyRule {
  /** Optional: Unique identifier for the rule. */
  id?: string;
  /** The resource to which this rule applies (e.g., 'User', '*'). */
  resource: string;
  /** The action to which this rule applies (e.g., 'read', 'create', '*'). */
  action: string;
  /** The effect of the rule if matched ('ALLOW' or 'DENY'). */
  effect: 'ALLOW' | 'DENY';
  /** Optional: An array of conditions that must be met for the rule to apply. */
  conditions?: PolicyCondition[];
  /** The priority of the rule (higher number = higher priority). */
  priority: number;
  /** Optional: A description of the rule. */
  description?: string;
  /** Indicates if the rule is active. */
  isActive: boolean;
}

/**
 * Defines a policy, which is a collection of rules.
 */
export interface Policy {
  /** Optional: Unique identifier for the policy. */
  id?: string;
  /** The name of the policy. */
  name: string;
  /** Optional: A description of the policy. */
  description?: string;
  /** The type of the policy ('ROLE_BASED', 'ATTRIBUTE_BASED', or 'CUSTOM'). */
  type: 'ROLE_BASED' | 'ATTRIBUTE_BASED' | 'CUSTOM';
  /** An array of rules that define the policy's behavior. */
  rules: PolicyRule[];
  /** Indicates if the policy is active. */
  isActive: boolean;
  /** The priority of the policy (higher number = higher priority). */
  priority: number;
  /** The ID of the user or system that created the policy. */
  createdBy: string;
  /** Optional: An array of tags associated with the policy. */
  tags?: string[];
}

/**
 * Defines the context used for policy evaluation.
 */
export interface EvaluationContext {
  /** Information about the user performing the action. */
  user: {
    id: string;
    role: string;
    email?: string;
    [key: string]: any;
  };
  /** Information about the resource being accessed. */
  resource: {
    name: string;
    id?: string;
    data?: any;
    [key: string]: any;
  };
  /** The action being performed (e.g., 'read', 'create'). */
  action: string;
  /** Optional: Information about the environment (e.g., timestamp, IP address). */
  environment?: {
    timestamp: Date;
    ip?: string;
    userAgent?: string;
    [key: string]: any;
  };
  /** Optional: Information about the HTTP request. */
  request?: {
    method: string;
    path: string;
    query?: any;
    body?: any;
    headers?: any;
  };
}

/**
 * Service for managing and evaluating access control policies.
 */
export class PolicyService {
  /**
   * Creates a new policy in the database.
   * @param policyData The data for the new policy, excluding the ID.
   * @returns A Promise that resolves to the newly created Policy object.
   * @throws {AppError} If policy creation fails or rules are invalid.
   */
  async createPolicy(policyData: Omit<Policy, 'id'>): Promise<Policy> {
    try {
      // Validate policy rules
      this.validatePolicyRules(policyData.rules);

      const policy = await tableManager.create('Policy', {
        name: policyData.name,
        description: policyData.description || '',
        type: policyData.type,
        rules: JSON.stringify(policyData.rules),
        isActive: policyData.isActive,
        priority: policyData.priority,
        createdBy: policyData.createdBy,
        tags: JSON.stringify(policyData.tags || [])
      });

      return this.formatPolicy(policy);
    } catch (error) {
      logger.error({ error, policyData }, 'Failed to create policy');
      throw new AppError('Failed to create policy', 500);
    }
  }

  /**
   * Retrieves all policies from the database, optionally filtered by active status or type.
   * @param filters Optional filters for policies (isActive, type).
   * @returns A Promise that resolves to an array of Policy objects.
   * @throws {AppError} If retrieving policies fails.
   */
  async getPolicies(filters?: { isActive?: boolean; type?: string }): Promise<Policy[]> {
    try {
      const whereClause: any = {};
      if (filters?.isActive !== undefined) {
        whereClause.isActive = filters.isActive;
      }
      if (filters?.type) {
        whereClause.type = filters.type;
      }

      const policies = Object.keys(whereClause).length > 0
        ? await tableManager.findAll('Policy', 1000, 0, [], undefined, undefined, whereClause)
        : await tableManager.findAll('Policy', 1000, 0);
      return policies.map(policy => this.formatPolicy(policy));
    } catch (error) {
      console.error('Failed to get policies service', error);
      logger.error({ error, filters }, 'Failed to get policies service');
      throw new AppError('Failed to get policies', 500);
    }
  }

  /**
   * Retrieves a single policy by its ID.
   * @param id The ID of the policy to retrieve.
   * @returns A Promise that resolves to the Policy object, or null if not found.
   * @throws {AppError} If retrieving the policy fails.
   */
  async getPolicyById(id: string): Promise<Policy | null> {
    try {
      const policy = await tableManager.findById('Policy', id);
      return policy ? this.formatPolicy(policy) : null;
    } catch (error) {
      logger.error({ error, id }, 'Failed to get policy by ID');
      throw new AppError('Failed to get policy', 500);
    }
  }

  /**
   * Updates an existing policy in the database.
   * @param id The ID of the policy to update.
   * @param updates A partial Policy object containing the fields to update.
   * @returns A Promise that resolves to the updated Policy object.
   * @throws {AppError} If policy update fails or rules are invalid.
   */
  async updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy> {
    try {
      if (updates.rules) {
        this.validatePolicyRules(updates.rules);
      }

      const updateData: any = { ...updates };
      if (updateData.rules) {
        updateData.rules = JSON.stringify(updateData.rules);
      }
      if (updateData.tags) {
        updateData.tags = JSON.stringify(updateData.tags);
      }

      const policy = await tableManager.update('Policy', id, updateData);
      return this.formatPolicy(policy);
    } catch (error) {
      logger.error({ error, id, updates }, 'Failed to update policy');
      throw new AppError('Failed to update policy', 500);
    }
  }

  /**
   * Deletes a policy from the database by its ID.
   * @param id The ID of the policy to delete.
   * @returns A Promise that resolves when the policy has been deleted.
   * @throws {AppError} If policy deletion fails.
   */
  async deletePolicy(id: string): Promise<void> {
    try {
      await tableManager.delete('Policy', id);
    } catch (error) {
      logger.error({ error, id }, 'Failed to delete policy');
      throw new AppError('Failed to delete policy', 500);
    }
  }

  /**
   * Assigns a policy to a specific user.
   * @param userId The ID of the user to assign the policy to.
   * @param policyId The ID of the policy to assign.
   * @param assignedBy The ID of the entity that assigned the policy (e.g., admin user ID, 'system').
   * @param expiresAt Optional: The date and time when the policy assignment expires.
   * @returns A Promise that resolves when the policy has been assigned.
   * @throws {AppError} If policy assignment to user fails.
   */
  async assignPolicyToUser(userId: string, policyId: string, assignedBy: string, expiresAt?: Date): Promise<void> {
    try {
      await tableManager.create('UserPolicy', {
        userId,
        policyId,
        assignedBy,
        expiresAt: expiresAt?.toISOString(),
        isActive: true,
        context: '{}'
      });
    } catch (error) {
      logger.error({ error, userId, policyId }, 'Failed to assign policy to user');
      throw new AppError('Failed to assign policy to user', 500);
    }
  }

  /**
   * Assigns a policy to a specific role.
   * @param role The name of the role to assign the policy to.
   * @param policyId The ID of the policy to assign.
   * @param assignedBy The ID of the entity that assigned the policy.
   * @param priority The priority of the role assignment (default: 100).
   * @returns A Promise that resolves when the policy has been assigned.
   * @throws {AppError} If policy assignment to role fails.
   */
  async assignPolicyToRole(role: string, policyId: string, assignedBy: string, priority: number = 100): Promise<void> {
    try {
      await tableManager.create('RolePolicy', {
        role,
        policyId,
        assignedBy,
        isActive: true,
        priority
      });
    } catch (error) {
      logger.error({ error, role, policyId }, 'Failed to assign policy to role');
      throw new AppError('Failed to assign policy to role', 500);
    }
  }

  /**
   * Retrieves all policies (direct and role-based) applicable to a given user and role.
   * @param userId The ID of the user.
   * @param role The role of the user.
   * @returns A Promise that resolves to an array of applicable Policy objects.
   * @throws {AppError} If retrieving user policies fails.
   */
  async getUserPolicies(userId: string, role: string): Promise<Policy[]> {
    try {
      const userPolicies = await tableManager.findAll('UserPolicy', 1000, 0, [], "", "", {
        userId,
        isActive: true
      });

      const rolePolicies = await tableManager.findAll('RolePolicy', 1000, 0, [], "", "", {
        role,
        isActive: true
      });

      const policyIds = [
        ...userPolicies.map(up => up.policyId),
        ...rolePolicies.map(rp => rp.policyId)
      ];

      if (policyIds.length === 0) return [];

      const policies = await tableManager.findAll('Policy', 1000, 0, [], "", "", {
        id: { in: policyIds },
        isActive: true
      });

      return policies.map(policy => this.formatPolicy(policy));
    } catch (error) {
      logger.error({ error, userId, role }, 'Failed to get user policies');
      throw new AppError('Failed to get user policies', 500);
    }
  }

  /**
   * Evaluates access for a given context against all applicable policies.
   * Policies are sorted by priority, and the first matching policy determines the outcome.
   * @param context The evaluation context containing user, resource, action, and environment details.
   * @returns A Promise that resolves to an object indicating whether access is allowed, the reason, and the matched policy (if any).
   */
  async evaluateAccess(context: EvaluationContext): Promise<{ allowed: boolean; reason: string; matchedPolicy?: Policy }> {
    try {
      const policies = await this.getUserPolicies(context.user.id, context.user.role);

      if (policies.length === 0) {
        return {
          allowed: false,
          reason: 'No policies found for user'
        };
      }

      // Sort policies by priority (higher number = higher priority)
      const sortedPolicies = policies.sort((a, b) => b.priority - a.priority);

      for (const policy of sortedPolicies) {
        const evaluation = await this.evaluatePolicy(policy, context);

        if (evaluation.matched) {
          return {
            allowed: evaluation.effect === 'ALLOW',
            reason: evaluation.reason,
            matchedPolicy: policy
          };
        }
      }

      return {
        allowed: false,
        reason: 'No matching policy found'
      };
    } catch (error) {
      logger.error({ error, context }, 'Failed to evaluate access');
      return {
        allowed: false,
        reason: 'Error evaluating access'
      };
    }
  }

  /**
   * Evaluates a single policy against a given context.
   * Checks each rule within the policy for a match based on resource, action, and conditions.
   * @param policy The Policy object to evaluate.
   * @param context The evaluation context.
   * @returns A Promise that resolves to an object indicating whether a rule matched, its effect, and the reason.
   */
  private async evaluatePolicy(policy: Policy, context: EvaluationContext): Promise<{ matched: boolean; effect?: 'ALLOW' | 'DENY'; reason: string }> {
    for (const rule of policy.rules) {
      if (!rule.isActive) continue;

      // Check if resource and action match
      if (rule.resource !== '*' && rule.resource !== context.resource.name) {
        continue;
      }

      if (rule.action !== '*' && rule.action !== context.action) {
        continue;
      }

      // Evaluate conditions if present
      if (rule.conditions && rule.conditions.length > 0) {
        const conditionsMatch = await this.evaluateConditions(rule.conditions, context);
        if (!conditionsMatch) {
          continue;
        }
      }

      // Rule matches
      return {
        matched: true,
        effect: rule.effect,
        reason: `Policy '${policy.name}' rule matched: ${rule.description || `${rule.resource}:${rule.action}`}`
      };
    }

    return {
      matched: false,
      reason: `Policy '${policy.name}' - no matching rules`
    };
  }

  /**
   * Evaluates a set of policy conditions against the given context.
   * All conditions must evaluate to true for the set to match.
   * @param conditions An array of PolicyCondition objects.
   * @param context The evaluation context.
   * @returns A Promise that resolves to true if all conditions match, false otherwise.
   */
  private async evaluateConditions(conditions: PolicyCondition[], context: EvaluationContext): Promise<boolean> {
    for (const condition of conditions) {
      const contextValue = this.getContextValue(condition, context);
      const conditionValue = condition.value;

      const result = this.evaluateCondition(contextValue, condition.operator, conditionValue);

      if (!result) {
        return false; // All conditions must be true
      }
    }

    return true;
  }

  /**
   * Retrieves the value of a field from the evaluation context based on a policy condition.
   * @param condition The PolicyCondition object specifying the field and context type.
   * @param context The EvaluationContext.
   * @returns The value of the specified field from the context.
   */
  private getContextValue(condition: PolicyCondition, context: EvaluationContext): any {
    const [contextType, field] = condition.field.includes('.')
      ? condition.field.split('.', 2)
      : [condition.context || 'user', condition.field];

    switch (contextType) {
      case 'user':
        return context.user[field];
      case 'resource':
        return context.resource[field];
      case 'environment':
        return context.environment?.[field];
      case 'request':
        return context.request?.[field as keyof typeof context.request];
      default:
        return undefined;
    }
  }

  /**
   * Evaluates a single condition using the specified operator.
   * @param contextValue The value retrieved from the evaluation context.
   * @param operator The comparison operator (e.g., 'eq', 'gt', 'contains').
   * @param conditionValue The value specified in the policy condition.
   * @returns True if the condition evaluates to true, false otherwise.
   */
  private evaluateCondition(contextValue: any, operator: string, conditionValue: any): boolean {
    switch (operator) {
      case 'eq':
        return contextValue === conditionValue;
      case 'neq':
        return contextValue !== conditionValue;
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(contextValue);
      case 'notIn':
        return Array.isArray(conditionValue) && !conditionValue.includes(contextValue);
      case 'contains':
        return typeof contextValue === 'string' && contextValue.includes(conditionValue);
      case 'gt':
        return contextValue > conditionValue;
      case 'lt':
        return contextValue < conditionValue;
      case 'gte':
        return contextValue >= conditionValue;
      case 'lte':
        return contextValue <= conditionValue;
      case 'exists':
        return contextValue !== undefined && contextValue !== null;
      case 'startsWith':
        return typeof contextValue === 'string' && contextValue.startsWith(conditionValue);
      case 'endsWith':
        return typeof contextValue === 'string' && contextValue.endsWith(conditionValue);
      default:
        return false;
    }
  }

  /**
   * Validates the structure and content of policy rules.
   * @param rules An array of PolicyRule objects to validate.
   * @throws {AppError} If any rule is invalid (e.g., missing required fields, invalid effect).
   */
  private validatePolicyRules(rules: PolicyRule[]): void {
    for (const rule of rules) {
      if (!rule.resource || !rule.action || !rule.effect) {
        throw new AppError('Policy rule must have resource, action, and effect', 400);
      }

      if (!['ALLOW', 'DENY'].includes(rule.effect)) {
        throw new AppError('Policy rule effect must be ALLOW or DENY', 400);
      }

      if (rule.conditions) {
        for (const condition of rule.conditions) {
          if (!condition.field || !condition.operator) {
            throw new AppError('Policy condition must have field and operator', 400);
          }
        }
      }
    }
  }

  /**
   * Formats raw policy data retrieved from the database into a structured Policy object.
   * Parses JSON strings for `rules` and `tags` fields.
   * @param policyData The raw policy data from the database.
   * @returns A formatted Policy object.
   */
  private formatPolicy(policyData: any): Policy {
    return {
      id: policyData.id,
      name: policyData.name,
      description: policyData.description,
      type: policyData.type,
      rules: typeof policyData.rules === 'string'
        ? JSON.parse(policyData.rules)
        : policyData.rules || [],
      isActive: policyData.isActive,
      priority: policyData.priority,
      createdBy: policyData.createdBy,
      tags: typeof policyData.tags === 'string'
        ? JSON.parse(policyData.tags)
        : policyData.tags || []
    };
  }

  /**
   * Tests a specific policy against a sample evaluation context.
   * @param policyId The ID of the policy to test.
   * @param context The evaluation context to test against.
   * @returns A Promise that resolves to an object containing the test result (allowed, reason, and evaluation details).
   * @throws {AppError} If the policy is not found or testing fails.
   */
  async testPolicy(policyId: string, context: EvaluationContext): Promise<{ allowed: boolean; reason: string; evaluation: any }> {
    try {
      const policy = await this.getPolicyById(policyId);
      if (!policy) {
        throw new AppError('Policy not found', 404);
      }

      const evaluation = await this.evaluatePolicy(policy, context);

      return {
        allowed: evaluation.effect === 'ALLOW',
        reason: evaluation.reason,
        evaluation: {
          matched: evaluation.matched,
          effect: evaluation.effect,
          policy: {
            id: policy.id,
            name: policy.name,
            type: policy.type
          }
        }
      };
    } catch (error) {
      logger.error({ error, policyId, context }, 'Failed to test policy');
      throw new AppError('Failed to test policy', 500);
    }
  }
}

/**
 * Singleton instance of the PolicyService.
 */
export const policyService = new PolicyService();