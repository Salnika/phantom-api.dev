import React from 'react';
import { TodoWithRelations } from '../types';
import { TodoItem } from './TodoItem';

interface TodoListProps {
  todos: TodoWithRelations[];
  onToggle: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export const TodoList: React.FC<TodoListProps> = ({ 
  todos, 
  onToggle, 
  onDelete, 
  isLoading = false 
}) => {
  if (todos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-lg mb-2">📝</div>
        <p className="text-gray-500">No tasks found</p>
        <p className="text-gray-400 text-sm">Create your first task above</p>
      </div>
    );
  }

  // Group todos by status for better display
  const pendingTodos = todos.filter(todo => !todo.completed);
  const completedTodos = todos.filter(todo => todo.completed);

  // Sort pending todos by priority and due date
  const sortedPendingTodos = [...pendingTodos].sort((a, b) => {
    // First by priority (high > medium > low)
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by due date (closest first)
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    // Finally by creation date (most recent first)
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });

  // Sort completed todos by update date (most recent first)
  const sortedCompletedTodos = [...completedTodos].sort((a, b) => {
    if (a.updatedAt && b.updatedAt) {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Pending tasks */}
      {sortedPendingTodos.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
            To Do ({sortedPendingTodos.length})
          </h3>
          <div className="space-y-3">
            {sortedPendingTodos.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={onToggle}
                onDelete={onDelete}
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed tasks */}
      {sortedCompletedTodos.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            Completed ({sortedCompletedTodos.length})
          </h3>
          <div className="space-y-3">
            {sortedCompletedTodos.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={onToggle}
                onDelete={onDelete}
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="bg-gray-50 rounded-lg p-4 mt-6">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>Total: {todos.length} tasks</span>
          <span>
            {pendingTodos.length} pending, {completedTodos.length} completed
          </span>
        </div>
        {todos.length > 0 && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(completedTodos.length / todos.length) * 100}%` 
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {Math.round((completedTodos.length / todos.length) * 100)}% complete
            </p>
          </div>
        )}
      </div>
    </div>
  );
};