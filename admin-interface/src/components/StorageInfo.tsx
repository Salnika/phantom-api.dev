import React, { useEffect, useState } from 'react';
import { HardDrive, AlertTriangle, CheckCircle, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiService } from '@/services/api';

interface StorageData {
  isUsingVolume: boolean;
  volumeName?: string;
  dataDirectory: string;
  totalSizeBytes: number;
  totalSizeMB: number;
  maxSizeGB: number;
  usagePercentage: number;
  breakdown: {
    database: { size: number; files: number };
    schemas: { size: number; files: number };
    logs: { size: number; files: number };
    other: { size: number; files: number };
  };
}

const StorageInfo: React.FC = () => {
  const [storageData, setStorageData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStorageInfo();
  }, []);

  const fetchStorageInfo = async () => {
    try {
      setLoading(true);
      const response = await apiService.getStorageInfo();
      
      if (response.success && response.data) {
        setStorageData(response.data);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch storage information');
      }
    } catch {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 80) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getUsageBadgeVariant = (percentage: number): "default" | "secondary" | "destructive" | "outline" => {
    if (percentage >= 90) return 'destructive';
    if (percentage >= 80) return 'secondary';
    return 'default';
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Storage</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !storageData) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Storage</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {error || 'No storage data available'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { usagePercentage, totalSizeMB, maxSizeGB, isUsingVolume, volumeName, breakdown } = storageData;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Storage</CardTitle>
        <HardDrive className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Usage Overview */}
        <div>
          <div className="flex items-center justify-between">
            <span className={`text-2xl font-bold ${getUsageColor(usagePercentage)}`}>
              {usagePercentage.toFixed(1)}%
            </span>
            <Badge variant={getUsageBadgeVariant(usagePercentage)}>
              {usagePercentage >= 90 ? 'Critical' : usagePercentage >= 80 ? 'Warning' : 'Healthy'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {totalSizeMB.toFixed(1)} MB / {maxSizeGB} GB used
          </p>
        </div>

        {/* Volume Information */}
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 mb-2">
            {isUsingVolume ? (
              <>
                <CheckCircle className="h-3 w-3 text-green-600" />
                <span className="text-xs font-medium">Fly.io Volume</span>
              </>
            ) : (
              <>
                <Database className="h-3 w-3 text-blue-600" />
                <span className="text-xs font-medium">Local Storage</span>
              </>
            )}
          </div>
          {volumeName && (
            <p className="text-xs text-muted-foreground">
              Volume: {volumeName}
            </p>
          )}
        </div>

        {/* Breakdown */}
        <div className="pt-2 border-t">
          <div className="text-xs font-medium mb-2">Storage Breakdown</div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Database:</span>
              <span>{formatBytes(breakdown.database.size)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Schemas:</span>
              <span>{formatBytes(breakdown.schemas.size)} ({breakdown.schemas.files} files)</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Logs:</span>
              <span>{formatBytes(breakdown.logs.size)}</span>
            </div>
            {breakdown.other.size > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Other:</span>
                <span>{formatBytes(breakdown.other.size)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Warning */}
        {usagePercentage >= 80 && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 p-2 rounded-md bg-yellow-50 dark:bg-yellow-900/20">
              <AlertTriangle className="h-3 w-3 text-yellow-600" />
              <span className="text-xs text-yellow-800 dark:text-yellow-200">
                {usagePercentage >= 90 ? 'Storage critically low!' : 'Storage approaching capacity'}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StorageInfo;