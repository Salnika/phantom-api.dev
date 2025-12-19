import { useState, useEffect, useCallback } from 'react';
import { TodoWithRelations, CreateTodoData, UpdateTodoData, FilterType, Tag, Category } from '../types';
import { TodoService } from '../services/todoService';
import { TagService, CategoryService } from '../services/tagService';

export const useTodos = () => {
  const [todos, setTodos] = useState<TodoWithRelations[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [todosData, tagsData, categoriesData] = await Promise.all([
        TodoService.getAllTodos(),
        TagService.getAllTags(),
        CategoryService.getAllCategories()
      ]);

      setTodos(todosData);
      setTags(tagsData);
      setCategories(categoriesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create a new task
  const createTodo = useCallback(async (data: CreateTodoData) => {
    try {
      setError(null);
      const newTodo = await TodoService.createTodo(data);
      
      // Reload data to get relations
      await loadData();
      
      return newTodo;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error during creation';
      setError(errorMessage);
      throw err;
    }
  }, [loadData]);

  // Update a task
  const updateTodo = useCallback(async (id: string, data: UpdateTodoData) => {
    try {
      setError(null);
      const updatedTodo = await TodoService.updateTodo(id, data);
      
      // Reload data to get relations
      await loadData();
      
      return updatedTodo;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error during update';
      setError(errorMessage);
      throw err;
    }
  }, [loadData]);

  // Toggle task status
  const toggleTodo = useCallback(async (id: string) => {
    try {
      setError(null);
      await TodoService.toggleTodoStatus(id);
      await loadData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error during toggle';
      setError(errorMessage);
      throw err;
    }
  }, [loadData]);

  // Delete a task
  const deleteTodo = useCallback(async (id: string) => {
    try {
      setError(null);
      await TodoService.deleteTodo(id);
      setTodos(prevTodos => prevTodos.filter(todo => todo.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error during deletion';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Filter tasks
  const filteredTodos = useCallback(() => {
    let filtered = todos;

    // Filter by status/priority
    switch (filter) {
      case 'pending':
        filtered = filtered.filter(todo => !todo.completed);
        break;
      case 'completed':
        filtered = filtered.filter(todo => todo.completed);
        break;
      case 'high':
        filtered = filtered.filter(todo => todo.priority === 'high');
        break;
      case 'medium':
        filtered = filtered.filter(todo => todo.priority === 'medium');
        break;
      case 'low':
        filtered = filtered.filter(todo => todo.priority === 'low');
        break;
      default:
        break;
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(todo => 
        todo.title.toLowerCase().includes(query) ||
        (todo.description && todo.description.toLowerCase().includes(query)) ||
        (todo.tags && todo.tags.some(tag => tag.name.toLowerCase().includes(query)))
      );
    }

    // Filter by category
    if (selectedCategoryId) {
      filtered = filtered.filter(todo => todo.categoryId === selectedCategoryId);
    }

    // Filter by tags
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter(todo => 
        todo.tagIds && todo.tagIds.some(tagId => selectedTagIds.includes(tagId))
      );
    }

    return filtered;
  }, [todos, filter, searchQuery, selectedCategoryId, selectedTagIds]);

  // Calculate counters for filters
  const todoCounts = useCallback(() => {
    const all = todos.length;
    const pending = todos.filter(todo => !todo.completed).length;
    const completed = todos.filter(todo => todo.completed).length;
    const high = todos.filter(todo => todo.priority === 'high').length;
    const medium = todos.filter(todo => todo.priority === 'medium').length;
    const low = todos.filter(todo => todo.priority === 'low').length;

    return { all, pending, completed, high, medium, low };
  }, [todos]);

  // Reset error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Data
    todos: filteredTodos(),
    allTodos: todos,
    tags,
    categories,
    
    // State
    loading,
    error,
    
    // Filters
    filter,
    searchQuery,
    selectedCategoryId,
    selectedTagIds,
    todoCounts: todoCounts(),
    
    // Actions
    createTodo,
    updateTodo,
    toggleTodo,
    deleteTodo,
    loadData,
    clearError,
    
    // Filters
    setFilter,
    setSearchQuery,
    setSelectedCategoryId,
    setSelectedTagIds
  };
};