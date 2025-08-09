import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiService } from '@/services/api';
import type { JwtTokenInfo } from '@/services/api';
import { 
  Shield, 
  Plus, 
  Search, 
  Trash2, 
  Eye, 
  Clock,
  User,
  Key,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';

interface TokenStats {
  total: number;
  active: number;
  revoked: number;
  expired: number;
  byType: Record<string, number>;
}

const TokenManagement: React.FC = () => {
  const [tokens, setTokens] = useState<JwtTokenInfo[]>([]);
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [page] = useState(1);
  const [limit] = useState(20);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedToken, setSelectedToken] = useState<JwtTokenInfo | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Create token form state
  const [createForm, setCreateForm] = useState({
    userId: '',
    tokenType: 'api' as 'api' | 'access' | 'refresh',
    expiresIn: '30d',
    scopes: '',
    metadata: ''
  });

  const loadTokens = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit };
      
      if (filterType !== 'all') params.tokenType = filterType;
      if (filterStatus === 'revoked') params.isRevoked = true;
      if (filterStatus === 'active') params.isRevoked = false;
      if (filterStatus === 'expired') params.includeExpired = true;

      const response = await apiService.getTokens(params);
      if (response.success && response.data) {
        setTokens(response.data.tokens);
      }
    } catch (error) {
      console.error('Failed to load tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiService.getTokenStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load token stats:', error);
    }
  };

  useEffect(() => {
    loadTokens();
    loadStats();
  }, [page, filterType, filterStatus]);

  const handleCreateToken = async () => {
    try {
      const formData = {
        ...createForm,
        scopes: createForm.scopes ? createForm.scopes.split(',').map(s => s.trim()) : undefined,
        metadata: createForm.metadata ? JSON.parse(createForm.metadata) : undefined
      };

      const response = await apiService.createToken(formData);
      if (response.success) {
        setShowCreateDialog(false);
        setCreateForm({
          userId: '',
          tokenType: 'api',
          expiresIn: '30d',
          scopes: '',
          metadata: ''
        });
        loadTokens();
        loadStats();
        
        // Show the generated token
        alert(`Token created successfully:\n\n${response.data?.token}\n\nPlease save this token as it won't be shown again.`);
      }
    } catch (error) {
      console.error('Failed to create token:', error);
      alert('Failed to create token. Please try again.');
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await apiService.revokeToken(tokenId);
      if (response.success) {
        loadTokens();
        loadStats();
      }
    } catch (error) {
      console.error('Failed to revoke token:', error);
      alert('Failed to revoke token. Please try again.');
    }
  };

  const handleCleanupExpired = async () => {
    if (!confirm('Are you sure you want to cleanup all expired tokens? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await apiService.cleanupExpiredTokens();
      if (response.success) {
        loadTokens();
        loadStats();
        alert(`Successfully cleaned up ${response.data?.deletedCount || 0} expired tokens.`);
      }
    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error);
      alert('Failed to cleanup expired tokens. Please try again.');
    }
  };

  const getTokenStatusBadge = (token: JwtTokenInfo) => {
    if (token.is_revoked) {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    
    const now = new Date();
    const expiresAt = new Date(token.expires_at);
    
    if (expiresAt <= now) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    
    return <Badge variant="default">Active</Badge>;
  };

  const getTokenTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      api: 'default',
      access: 'secondary',
      refresh: 'outline',
      reset_password: 'outline'
    };
    
    return <Badge variant={variants[type] || 'outline'}>{type.toUpperCase()}</Badge>;
  };

  const filteredTokens = tokens.filter(token => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        token.id.toLowerCase().includes(searchLower) ||
        token.user_id?.toLowerCase().includes(searchLower) ||
        token.token_type.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Token Management</h1>
          <p className="text-muted-foreground">
            Manage JWT tokens, view statistics, and control access
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCleanupExpired} variant="outline">
            <Trash2 className="h-4 w-4 mr-2" />
            Cleanup Expired
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Token
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Token</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="userId">User ID (optional)</Label>
                  <Input
                    id="userId"
                    value={createForm.userId}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, userId: e.target.value }))}
                    placeholder="Leave empty for API token"
                  />
                </div>
                <div>
                  <Label htmlFor="tokenType">Token Type</Label>
                  <Select value={createForm.tokenType} onValueChange={(value: any) => setCreateForm(prev => ({ ...prev, tokenType: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api">API Token</SelectItem>
                      <SelectItem value="access">Access Token</SelectItem>
                      <SelectItem value="refresh">Refresh Token</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="expiresIn">Expires In</Label>
                  <Select value={createForm.expiresIn} onValueChange={(value) => setCreateForm(prev => ({ ...prev, expiresIn: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">1 Hour</SelectItem>
                      <SelectItem value="1d">1 Day</SelectItem>
                      <SelectItem value="7d">7 Days</SelectItem>
                      <SelectItem value="30d">30 Days</SelectItem>
                      <SelectItem value="90d">90 Days</SelectItem>
                      <SelectItem value="1y">1 Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="scopes">Scopes (comma-separated)</Label>
                  <Input
                    id="scopes"
                    value={createForm.scopes}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, scopes: e.target.value }))}
                    placeholder="read, write, admin"
                  />
                </div>
                <div>
                  <Label htmlFor="metadata">Metadata (JSON)</Label>
                  <Textarea
                    id="metadata"
                    value={createForm.metadata}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, metadata: e.target.value }))}
                    placeholder='{"purpose": "API integration"}'
                    rows={3}
                  />
                </div>
                <Button onClick={handleCreateToken} className="w-full">
                  Create Token
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tokens</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revoked Tokens</CardTitle>
              <Shield className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.revoked}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expired Tokens</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.expired}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by ID, user ID, or type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="filterType">Token Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="access">Access</SelectItem>
                  <SelectItem value="refresh">Refresh</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filterStatus">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tokens Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tokens ({filteredTokens.length})</CardTitle>
          <CardDescription>
            List of all JWT tokens with their status and details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredTokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tokens found matching your criteria
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTokens.map((token) => (
                <div key={token.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{token.id}</span>
                      {getTokenStatusBadge(token)}
                      {getTokenTypeBadge(token.token_type)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {token.user_id && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          User: {token.user_id}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created: {format(new Date(token.issued_at), 'MMM dd, yyyy HH:mm')} | 
                      Expires: {format(new Date(token.expires_at), 'MMM dd, yyyy HH:mm')}
                      {token.last_used_at && (
                        <span> | Last used: {format(new Date(token.last_used_at), 'MMM dd, yyyy HH:mm')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedToken(token);
                        setShowDetailsDialog(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {!token.is_revoked && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRevokeToken(token.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Token Details</DialogTitle>
          </DialogHeader>
          {selectedToken && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Token ID</Label>
                  <div className="font-mono text-sm">{selectedToken.id}</div>
                </div>
                <div>
                  <Label>Type</Label>
                  <div>{getTokenTypeBadge(selectedToken.token_type)}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div>{getTokenStatusBadge(selectedToken)}</div>
                </div>
                <div>
                  <Label>User ID</Label>
                  <div>{selectedToken.user_id || 'N/A'}</div>
                </div>
                <div>
                  <Label>Issued At</Label>
                  <div>{format(new Date(selectedToken.issued_at), 'MMM dd, yyyy HH:mm:ss')}</div>
                </div>
                <div>
                  <Label>Expires At</Label>
                  <div>{format(new Date(selectedToken.expires_at), 'MMM dd, yyyy HH:mm:ss')}</div>
                </div>
                {selectedToken.last_used_at && (
                  <div>
                    <Label>Last Used</Label>
                    <div>{format(new Date(selectedToken.last_used_at), 'MMM dd, yyyy HH:mm:ss')}</div>
                  </div>
                )}
                {selectedToken.revoked_at && (
                  <div>
                    <Label>Revoked At</Label>
                    <div>{format(new Date(selectedToken.revoked_at), 'MMM dd, yyyy HH:mm:ss')}</div>
                  </div>
                )}
              </div>
              
              {selectedToken.scopes && (
                <div>
                  <Label>Scopes</Label>
                  <div className="text-sm">{selectedToken.scopes}</div>
                </div>
              )}
              
              {selectedToken.ip_address && (
                <div>
                  <Label>IP Address</Label>
                  <div className="font-mono text-sm">{selectedToken.ip_address}</div>
                </div>
              )}
              
              {selectedToken.device_info && (
                <div>
                  <Label>Device Info</Label>
                  <pre className="text-xs bg-muted p-2 rounded">
                    {JSON.stringify(selectedToken.device_info, null, 2)}
                  </pre>
                </div>
              )}
              
              {selectedToken.metadata && (
                <div>
                  <Label>Metadata</Label>
                  <pre className="text-xs bg-muted p-2 rounded">
                    {JSON.stringify(selectedToken.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TokenManagement;
