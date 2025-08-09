import logger from '@/lib/logger';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

// Cache for CSRF token
let csrfTokenCache: string | null = null;

// Function to get CSRF token
const getCSRFToken = async (): Promise<string | null> => {
  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/csrf-token`, {
      withCredentials: true
    });

    if (response.data?.csrfToken) {
      csrfTokenCache = response.data.csrfToken;
      return csrfTokenCache;
    }
  } catch (error) {
    console.warn('Could not fetch CSRF token:', error);
  }

  return null;
};

// Interceptor to add CSRF token to requests
api.interceptors.request.use(async (config) => {
  // Skip CSRF token for the csrf-token endpoint itself
  if (config.url?.includes('/csrf-token')) {
    return config;
  }

  // Only add CSRF token for non-GET requests
  if (config.method && ['post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())) {
    const token = await getCSRFToken();
    if (token) {
      config.headers['CSRF-Token'] = token;
    }
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

export interface Policy {
  id?: string;
  name: string;
  description?: string;
  type: 'ROLE_BASED' | 'ATTRIBUTE_BASED' | 'CUSTOM';
  rules: PolicyRule[];
  isActive: boolean;
  priority: number;
  createdBy: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PolicyRule {
  id?: string;
  resource: string;
  action: string;
  effect: 'ALLOW' | 'DENY';
  conditions?: PolicyCondition[];
  priority: number;
  description?: string;
  isActive: boolean;
}

export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'notIn' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'exists';
  value: any;
  context?: 'user' | 'resource' | 'environment' | 'request';
}

export interface EvaluationContext {
  user: {
    id: string;
    role: string;
    email?: string;
    [key: string]: any;
  };
  resource: {
    name: string;
    id?: string;
    data?: any;
    [key: string]: any;
  };
  action: string;
  environment?: {
    timestamp: Date;
    ip?: string;
    userAgent?: string;
    [key: string]: any;
  };
  request?: {
    method: string;
    path: string;
    query?: any;
    body?: any;
    headers?: any;
  };
}

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  template: Partial<Policy>;
}

export interface PolicyAnalytics {
  totalPolicies: number;
  activePolicies: number;
  policyTypes: Record<string, number>;
  recentActivity: any[];
  topResources: any[];
  accessDenials: number;
  accessGrants: number;
}

export interface AccessEvaluation {
  allowed: boolean;
  reason: string;
  matchedPolicy?: Policy;
}

export interface PolicyTestResult {
  allowed: boolean;
  reason: string;
  evaluation: any;
}

export const policyApiService = {
  // Policies CRUD
  async getPolicies(filters?: { isActive?: boolean; type?: string }): Promise<Policy[]> {
    const params = new URLSearchParams();
    if (filters?.isActive !== undefined) {
      params.append('isActive', filters.isActive.toString());
    }
    if (filters?.type) {
      params.append('type', filters.type);
    }

    const response = await api.get(`/admin/api/policies${params && '?' + params.toString()}`);
    return response.data.data || [];
  },

  async getPolicyById(id: string): Promise<Policy> {
    const response = await api.get(`/admin/api/policies/${id}`);
    return response.data.data;
  },

  async createPolicy(policyData: Omit<Policy, 'id'>): Promise<Policy> {
    const response = await api.post('/admin/api/policies', policyData);
    return response.data.data;
  },

  async updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy> {
    const response = await api.put(`/admin/api/policies/${id}`, updates);
    return response.data.data;
  },

  async deletePolicy(id: string): Promise<void> {
    await api.delete(`/admin/api/policies/${id}`);
  },

  // Policy Assignment
  async assignPolicyToUser(userId: string, policyId: string, expiresAt?: Date): Promise<void> {
    const data: any = {};
    if (expiresAt) {
      data.expiresAt = expiresAt.toISOString();
    }

    await api.post(`/admin/api/policies/${policyId}/assign/user/${userId}`, data);
  },

  async assignPolicyToRole(role: string, policyId: string, priority: number = 100): Promise<void> {
    await api.post(`/admin/api/policies/${policyId}/assign/role/${role}`, { priority });
  },

  async getUserPolicies(userId: string, role: string): Promise<Policy[]> {
    const response = await api.get(`/admin/api/users/${userId}/policies?role=${role}`);
    return response.data.data || [];
  },

  // Policy Testing
  async testAccess(context: EvaluationContext): Promise<AccessEvaluation> {
    const response = await api.post('/admin/api/policies/test-access', context);
    return response.data.data;
  },

  async testPolicy(policyId: string, context: EvaluationContext): Promise<PolicyTestResult> {
    const response = await api.post(`/admin/api/policies/${policyId}/test`, context);
    return response.data.data;
  },

  // Templates
  async getPolicyTemplates(): Promise<PolicyTemplate[]> {
    const response = await api.get('/admin/api/policies-templates');
    return response.data.data || [];
  },

  async createPolicyFromTemplate(templateId: string, customizations?: Partial<Policy>): Promise<Policy> {
    const templates = await this.getPolicyTemplates();
    const template = templates.find(t => t.id === templateId);

    if (!template) {
      throw new Error('Template not found');
    }

    const policyData: Omit<Policy, 'id'> = {
      ...template.template,
      ...customizations,
      createdBy: 'admin' // This would come from auth context
    } as Omit<Policy, 'id'>;

    return this.createPolicy(policyData);
  },

  // Analytics
  async getPolicyAnalytics(timeframe: string = '7d'): Promise<PolicyAnalytics> {
    const response = await api.get(`/admin/api/policies-analytics?timeframe=${timeframe}`);
    return response.data.data;
  },

  // Utility functions
  async validatePolicy(policy: Omit<Policy, 'id'>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Basic validation
    if (!policy.name || policy.name.trim().length === 0) {
      errors.push('Policy name is required');
    }

    if (!policy.type) {
      errors.push('Policy type is required');
    }

    if (!policy.rules || policy.rules.length === 0) {
      errors.push('At least one rule is required');
    }

    // Rule validation
    if (policy.rules) {
      policy.rules.forEach((rule, index) => {
        if (!rule.resource) {
          errors.push(`Rule ${index + 1}: Resource is required`);
        }

        if (!rule.action) {
          errors.push(`Rule ${index + 1}: Action is required`);
        }

        if (!['ALLOW', 'DENY'].includes(rule.effect)) {
          errors.push(`Rule ${index + 1}: Effect must be ALLOW or DENY`);
        }

        // Condition validation
        if (rule.conditions) {
          rule.conditions.forEach((condition, condIndex) => {
            if (!condition.field) {
              errors.push(`Rule ${index + 1}, Condition ${condIndex + 1}: Field is required`);
            }

            if (!condition.operator) {
              errors.push(`Rule ${index + 1}, Condition ${condIndex + 1}: Operator is required`);
            }
          });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Policy simulation
  async simulatePolicyChanges(_policies: Policy[], context: EvaluationContext): Promise<{
    before: AccessEvaluation;
    after: AccessEvaluation;
    impact: string;
  }> {
    // This would simulate what would happen if the policies were applied
    // For now, just return a placeholder
    const before = await this.testAccess(context);

    // TODO: Implement actual simulation logic
    const after = before;

    return {
      before,
      after,
      impact: 'No change detected'
    };
  },

  // Export/Import
  async exportPolicies(format: 'json' | 'yaml' = 'json'): Promise<Blob> {
    const policies = await this.getPolicies();
    const data = JSON.stringify(policies, null, 2);

    return new Blob([data], {
      type: format === 'json' ? 'application/json' : 'application/x-yaml'
    });
  },

  async importPolicies(file: File): Promise<{ imported: number; errors: string[] }> {
    const text = await file.text();

    try {
      const policies: Policy[] = JSON.parse(text);
      const errors: string[] = [];
      let imported = 0;

      for (const policy of policies) {
        try {
          const validation = await this.validatePolicy(policy);
          if (!validation.valid) {
            errors.push(`Policy "${policy.name}": ${validation.errors.join(', ')}`);
            continue;
          }

          await this.createPolicy(policy);
          imported++;
        } catch (error) {
          errors.push(`Policy "${policy.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { imported, errors };
    } catch (error) {
      logger.error('Failed to parse policy import file:', error);
      return {
        imported: 0,
        errors: ['Invalid JSON format']
      };
    }
  }
};