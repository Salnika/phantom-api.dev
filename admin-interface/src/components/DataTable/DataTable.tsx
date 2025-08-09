import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown, Edit, Trash2, Search, Filter, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import './DataTable.css';

export interface Column {
  key: string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  type?: 'string' | 'number' | 'date' | 'boolean' | 'select';
  width?: number;
  minWidth?: number;
  frozen?: boolean;
  render?: (value: any, record: any, index: number) => React.ReactNode;
  filterOptions?: Array<{ label: string; value: any }>;
}

export interface DataTableProps {
  columns: Column[];
  data: any[];
  loading?: boolean;
  error?: string;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    showSizeChanger?: boolean;
    showQuickJumper?: boolean;
  };
  sortConfig?: {
    key: string;
    direction: 'asc' | 'desc';
  };
  filters?: Record<string, any>;
  selectedRows?: string[];
  rowKey?: string;
  selectable?: boolean;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  onFilter?: (filters: Record<string, any>) => void;
  onPageChange?: (page: number, pageSize: number) => void;
  onEdit?: (record: any, index: number) => void;
  onDelete?: (record: any, index: number) => void;
  onBulkDelete?: (records: any[]) => void;
  onRowSelect?: (selectedKeys: string[]) => void;
  className?: string;
  height?: number;
  virtualScroll?: boolean;
  stickyHeader?: boolean;
  stickyFirstColumn?: boolean;
  showActions?: boolean;
  actionWidth?: number;
  emptyText?: string;
  size?: 'small' | 'middle' | 'large';
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  loading = false,
  error,
  pagination,
  sortConfig,
  filters = {},
  selectedRows = [],
  rowKey = 'id',
  selectable = false,
  onSort,
  onFilter,
  onPageChange,
  onEdit,
  onDelete,
  onBulkDelete,
  onRowSelect,
  className,
  height,
  stickyHeader = true,
  stickyFirstColumn = false,
  showActions = true,
  actionWidth = 120,
  emptyText = 'No data available',
  size = 'middle'
}) => {
  const [localFilters, setLocalFilters] = useState<Record<string, any>>(filters);
  const [showFilters, setShowFilters] = useState(false);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<any>({});
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(0);

  useEffect(() => {
    const updateTableWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.offsetWidth);
      }
    };

    updateTableWidth();
    window.addEventListener('resize', updateTableWidth);
    return () => window.removeEventListener('resize', updateTableWidth);
  }, []);

  const totalColumnWidth = useMemo(() => {
    return columns.reduce((total, col) => total + (col.width || 150), 0) + 
           (selectable ? 40 : 0) + 
           (showActions ? actionWidth : 0);
  }, [columns, selectable, showActions, actionWidth]);

  const needsHorizontalScroll = totalColumnWidth > tableWidth;

  const processedData = useMemo(() => {
    let result = [...data];

    Object.entries(localFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        const column = columns.find(col => col.key === key);
        if (column) {
          result = result.filter(item => {
            const itemValue = item[key];
            switch (column.type) {
              case 'string':
                return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
              case 'number':
                return Number(itemValue) === Number(value);
              case 'boolean':
                return Boolean(itemValue) === Boolean(value);
              case 'date':
                return new Date(itemValue).toDateString() === new Date(value).toDateString();
              case 'select':
                return itemValue === value;
              default:
                return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
            }
          });
        }
      }
    });

    return result;
  }, [data, localFilters, columns]);

  const handleSort = useCallback((key: string) => {
    if (!onSort) return;
    
    const newDirection = sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    onSort(key, newDirection);
  }, [onSort, sortConfig]);

  const handleFilterChange = useCallback((key: string, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFilter?.(newFilters);
  }, [localFilters, onFilter]);

  const handleSelectAll = useCallback(() => {
    if (!onRowSelect) return;
    
    const allSelected = selectedRows.length === processedData.length;
    const newSelectedRows = allSelected ? [] : processedData.map(item => item[rowKey]);
    onRowSelect(newSelectedRows);
  }, [selectedRows, processedData, rowKey, onRowSelect]);

  const handleRowSelect = useCallback((key: string, checked: boolean) => {
    if (!onRowSelect) return;
    
    const newSelectedRows = checked 
      ? [...selectedRows, key]
      : selectedRows.filter(id => id !== key);
    onRowSelect(newSelectedRows);
  }, [selectedRows, onRowSelect]);

  const handleEdit = useCallback((record: any, index: number) => {
    if (onEdit) {
      onEdit(record, index);
    } else {
      setEditingRow(record[rowKey]);
      setEditingData({ ...record });
    }
  }, [onEdit, rowKey]);

  const handleSaveEdit = useCallback(() => {
    setEditingRow(null);
    setEditingData({});
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingRow(null);
    setEditingData({});
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (!onBulkDelete || selectedRows.length === 0) return;
    
    const recordsToDelete = processedData.filter(item => selectedRows.includes(item[rowKey]));
    onBulkDelete(recordsToDelete);
  }, [onBulkDelete, selectedRows, processedData, rowKey]);

  const renderFilterInput = (column: Column) => {
    const value = localFilters[column.key] || '';
    
    switch (column.type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleFilterChange(column.key, e.target.value)}
            className="data-table__filter-input"
          >
            <option value="">All</option>
            {column.filterOptions?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case 'boolean':
        return (
          <select
            value={value}
            onChange={(e) => handleFilterChange(column.key, e.target.value)}
            className="data-table__filter-input"
          >
            <option value="">All</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleFilterChange(column.key, e.target.value)}
            className="data-table__filter-input"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFilterChange(column.key, e.target.value)}
            placeholder="Filter..."
            className="data-table__filter-input"
          />
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFilterChange(column.key, e.target.value)}
            placeholder="Filter..."
            className="data-table__filter-input"
          />
        );
    }
  };

  const renderCell = (column: Column, record: any, index: number) => {
    const value = record[column.key];
    const isEditing = editingRow === record[rowKey];

    if (isEditing && column.key !== rowKey) {
      return (
        <input
          type="text"
          value={editingData[column.key] || ''}
          onChange={(e) => setEditingData((prev: any) => ({ ...prev, [column.key]: e.target.value }))}
          className="data-table__edit-input"
        />
      );
    }

    if (column.render) {
      return column.render(value, record, index);
    }

    if (typeof value === 'boolean') {
      return <span className={`data-table__boolean ${value ? 'true' : 'false'}`}>{value ? 'Yes' : 'No'}</span>;
    }

    if (value instanceof Date) {
      return value.toLocaleDateString();
    }

    if (typeof value === 'object' && value !== null) {
      return <span className="data-table__json">{JSON.stringify(value)}</span>;
    }

    const stringValue = String(value || '');
    return (
      <span className="data-table__cell-content" title={stringValue}>
        {stringValue}
      </span>
    );
  };

  if (error) {
    return (
      <div className="data-table__error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={cn('data-table', `data-table--${size}`, className)}>
      {(selectable && selectedRows.length > 0) && (
        <div className="data-table__bulk-actions">
          <span className="data-table__selection-info">
            {selectedRows.length} item{selectedRows.length !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="data-table__bulk-action-btn data-table__bulk-action-btn--danger"
          >
            <Trash2 size={14} />
            Delete Selected
          </button>
        </div>
      )}

      <div className="data-table__toolbar">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn('data-table__filter-toggle', { active: showFilters })}
        >
          <Filter size={14} />
          Filters
        </button>
      </div>

      <div
        ref={tableRef}
        className={cn('data-table__container table-scroll-container', {
          'data-table__container--scrollable': needsHorizontalScroll,
          'data-table__container--loading': loading,
          'data-table__container--fixed-layout': true
        })}
        style={{ height }}
      >
        {loading && (
          <div className="data-table__loading-overlay">
            <div className="data-table__spinner" />
            <span>Loading...</span>
          </div>
        )}

        <table className={cn('data-table__table', {
          'data-table__table--fixed': needsHorizontalScroll
        })}>
          <thead className={cn('data-table__header', { 'data-table__header--sticky': stickyHeader })}>
            <tr>
              {selectable && (
                <th
                  className={cn('data-table__th data-table__th--selection', {
                    'data-table__th--frozen': stickyFirstColumn
                  })}
                  style={{ width: 40 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedRows.length === processedData.length && processedData.length > 0}
                    onChange={handleSelectAll}
                    className="data-table__checkbox"
                  />
                </th>
              )}
              
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  className={cn('data-table__th', {
                    'data-table__th--sortable': column.sortable,
                    'data-table__th--sorted': sortConfig?.key === column.key,
                    'data-table__th--frozen': column.frozen || (stickyFirstColumn && index === 0)
                  })}
                  style={{
                    width: column.width,
                    minWidth: column.minWidth || column.width,
                    left: column.frozen || (stickyFirstColumn && index === 0) 
                      ? (selectable ? 40 : 0) + (index > 0 ? columns.slice(0, index).reduce((acc, col) => acc + (col.width || 150), 0) : 0)
                      : undefined
                  }}
                  onClick={column.sortable ? () => handleSort(column.key) : undefined}
                >
                  <div className="data-table__th-content">
                    <span>{column.title}</span>
                    {column.sortable && (
                      <div className="data-table__sort-indicators">
                        <ChevronUp 
                          size={12} 
                          className={cn('data-table__sort-icon', {
                            active: sortConfig?.key === column.key && sortConfig.direction === 'asc'
                          })} 
                        />
                        <ChevronDown 
                          size={12} 
                          className={cn('data-table__sort-icon', {
                            active: sortConfig?.key === column.key && sortConfig.direction === 'desc'
                          })} 
                        />
                      </div>
                    )}
                  </div>
                </th>
              ))}
              
              {showActions && (
                <th
                  className="data-table__th data-table__th--actions"
                  style={{ width: actionWidth }}
                >
                  Actions
                </th>
              )}
            </tr>

            {showFilters && (
              <tr className="data-table__filter-row">
                {selectable && <th className="data-table__th data-table__th--selection" />}
                
                {columns.map((column, index) => (
                  <th
                    key={`filter-${column.key}`}
                    className={cn('data-table__th data-table__th--filter', {
                      'data-table__th--frozen': column.frozen || (stickyFirstColumn && index === 0)
                    })}
                    style={{
                      left: column.frozen || (stickyFirstColumn && index === 0)
                        ? (selectable ? 40 : 0) + (index > 0 ? columns.slice(0, index).reduce((acc, col) => acc + (col.width || 150), 0) : 0)
                        : undefined
                    }}
                  >
                    {column.filterable && renderFilterInput(column)}
                  </th>
                ))}
                
                {showActions && <th className="data-table__th data-table__th--actions" />}
              </tr>
            )}
          </thead>

          <tbody className="data-table__body">
            {processedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (showActions ? 1 : 0)}
                  className="data-table__empty"
                >
                  <div className="data-table__empty-content">
                    <Search size={24} />
                    <p>{emptyText}</p>
                  </div>
                </td>
              </tr>
            ) : (
              processedData.map((record, index) => {
                const key = record[rowKey];
                const isSelected = selectedRows.includes(key);
                const isEditing = editingRow === key;

                return (
                  <tr
                    key={key}
                    className={cn('data-table__row', {
                      'data-table__row--selected': isSelected,
                      'data-table__row--editing': isEditing,
                      'data-table__row--odd': index % 2 === 1
                    })}
                  >
                    {selectable && (
                      <td
                        className={cn('data-table__td data-table__td--selection', {
                          'data-table__td--frozen': stickyFirstColumn
                        })}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleRowSelect(key, e.target.checked)}
                          className="data-table__checkbox"
                        />
                      </td>
                    )}

                    {columns.map((column, colIndex) => (
                      <td
                        key={column.key}
                        className={cn('data-table__td', {
                          'data-table__td--frozen': column.frozen || (stickyFirstColumn && colIndex === 0)
                        })}
                        style={{
                          left: column.frozen || (stickyFirstColumn && colIndex === 0)
                            ? (selectable ? 40 : 0) + (colIndex > 0 ? columns.slice(0, colIndex).reduce((acc, col) => acc + (col.width || 150), 0) : 0)
                            : undefined
                        }}
                      >
                        {renderCell(column, record, index)}
                      </td>
                    ))}

                    {showActions && (
                      <td className="data-table__td data-table__td--actions">
                        <div className="data-table__actions">
                          {isEditing ? (
                            <>
                              <button
                                onClick={handleSaveEdit}
                                className="data-table__action-btn data-table__action-btn--success"
                                title="Save"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="data-table__action-btn data-table__action-btn--danger"
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(record, index)}
                                className="data-table__action-btn data-table__action-btn--primary"
                                title="Edit"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => onDelete?.(record, index)}
                                className="data-table__action-btn data-table__action-btn--danger"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="data-table__pagination">
          <div className="data-table__pagination-info">
            Showing {Math.min((pagination.current - 1) * pagination.pageSize + 1, pagination.total)} to{' '}
            {Math.min(pagination.current * pagination.pageSize, pagination.total)} of {pagination.total} entries
          </div>
          
          <div className="data-table__pagination-controls">
            <button
              onClick={() => onPageChange?.(pagination.current - 1, pagination.pageSize)}
              disabled={pagination.current <= 1}
              className="data-table__pagination-btn"
            >
              Previous
            </button>
            
            {Array.from({ length: Math.ceil(pagination.total / pagination.pageSize) }, (_, i) => i + 1)
              .slice(
                Math.max(0, pagination.current - 3),
                Math.min(Math.ceil(pagination.total / pagination.pageSize), pagination.current + 2)
              )
              .map(page => (
                <button
                  key={page}
                  onClick={() => onPageChange?.(page, pagination.pageSize)}
                  className={cn('data-table__pagination-btn', {
                    'data-table__pagination-btn--active': page === pagination.current
                  })}
                >
                  {page}
                </button>
              ))}
            
            <button
              onClick={() => onPageChange?.(pagination.current + 1, pagination.pageSize)}
              disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
              className="data-table__pagination-btn"
            >
              Next
            </button>
          </div>
          
          {pagination.showSizeChanger && (
            <div className="data-table__page-size">
              <select
                value={pagination.pageSize}
                onChange={(e) => onPageChange?.(1, Number(e.target.value))}
                className="data-table__page-size-select"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};