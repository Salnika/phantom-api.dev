import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Play,
  Settings,
  Shield,
  Users,
  FileText,
  BarChart3
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { policyApiService } from '../services/policyApiService';
import { Input } from '@/components/ui/input';
import type { EvaluationContext, AccessEvaluation, PolicyTestResult } from '../services/policyApiService';
import { Textarea } from '@/components/ui/textarea';

interface Policy {
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

interface PolicyRule {
  id?: string;
  resource: string;
  action: string;
  effect: 'ALLOW' | 'DENY';
  conditions?: PolicyCondition[];
  priority: number;
  description?: string;
  isActive: boolean;
}

interface PolicyCondition {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'notIn' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'exists';
  value: any;
  context?: 'user' | 'resource' | 'environment' | 'request';
}

interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  template: Partial<Policy>;
}

interface PolicyAnalytics {
  totalPolicies: number;
  activePolicies: number;
  policyTypes: Record<string, number>;
  recentActivity: any[];
  topResources: any[];
  accessDenials: number;
  accessGrants: number;
}

export const PoliciesPage: React.FC = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [templates, setTemplates] = useState<PolicyTemplate[]>([]);
  const [analytics, setAnalytics] = useState<PolicyAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  // State for policy testing
  const [testUserContext, setTestUserContext] = useState<string>('{"id":"","role":""}');
  const [testResourceContext, setTestResourceContext] = useState<string>('{"name":""}');
  const [testAction, setTestAction] = useState<string>('');
  const [testResult, setTestResult] = useState<AccessEvaluation | PolicyTestResult | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // State for creating a new policy
  const defaultRule: PolicyRule = {
    resource: '',
    action: '',
    effect: 'ALLOW',
    priority: 100,
    isActive: true,
    description: '',
    conditions: []
  };
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'ROLE_BASED' | 'ATTRIBUTE_BASED' | 'CUSTOM'>('ROLE_BASED');
  const [newPriority, setNewPriority] = useState(100);
  const [newTags, setNewTags] = useState('');
  const [newRules, setNewRules] = useState<PolicyRule[]>([{ ...defaultRule }]);

  // Load policies
  const loadPolicies = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const filters: any = {};
      if (filterStatus !== 'all') {
        filters.isActive = filterStatus === 'active';
      }
      if (filterType !== 'all') {
        filters.type = filterType;
      }

      const data = await policyApiService.getPolicies(filters);
      setPolicies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const data = await policyApiService.getPolicyTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  }, []);

  // Load analytics
  const loadAnalytics = useCallback(async () => {
    try {
      const data = await policyApiService.getPolicyAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }, []);

  useEffect(() => {
    loadPolicies();
    loadTemplates();
    loadAnalytics();
  }, [loadPolicies, loadTemplates, loadAnalytics]);

  // Filter policies based on search
  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = !searchQuery ||
      policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  // Handle policy test/evaluation
  const handleTestPolicy = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);
      // Parse contexts
      const userCtx = JSON.parse(testUserContext);
      const resCtx = JSON.parse(testResourceContext);
      const context: EvaluationContext = {
        user: userCtx,
        resource: resCtx,
        action: testAction,
      };
      let result: AccessEvaluation | PolicyTestResult;
      if (selectedPolicy?.id) {
        result = await policyApiService.testPolicy(selectedPolicy.id, context);
      } else {
        result = await policyApiService.testAccess(context);
      }
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate policy');
    } finally {
      setIsTesting(false);
    }
  };

  // Handle policy actions
  const handleTogglePolicy = async (policy: Policy) => {
    try {
      await policyApiService.updatePolicy(policy.id!, { isActive: !policy.isActive });
      await loadPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle policy');
    }
  };

  const handleDeletePolicy = async (policy: Policy) => {
    if (!confirm(`Are you sure you want to delete policy "${policy.name}"?`)) {
      return;
    }

    try {
      await policyApiService.deletePolicy(policy.id!);
      await loadPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete policy');
    }
  };

  const getPolicyTypeColor = (type: string) => {
    switch (type) {
      case 'ROLE_BASED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ATTRIBUTE_BASED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'CUSTOM':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEffectColor = (effect: string) => {
    return effect === 'ALLOW'
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <div className="container-responsive section-spacing animate-fadeIn">
      {/* Header */}
      <div className="responsive-flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            <Shield className="inline-block mr-3" size={28} />
            Policies Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage access control policies, rules, and permissions
          </p>
        </div>

        <div className="responsive-flex items-center gap-2">
          <Button
            onClick={() => setShowAnalyticsModal(true)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <BarChart3 size={16} />
            Analytics
          </Button>

          <Button
            onClick={() => setShowTemplatesModal(true)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <FileText size={16} />
            Templates
          </Button>

          <Button
            onClick={() => setShowCreateModal(true)}
            className="gap-2"
          >
            <Plus size={16} />
            Create Policy
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Policies</p>
                  <p className="text-2xl font-bold">{analytics.totalPolicies}</p>
                </div>
                <Shield className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Policies</p>
                  <p className="text-2xl font-bold text-green-600">{analytics.activePolicies}</p>
                </div>
                <Settings className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Access Grants</p>
                  <p className="text-2xl font-bold text-blue-600">{analytics.accessGrants}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Access Denials</p>
                  <p className="text-2xl font-bold text-red-600">{analytics.accessDenials}</p>
                </div>
                <Shield className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="responsive-flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder="Search policies by name, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input pl-10 w-full"
              />
            </div>

            <div className="responsive-flex items-center gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="form-select"
              >
                <option value="all">All Types</option>
                <option value="ROLE_BASED">Role-Based</option>
                <option value="ATTRIBUTE_BASED">Attribute-Based</option>
                <option value="CUSTOM">Custom</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="form-select"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <Button
                onClick={() => setShowTestModal(true)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Play size={16} />
                Test Access
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {/* Policies List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="loading-spinner w-8 h-8" />
          <span className="ml-3">Loading policies...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPolicies.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No policies found</p>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? 'Try adjusting your search criteria' : 'Create your first policy to get started'}
                </p>
                <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                  <Plus size={16} />
                  Create Policy
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredPolicies.map((policy) => (
              <Card key={policy.id} className="card-hover">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{policy.name}</h3>
                        <Badge className={getPolicyTypeColor(policy.type)}>
                          {policy.type.replace('_', ' ')}
                        </Badge>
                        <Badge className={policy.isActive ? 'badge-success' : 'badge-secondary'}>
                          {policy.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Priority: {policy.priority}
                        </span>
                      </div>

                      {policy.description && (
                        <p className="text-muted-foreground mb-3">{policy.description}</p>
                      )}

                      {/* Rules Summary */}
                      <div className="mb-3">
                        <p className="text-sm font-medium mb-2">Rules ({policy.rules.length}):</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {policy.rules.slice(0, 6).map((rule, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                              <Badge className={getEffectColor(rule.effect)}>
                                {rule.effect}
                              </Badge>
                              <span className="font-medium">{rule.resource}</span>
                              <span className="text-muted-foreground">:{rule.action}</span>
                            </div>
                          ))}
                          {policy.rules.length > 6 && (
                            <div className="text-sm text-muted-foreground p-2">
                              +{policy.rules.length - 6} more rules
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tags */}
                      {policy.tags && policy.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {policy.tags.map((tag, index) => (
                            <Badge key={index} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        onClick={() => {
                          setSelectedPolicy(policy);
                          setShowTestModal(true);
                        }}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Play size={14} />
                        Test
                      </Button>

                      <Button
                        onClick={() => handleTogglePolicy(policy)}
                        variant={policy.isActive ? "outline" : "default"}
                        size="sm"
                      >
                        {policy.isActive ? 'Disable' : 'Enable'}
                      </Button>

                      <Button
                        onClick={() => handleDeletePolicy(policy)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Create New Policy</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  type="text"
                  className="border border-gray-300 rounded px-2 py-1 w-full form-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  className="border border-gray-300 rounded px-2 py-1 w-full"
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    className="border border-gray-300 rounded px-2 py-1 w-full"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                  >
                    <option value="ROLE_BASED">Role-Based</option>
                    <option value="ATTRIBUTE_BASED">Attribute-Based</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Priority</label>
                  <Input
                    type="number"
                    className="border border-gray-300 rounded px-2 py-1 w-full"
                    value={newPriority}
                    onChange={(e) => setNewPriority(Number(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
                <Input
                  type="text"
                  className="border border-gray-300 rounded px-2 py-1 w-full"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rules</label>
                {newRules.map((rule, idx) => (
                  <div key={idx} className="grid grid-cols-6 gap-2 items-end mb-2">
                    <div className="col-span-2">
                      <label className="sr-only">Resource</label>
                      <Input
                        type="text"
                        placeholder="Resource"
                        className="border border-gray-300 rounded px-2 py-1 w-full"
                        value={rule.resource}
                        onChange={(e) => {
                          const updated = [...newRules];
                          updated[idx].resource = e.target.value;
                          setNewRules(updated);
                        }}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="sr-only">Action</label>
                      <Input
                        type="text"
                        placeholder="Action"
                        className="border border-gray-300 rounded px-2 py-1 w-full"
                        value={rule.action}
                        onChange={(e) => {
                          const updated = [...newRules];
                          updated[idx].action = e.target.value;
                          setNewRules(updated);
                        }}
                      />
                    </div>
                    <div>
                      <label className="sr-only">Effect</label>
                      <select
                        className="border border-gray-300 rounded px-2 py-1 w-full"
                        value={rule.effect}
                        onChange={(e) => {
                          const updated = [...newRules];
                          updated[idx].effect = e.target.value as any;
                          setNewRules(updated);
                        }}
                      >
                        <option value="ALLOW">ALLOW</option>
                        <option value="DENY">DENY</option>
                      </select>
                    </div>
                    <div>
                      <label className="sr-only">Priority</label>
                      <Input
                        type="number"
                        className="border border-gray-300 rounded px-2 py-1 w-full"
                        value={rule.priority}
                        onChange={(e) => {
                          const updated = [...newRules];
                          updated[idx].priority = Number(e.target.value);
                          setNewRules(updated);
                        }}
                      />
                    </div>
                    <div>
                      {newRules.length > 1 && (
                        <button
                          type="button"
                          className="text-red-600 hover:text-red-800"
                          onClick={() => {
                            setNewRules(newRules.filter((_, i) => i !== idx));
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewRules([...newRules, { ...defaultRule }])}
                >
                  + Add Rule
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await policyApiService.createPolicy({
                      name: newName,
                      description: newDesc,
                      type: newType,
                      rules: newRules,
                      isActive: true,
                      priority: newPriority,
                      createdBy: 'admin',
                      tags: newTags.split(',').map(t => t.trim()).filter(Boolean)
                    });
                    await loadPolicies();
                    setShowCreateModal(false);
                    // Reset form
                    setNewName('');
                    setNewDesc('');
                    setNewType('ROLE_BASED');
                    setNewPriority(100);
                    setNewTags('');
                    setNewRules([{ ...defaultRule }]);
                  } catch (err: any) {
                    setError(err.message || 'Failed to create policy');
                  }
                }}
              >
                Create Policy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && (
        <div className="modal-overlay" onClick={() => setShowTestModal(false)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">
              Test Policy Access
              {selectedPolicy && ` - ${selectedPolicy.name}`}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">User Context (JSON)</label>
                <Textarea
                  className="w-full form-textarea"
                  rows={4}
                  value={testUserContext}
                  onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setTestUserContext(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Resource Context (JSON)</label>
                <Textarea
                  className="w-full form-textarea"
                  rows={4}
                  value={testResourceContext}
                  onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setTestResourceContext(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Action</label>
                <Input
                  type="text"
                  className="w-full form-input"
                  value={testAction}
                  onChange={(e) => setTestAction(e.target.value)}
                  placeholder="read, write, delete..."
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => {
                  setShowTestModal(false);
                  setSelectedPolicy(null);
                  setTestResult(null);
                }}>
                  Close
                </Button>
                <Button onClick={handleTestPolicy} disabled={isTesting}>
                  {isTesting ? 'Evaluating...' : 'Evaluate'}
                </Button>
              </div>
              {testResult && (
                <div className="mt-4 p-4 border border-input rounded space-y-2">
                  <div><strong>Allowed:</strong> {testResult.allowed ? 'Yes' : 'No'}</div>
                  <div><strong>Reason:</strong> {testResult.reason}</div>
                  {('matchedPolicy' in testResult) && testResult.matchedPolicy && (
                    <div><strong>Policy:</strong> {testResult.matchedPolicy.name}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplatesModal && (
        <div className="modal-overlay" onClick={() => setShowTemplatesModal(false)}>
          <div className="modal-content max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Policy Templates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {templates.map((template) => (
                <Card key={template.id} className="card-hover cursor-pointer">
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-2">{template.name}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                    <Badge className={getPolicyTypeColor(template.type)}>
                      {template.type.replace('_', ' ')}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowTemplatesModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalyticsModal && analytics && (
        <div className="modal-overlay" onClick={() => setShowAnalyticsModal(false)}>
          <div className="modal-content max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Policy Analytics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <h4 className="font-medium mb-2">Policy Types Distribution</h4>
                <div className="space-y-2">
                  {Object.entries(analytics.policyTypes).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span>{type.replace('_', ' ')}</span>
                      <Badge>{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Access Statistics</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span>Total Policies</span>
                    <Badge>{analytics.totalPolicies}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span>Active Policies</span>
                    <Badge className="badge-success">{analytics.activePolicies}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span>Access Grants</span>
                    <Badge className="badge-success">{analytics.accessGrants}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span>Access Denials</span>
                    <Badge className="badge-error">{analytics.accessDenials}</Badge>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowAnalyticsModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};