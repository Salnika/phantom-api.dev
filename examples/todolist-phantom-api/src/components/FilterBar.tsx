import React from 'react';
import { Search, Filter, Tag as TagIcon, Folder, CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { FilterType, Tag, Category } from '../types';

interface FilterBarProps {
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategoryId?: string;
  onCategoryChange: (categoryId: string) => void;
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  tags: Tag[];
  categories: Category[];
  todoCounts: {
    all: number;
    pending: number;
    completed: number;
    high: number;
    medium: number;
    low: number;
  };
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  selectedCategoryId,
  onCategoryChange,
  selectedTagIds,
  onTagsChange,
  tags,
  categories,
  todoCounts
}) => {
  const filters = [
    { 
      key: 'all' as FilterType, 
      label: 'All', 
      count: todoCounts.all,
      icon: <Filter className="w-4 h-4" />
    },
    { 
      key: 'pending' as FilterType, 
      label: 'In Progress', 
      count: todoCounts.pending,
      icon: <Circle className="w-4 h-4" />
    },
    { 
      key: 'completed' as FilterType, 
      label: 'Completed', 
      count: todoCounts.completed,
      icon: <CheckCircle className="w-4 h-4" />
    },
    { 
      key: 'high' as FilterType, 
      label: 'High Priority', 
      count: todoCounts.high,
      icon: <AlertCircle className="w-4 h-4" />
    },
    { 
      key: 'medium' as FilterType, 
      label: 'Medium Priority', 
      count: todoCounts.medium,
      icon: <Circle className="w-4 h-4" />
    },
    { 
      key: 'low' as FilterType, 
      label: 'Low Priority', 
      count: todoCounts.low,
      icon: <Circle className="w-4 h-4" />
    }
  ];

  const handleTagToggle = (tagId: string) => {
    const newTagIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId];
    onTagsChange(newTagIds);
  };

  const clearFilters = () => {
    onFilterChange('all');
    onSearchChange('');
    onCategoryChange('');
    onTagsChange([]);
  };

  const hasActiveFilters = filter !== 'all' || searchQuery || selectedCategoryId || selectedTagIds.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      {/* Search bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Status and priority filters */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Filters</h4>
        <div className="flex flex-wrap gap-2">
          {filters.map(({ key, label, count, icon }) => (
            <button
              key={key}
              onClick={() => onFilterChange(key)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {icon}
              <span>{label}</span>
              <span className={`text-xs px-2 py-1 rounded-full ${
                filter === key
                  ? 'bg-blue-400 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
            <Folder className="w-4 h-4 mr-1" />
            Category
          </h4>
          <select
            value={selectedCategoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All categories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tag filter */}
      {tags.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
            <TagIcon className="w-4 h-4 mr-1" />
            Tags
          </h4>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => handleTagToggle(tag.id!)}
                className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedTagIds.includes(tag.id!)
                    ? 'text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                style={{
                  backgroundColor: selectedTagIds.includes(tag.id!) 
                    ? tag.color 
                    : 'transparent',
                  border: `1px solid ${tag.color}`
                }}
              >
                {tag.name}
                {selectedTagIds.includes(tag.id!) && (
                  <span className="ml-1">×</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reset filters button */}
      {hasActiveFilters && (
        <div className="flex justify-between items-center pt-3 border-t border-gray-200">
          <span className="text-sm text-gray-600">
            {hasActiveFilters ? 'Active filters' : 'No active filters'}
          </span>
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
};