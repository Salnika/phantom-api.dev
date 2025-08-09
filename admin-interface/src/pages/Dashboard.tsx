import React from 'react';
import { Link } from 'react-router-dom';
import { Table, Shield, Key, ExternalLink, Database, Infinity as InfinityIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApiService } from '@/hooks/useApiService';
import StorageInfo from '@/components/StorageInfo';

const Dashboard: React.FC = () => {
  const { tables, loading, error } = useApiService();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="section-spacing animate-fadeIn">
      {/* Stats Cards */}
      <div className="responsive-grid">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tables</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tables.length}</div>
            <p className="text-xs text-muted-foreground">
              Database tables configured
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Validation Schemas</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tables.length}</div>
            <p className="text-xs text-muted-foreground">
              Auto-generated schemas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dynamic Endpoints</CardTitle>
            <InfinityIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">∞</div>
            <p className="text-xs text-muted-foreground">
              API endpoints available
            </p>
          </CardContent>
        </Card>

        <StorageInfo />
      </div>

      {/* Welcome Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Welcome to Phantom API Admin</CardTitle>
              <CardDescription>
                Select a table from the sidebar to view and manage your data, or generate API tokens to start using the API.
              </CardDescription>
            </div>
            <Button asChild>
              <Link to="/tokens">
                <Key className="mr-2 h-4 w-4" />
                Generate API Token
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="content-spacing">
          {error && (
            <div className="alert alert-error text-sm">
              {error}
            </div>
          )}

          <div className="responsive-flex">
            <Button variant="outline" asChild>
              <Link to="/tokens">
                <Key className="mr-2 h-4 w-4" />
                API Tokens
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a
                href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                API Documentation
              </a>
            </Button>
          </div>

          {tables.length > 0 && (
            <div className="content-spacing">
              <div className="responsive-flex items-center justify-between">
                <h3 className="text-lg font-medium">Available Tables</h3>
                <Badge variant="secondary">{tables.length} tables</Badge>
              </div>
              <div className="grid-responsive">
                {tables.map((table) => (
                  <Button
                    key={table}
                    variant="outline"
                    className="h-auto p-4 justify-start"
                    asChild
                  >
                    <Link to={`/tables/${table}`}>
                      <Table className="mr-2 h-4 w-4" />
                      {table}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;