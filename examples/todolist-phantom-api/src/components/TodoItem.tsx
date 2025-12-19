import React from 'react';
import { Check, Trash2, Calendar, AlertCircle, Circle } from 'lucide-react';
import { TodoWithRelations } from '../types';

interface TodoItemProps {
  todo: TodoWithRelations;
  onToggle: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export const TodoItem: React.FC<TodoItemProps> = ({ 
  todo, 
  onToggle, 
  onDelete, 
  isLoading = false 
}) => {
  const handleToggle = async () => {
    if (isLoading) return;
    await onToggle(todo.id!);
  };

  const handleDelete = async () => {
    if (isLoading) return;
    if (window.confirm('Are you sure you want to delete this task?')) {
      await onDelete(todo.id!);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertCircle className="w-4 h-4" />;
      case 'medium': return <Circle className="w-4 h-4" />;
      case 'low': return <Circle className="w-4 h-4" />;
      default: return <Circle className="w-4 h-4" />;
    }
  };

  const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date() && !todo.completed;

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow ${
      todo.completed ? 'opacity-75' : ''
    } ${isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
      <div className="flex items-start space-x-3">
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            todo.completed 
              ? 'bg-green-500 border-green-500 text-white' 
              : 'border-gray-300 hover:border-green-500'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {todo.completed && <Check className="w-3 h-3" />}
        </button>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={`font-medium ${
              todo.completed ? 'line-through text-gray-500' : 'text-gray-900'
            }`}>
              {todo.title}
            </h3>
            
            {/* Priority */}
            <div className={`flex items-center space-x-1 ${getPriorityColor(todo.priority)}`}>
              {getPriorityIcon(todo.priority)}
              <span className="text-xs font-medium capitalize">{todo.priority}</span>
            </div>
          </div>

          {/* Description */}
          {todo.description && (
            <p className={`mt-1 text-sm ${
              todo.completed ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {todo.description}
            </p>
          )}

          {/* Metadata */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* Due date */}
            {todo.dueDate && (
              <div className={`flex items-center text-xs ${
                isOverdue ? 'text-red-600' : 'text-gray-500'
              }`}>
                <Calendar className="w-3 h-3 mr-1" />
                <span>
                  {new Date(todo.dueDate).toLocaleDateString('en-US')}
                </span>
                {isOverdue && (
                  <span className="ml-1 text-red-600 font-medium">
                    (Overdue)
                  </span>
                )}
              </div>
            )}

            {/* Category */}
            {todo.category && (
              <span
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: todo.category.color }}
              >
                {todo.category.name}
              </span>
            )}

            {/* Tags */}
            {todo.tags && todo.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {todo.tags.map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Creation date */}
          {todo.createdAt && (
            <div className="mt-2 text-xs text-gray-400">
              Created on {new Date(todo.createdAt).toLocaleDateString('en-US')} at {
                new Date(todo.createdAt).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })
              }
            </div>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={isLoading}
          className={`flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors ${
            isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          title="Delete task"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};