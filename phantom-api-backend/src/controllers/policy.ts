import { Response } from 'express';
import { PolicyRequest } from '../middleware/policyAuth';
import { policyService, Policy, EvaluationContext } from '../services/policyService';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../logger';

export class PolicyController {
  /**
   * Retrieves all policies based on optional filters.
   * @param req The Express request object, extended with PolicyRequest properties.
   * @param res The Express response object.
   * @returns A JSON response containing the policies and their count.
   * @throws {AppError} If there is an error retrieving policies.
   */
  async getPolicies(req: PolicyRequest, res: Response) {
    try {
      const { isActive, type } = req.query;

      const filters: any = {};
      if (isActive !== undefined) {
        filters.isActive = isActive === 'true';
      }
      if (type) {
        filters.type = type;
      }

      const policies = await policyService.getPolicies(filters);
      return res.json({
        success: true,
        data: policies,
        count: policies.length
      });
    } catch (error) {
      console.error('Failed to get policies route:', error);
      logger.error({ error, query: req.query }, 'Failed to get policies');
      throw error;
    }
  }

  /**
   * Retrieves a single policy by its ID.
   * @param req The Express request object, extended with PolicyRequest properties.
   * @param res The Express response object.
   * @returns A JSON response containing the policy data.
   * @throws {AppError} If the policy is not found or an error occurs.
   */
  async getPolicyById(req: PolicyRequest, res: Response) {
    try {
      const { id } = req.params;

      const policy = await policyService.getPolicyById(id);

      if (!policy) {
        throw new AppError('Policy not found', 404);
      }

      res.json({
        success: true,
        data: policy
      });
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Failed to get policy by ID');
      throw error;
    }
  }

  /**
   * Creates a new policy.
   * @param req The Express request object, extended with PolicyRequest properties, containing policy data in the body.
   * @param res The Express response object.
   * @returns A JSON response containing the newly created policy and a success message.
   * @throws {AppError} If required fields are missing or policy creation fails.
   */
  async createPolicy(req: PolicyRequest, res: Response) {
    try {
      const { name, description, type, rules, isActive = true, priority = 100, tags = [] } = req.body;
      const createdBy = req.user?.id || 'system';

      if (!name || !type || !rules) {
        throw new AppError('Name, type, and rules are required', 400);
      }

      const policyData: Omit<Policy, 'id'> = {
        name,
        description,
        type,
        rules,
        isActive,
        priority,
        createdBy,
        tags
      };

      const policy = await policyService.createPolicy(policyData);

      res.status(201).json({
        success: true,
        data: policy,
        message: 'Policy created successfully'
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Failed to create policy');
      throw error;
    }
  }

  /**
   * Updates an existing policy.
   * @param req The Express request object, extended with PolicyRequest properties, containing policy ID in params and updates in body.
   * @param res The Express response object.
   * @returns A JSON response containing the updated policy and a success message.
   * @throws {AppError} If the policy update fails.
   */
  async updatePolicy(req: PolicyRequest, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const policy = await policyService.updatePolicy(id, updates);

      res.json({
        success: true,
        data: policy,
        message: 'Policy updated successfully'
      });
    } catch (error) {
      logger.error({ error, id: req.params.id, updates: req.body }, 'Failed to update policy');
      throw error;
    }
  }

  /**
   * Deletes a policy by its ID.
   * @param req The Express request object, extended with PolicyRequest properties, containing policy ID in params.
   * @param res The Express response object.
   * @returns A JSON response indicating successful deletion.
   * @throws {AppError} If policy deletion fails.
   */
  async deletePolicy(req: PolicyRequest, res: Response) {
    try {
      const { id } = req.params;

      await policyService.deletePolicy(id);

      res.json({
        success: true,
        message: 'Policy deleted successfully'
      });
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Failed to delete policy');
      throw error;
    }
  }

  /**
   * Assign policy to user
   */
  async assignPolicyToUser(req: PolicyRequest, res: Response) {
    try {
      const { userId, policyId } = req.params;
      const { expiresAt } = req.body;
      const assignedBy = req.user?.id || 'system';

      const expirationDate = expiresAt ? new Date(expiresAt) : undefined;

      await policyService.assignPolicyToUser(userId, policyId, assignedBy, expirationDate);

      res.json({
        success: true,
        message: 'Policy assigned to user successfully'
      });
    } catch (error) {
      logger.error({ error, userId: req.params.userId, policyId: req.params.policyId }, 'Failed to assign policy to user');
      throw error;
    }
  }

  /**
   * Assign policy to role
   */
  async assignPolicyToRole(req: PolicyRequest, res: Response) {
    try {
      const { role, policyId } = req.params;
      const { priority = 100 } = req.body;
      const assignedBy = req.user?.id || 'system';

      await policyService.assignPolicyToRole(role, policyId, assignedBy, priority);

      res.json({
        success: true,
        message: 'Policy assigned to role successfully'
      });
    } catch (error) {
      logger.error({ error, role: req.params.role, policyId: req.params.policyId }, 'Failed to assign policy to role');
      throw error;
    }
  }

  /**
   * Get user policies
   */
  async getUserPolicies(req: PolicyRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { role } = req.query;

      if (!role) {
        throw new AppError('User role is required', 400);
      }

      const policies = await policyService.getUserPolicies(userId, role as string);

      res.json({
        success: true,
        data: policies,
        count: policies?.length
      });
    } catch (error) {
      logger.error({ error, userId: req.params.userId, role: req.query.role }, 'Failed to get user policies');
      throw error;
    }
  }

  /**
   * Test policy access
   */
  async testAccess(req: PolicyRequest, res: Response) {
    try {
      const context: EvaluationContext = req.body;

      if (!context.user || !context.resource || !context.action) {
        throw new AppError('User, resource, and action are required for evaluation', 400);
      }

      const result = await policyService.evaluateAccess(context);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error, context: req.body }, 'Failed to test access');
      throw error;
    }
  }

  /**
   * Test specific policy
   */
  async testPolicy(req: PolicyRequest, res: Response) {
    try {
      const { id } = req.params;
      const context: EvaluationContext = req.body;

      if (!context.user || !context.resource || !context.action) {
        throw new AppError('User, resource, and action are required for evaluation', 400);
      }

      const result = await policyService.testPolicy(id, context);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error, policyId: req.params.id, context: req.body }, 'Failed to test policy');
      throw error;
    }
  }

  /**
   * Get policy templates
   */
  async getPolicyTemplates(req: PolicyRequest, res: Response) {
    try {
      const templates = [
        {
          id: 'role-based-basic',
          name: 'Basic Role-Based Policy',
          description: 'Simple role-based access control',
          type: 'ROLE_BASED',
          template: {
            name: 'Role-Based Policy Template',
            description: 'Template for role-based access control',
            type: 'ROLE_BASED',
            rules: [
              {
                resource: '*',
                action: 'read',
                effect: 'ALLOW',
                priority: 100,
                description: 'Allow read access to all resources',
                isActive: true
              }
            ],
            isActive: true,
            priority: 100,
            tags: ['template', 'role-based']
          }
        },
        {
          id: 'attribute-based-advanced',
          name: 'Advanced Attribute-Based Policy',
          description: 'Context-aware access control with conditions',
          type: 'ATTRIBUTE_BASED',
          template: {
            name: 'Attribute-Based Policy Template',
            description: 'Template for attribute-based access control',
            type: 'ATTRIBUTE_BASED',
            rules: [
              {
                resource: 'User',
                action: 'update',
                effect: 'ALLOW',
                conditions: [
                  {
                    field: 'user.id',
                    operator: 'eq',
                    value: '${resource.id}',
                    context: 'user'
                  }
                ],
                priority: 100,
                description: 'Allow users to update their own data',
                isActive: true
              }
            ],
            isActive: true,
            priority: 100,
            tags: ['template', 'attribute-based']
          }
        },
        {
          id: 'time-based',
          name: 'Time-Based Access Policy',
          description: 'Access control with time restrictions',
          type: 'CUSTOM',
          template: {
            name: 'Time-Based Policy Template',
            description: 'Template for time-based access control',
            type: 'CUSTOM',
            rules: [
              {
                resource: '*',
                action: '*',
                effect: 'ALLOW',
                conditions: [
                  {
                    field: 'environment.timestamp',
                    operator: 'gte',
                    value: '09:00',
                    context: 'environment'
                  },
                  {
                    field: 'environment.timestamp',
                    operator: 'lte',
                    value: '17:00',
                    context: 'environment'
                  }
                ],
                priority: 100,
                description: 'Allow access during business hours only',
                isActive: true
              }
            ],
            isActive: true,
            priority: 100,
            tags: ['template', 'time-based']
          }
        }
      ];

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get policy templates');
      throw error;
    }
  }

  /**
   * Get policy analytics
   */
  async getPolicyAnalytics(_: PolicyRequest, res: Response) {
    try {

      // This would normally fetch real analytics from database/logs
      const analytics = {
        totalPolicies: await this.getTotalPoliciesCount(),
        activePolicies: await this.getActivePoliciesCount(),
        policyTypes: await this.getPolicyTypesDistribution(),
        recentActivity: [], // Would be populated from audit logs
        topResources: [], // Would be populated from usage analytics
        accessDenials: 0, // Would be populated from logs
        accessGrants: 0 // Would be populated from logs
      };

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get policy analytics');
      throw error;
    }
  }

  private async getTotalPoliciesCount(): Promise<number> {
    try {
      const policies = await policyService.getPolicies();
      return policies.length;
    } catch (error) {
      logger.warn({ error }, 'Unable to fetch total policies count, defaulting to 0');
      return 0;
    }
  }

  private async getActivePoliciesCount(): Promise<number> {
    try {
      const policies = await policyService.getPolicies({ isActive: true });
      return policies.length;
    } catch (error) {
      logger.warn({ error }, 'Unable to fetch active policies count, defaulting to 0');
      return 0;
    }
  }

  private async getPolicyTypesDistribution(): Promise<Record<string, number>> {
    try {
      const policies = await policyService.getPolicies();
      const distribution: Record<string, number> = {};
      policies.forEach(policy => {
        distribution[policy.type] = (distribution[policy.type] || 0) + 1;
      });
      return distribution;
    } catch (error) {
      logger.warn({ error }, 'Unable to fetch policy types distribution, defaulting to empty');
      return {};
    }
  }
}