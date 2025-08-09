import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Plus,
  Download,
  RefreshCw,
  BarChart3,
  Search,
  ChevronDown
} from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable/DataTable';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiService } from '../services/apiService';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

interface TablePageProps {
  className?: string;
}

interface TableRecord {
  id: string;
  [key: string]: any;
}

interface TableSchema {
  [key: string]: {
    type: string;
    required?: boolean;
    unique?: boolean;
    default?: any;
    options?: string[];
  };
}

export const TablePage: React.FC<TablePageProps> = ({ className }) => {
  const { tableName } = useParams<{ tableName: string }>();

  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | undefined>(tableName);
  const [data, setData] = useState<TableRecord[]>([]);
  const [schema, setSchema] = useState<TableSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [tableStats, setTableStats] = useState<any>(null);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
  });

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | undefined>();

  const [filters, setFilters] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0]);
    }
  }, [tables, selectedTable]);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable);
      loadTableSchema(selectedTable);
    }
  }, [selectedTable, pagination.current, pagination.pageSize, sortConfig, filters]);

  useEffect(() => {
    if (tableName && tableName !== selectedTable) {
      setSelectedTable(tableName);
    }
  }, [tableName]);

  const loadTables = async () => {
    try {
      const response = await apiService.getTables();
      console.log('Loaded tables:', response);
      if (response.success && Array.isArray(response.data)) {
        setTables(response.data);
      }
    } catch (error) {
      setError('Failed to load tables');
      console.error('Failed to load tables:', error);
    }
  };

  const loadTableData = async (table: string) => {
    if (!table) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiService.getTableData(
        table,
        pagination.current,
        pagination.pageSize
      );
      if (response.success) {
        setData(response.data || []);
        if (response.pagination) {
          setPagination(prev => ({
            ...prev,
            total: response.pagination!.total,
          }));
        }
      } else {
        setError(response.error || 'Failed to load table data');
        setData([]);
      }
    } catch (error) {
      setError('Failed to load table data');
      console.error('Table loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTableSchema = async (table: string) => {
    if (!table) return;
    try {
      const response = await apiService.getTableSchema(table);
      if (response.success) {
        setSchema(response.data);
      }
    } catch (error) {
      console.error('Failed to load table schema:', error);
    }
  };

  const loadTableStats = async () => {
    if (!selectedTable) return;

    try {
      const response = await apiService.getTableStats(selectedTable);
      if (response.success) {
        setTableStats(response.data);
        setShowStatsModal(true);
      }
    } catch (error) {
      console.error('Failed to load table stats:', error);
    }
  };

  const columns = useMemo((): Column[] => {
    if (!data.length || !schema) return [];

    const sampleRecord = data[0];

    return Object.keys(sampleRecord).map((key, index) => {
      const schemaField = schema[key];
      const isIdField = key === 'id' || key.endsWith('_id');

      return {
        key,
        title: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        sortable: true,
        filterable: !isIdField,
        type: schemaField?.type === 'boolean' ? 'boolean'
          : schemaField?.type === 'integer' ? 'number'
            : schemaField?.type === 'date' ? 'date'
              : schemaField?.type === 'datetime' ? 'date'
                : schemaField?.options ? 'select'
                  : 'string',
        width: isIdField ? 100 : key.length > 15 ? 200 : 150,
        minWidth: isIdField ? 80 : 120,
        frozen: index === 0,
        ...(schemaField?.options && {
          filterOptions: schemaField.options.map(opt => ({ label: opt, value: opt }))
        }),
        render: (value: any) => {
          if (value === null || value === undefined) {
            return <span className="text-muted-foreground">—</span>;
          }

          if (typeof value === 'boolean') {
            return (
              <span className={cn('badge', value ? 'badge-success' : 'badge-error')}>
                {value ? 'Yes' : 'No'}
              </span>
            );
          }

          if (schemaField?.type === 'date' || schemaField?.type === 'datetime') {
            return new Date(value).toLocaleDateString();
          }

          if (typeof value === 'object') {
            return (
              <code className="text-xs bg-muted px-1 rounded">
                {JSON.stringify(value)}
              </code>
            );
          }

          const stringValue = String(value);
          return stringValue.length > 50
            ? `${stringValue.substring(0, 50)}...`
            : stringValue;
        },
      };
    });
  }, [data, schema]);

  const handleSort = useCallback((key: string, direction: 'asc' | 'desc') => {
    setSortConfig({ key, direction });
  }, []);

  const handleFilter = useCallback((newFilters: Record<string, any>) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, current: 1 }));
  }, []);

  const handlePageChange = useCallback((page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }));
  }, []);

  const handleEdit = useCallback((record: TableRecord) => {
    console.log('Edit record:', record);
  }, []);

  const handleDelete = useCallback(async (record: TableRecord) => {
    if (!selectedTable) return;

    if (!confirm(`Are you sure you want to delete this record?`)) {
      return;
    }

    try {
      const response = await apiService.deleteRecord(selectedTable, record.id);
      if (response.success) {
        await loadTableData(selectedTable);
        setSelectedRows(prev => prev.filter(id => id !== record.id));
      } else {
        setError(response.error || 'Failed to delete record');
      }
    } catch (error) {
      logger.error('Failed to delete record:', error);
      setError('Failed to delete record');
    }
  }, [selectedTable, loadTableData]);

  const handleBulkDelete = useCallback(async (records: TableRecord[]) => {
    if (!selectedTable) return;

    if (!confirm(`Are you sure you want to delete ${records.length} record(s)?`)) {
      return;
    }

    try {
      const ids = records.map(record => record.id);
      const response = await apiService.bulkDelete(selectedTable, ids);
      if (response.success) {
        await loadTableData(selectedTable);
        setSelectedRows([]);
      } else {
        setError(response.error || 'Failed to delete records');
      }
    } catch (error) {
      logger.error('Failed to delete records:', error);
      setError('Failed to delete records');
    }
  }, [selectedTable, loadTableData]);

  const handleRowSelect = useCallback((selectedKeys: string[]) => {
    setSelectedRows(selectedKeys);
  }, []);

  const handleExport = useCallback(async (format: 'csv' | 'json' | 'xlsx' = 'csv') => {
    if (!selectedTable) return;

    try {
      const response = await apiService.exportTable(selectedTable, format, {
        ...(sortConfig && {
          sortBy: sortConfig.key,
          sortOrder: sortConfig.direction,
        }),
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });

      if (response.success && response.data) {
        const blob = response.data;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedTable}_export.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setError(response.error || 'Failed to export data');
      }
    } catch (error) {
      logger.error('Failed to export data:', error);
      setError('Failed to export data');
    }
  }, [selectedTable, sortConfig, filters]);

  const handleRefresh = useCallback(() => {
    if (selectedTable) {
      loadTableData(selectedTable);
    }
  }, [loadTableData, selectedTable]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPagination(prev => ({ ...prev, current: 1 }));
  }, []);

  if (!selectedTable) {
    return (
      <div className="container-responsive section-spacing animate-fadeIn">
        <h2 className="text-2xl font-bold text-foreground">Table Manager</h2>

        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Available Tables</CardTitle>
          </CardHeader>
          <CardContent className="content-spacing">
            {tables.length === 0 ? (
              <p className="text-muted-foreground">No tables available</p>
            ) : (
              <div className="grid-responsive">
                {tables.map(table => (
                  <Link
                    key={table}
                    to={`/tables/${table}`}
                    className="block p-4 border  rounded-md hover:bg-accent transition-colors"
                  >
                    <h3 className="font-medium">{table}</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage {table.toLowerCase()} records
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('container-responsive section-spacing animate-fadeIn', className)}>
      <div className="responsive-flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {selectedTable} Records
          </h2>
          <p className="text-muted-foreground">
            {pagination.total} total records
          </p>
        </div>

        <div className="responsive-flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="form-input pl-10"
            />
          </div>

          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            className="icon-button"
          >
            <RefreshCw size={16} />
          </Button>

          <div className="relative">
            <Button variant="outline" size="sm" className="gap-2">
              <Download size={16} />
              Export
              <ChevronDown size={14} />
            </Button>
            <div className="absolute right-0 top-full mt-1 bg-popover border  rounded-md shadow-lg z-50 hidden group-hover:block">
              <button
                onClick={() => handleExport('csv')}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-accent"
              >
                Export as CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-accent"
              >
                Export as JSON
              </button>
              <button
                onClick={() => handleExport('xlsx')}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-accent"
              >
                Export as Excel
              </button>
            </div>
          </div>

          <Button
            onClick={loadTableStats}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <BarChart3 size={16} />
            Stats
          </Button>

          <Button
            onClick={() => console.log('Create record')}
            className="btn-primary gap-2"
          >
            <Plus size={16} />
            Add Record
          </Button>
        </div>
      </div>

      {tables.length > 0 && (
        <Card className="card-hover" style={{ marginBottom: '2rem' }}>
          <CardHeader>
            <CardTitle className="text-lg">Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="responsive-flex gap-2">
              {tables.map(table => (
                <Link
                  key={table}
                  to={`/tables/${table}`}
                  className={cn(
                    'btn',
                    table === selectedTable ? 'btn-primary' : 'btn-outline'
                  )}
                  onClick={() => setSelectedTable(table)}
                >
                  {table}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <Card className="card-hover">
        <CardContent className="p-0">
          <div className="table-wrapper">
            <DataTable
              columns={columns}
              data={data}
              loading={loading}
              error={error}
              pagination={pagination}
              sortConfig={sortConfig}
              filters={filters}
              selectedRows={selectedRows}
              selectable={true}
              stickyHeader={true}
              stickyFirstColumn={true}
              onSort={handleSort}
              onFilter={handleFilter}
              onPageChange={handlePageChange}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onBulkDelete={handleBulkDelete}
              onRowSelect={handleRowSelect}
              emptyText={`No ${selectedTable.toLowerCase()} records found`}
              size="middle"
            />
          </div>
        </CardContent>
      </Card>

      {showStatsModal && tableStats && (
        <div className="modal-overlay" onClick={() => setShowStatsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Table Statistics</h3>
              <button
                onClick={() => setShowStatsModal(false)}
                className="icon-button"
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="content-spacing">
                <div className="responsive-grid">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {tableStats.totalRecords}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Records
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">
                      {Object.keys(tableStats.columnStats || {}).length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Columns
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">
                      {new Date(tableStats.lastUpdated).toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Last Updated
                    </div>
                  </div>
                </div>

                {tableStats.columnStats && (
                  <div>
                    <h4 className="font-medium mb-2">Column Statistics</h4>
                    <div className="space-y-2">
                      {Object.entries(tableStats.columnStats).map(([column, stats]: [string, any]) => (
                        <div key={column} className="flex justify-between items-center p-2 bg-muted rounded">
                          <span className="font-medium">{column}</span>
                          <div className="text-sm text-muted-foreground">
                            {stats.type} • {stats.uniqueCount} unique • {stats.nullCount} null
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};