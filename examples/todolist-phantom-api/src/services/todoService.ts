import { TodoResource, handleApiError, formatForApi } from './api';
import { Todo, TodoWithRelations, CreateTodoData, UpdateTodoData } from '../types';

export class TodoService {
  // Get all todos with relations
  static async getAllTodos(): Promise<TodoWithRelations[]> {
    try {
      const response = await TodoResource.read({});
      return response || [];
    } catch (error) {
      console.error('Error retrieving todos:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Get a todo by ID
  static async getTodoById(id: string): Promise<TodoWithRelations | null> {
    try {
      const response = await TodoResource.read({
        where: { id },
      });
      return response || null;
    } catch (error) {
      console.error('Error retrieving todo:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Create a new todo
  static async createTodo(data: CreateTodoData): Promise<Todo> {
    try {
      const todoData = formatForApi({
        ...data,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const response = await TodoResource.safeCreate({
        filter: { title: data.title },
        data: todoData
      });
      console.log('response', response);
      if (!response) {
        throw new Error(response.error || 'Failed to create todo');
      }

      return response;
    } catch (error) {
      console.error('Error creating todo:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Update a todo
  static async updateTodo(id: string, data: UpdateTodoData): Promise<Todo> {
    try {
      const updateData = formatForApi({
        ...data,
        updatedAt: new Date().toISOString()
      });

      const response = await TodoResource.safeUpdate({ filter: { id }, data: updateData });

      if (!response) {
        throw new Error(response.error || 'Failed to update todo');
      }

      return response;
    } catch (error) {
      console.error('Error updating todo:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Delete a todo
  static async deleteTodo(id: string): Promise<void> {
    try {
      await TodoResource.delete(id);
    } catch (error) {
      console.error('Erreur lors de la suppression du todo:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Toggle todo status
  static async toggleTodoStatus(id: string): Promise<Todo> {
    try {
      const currentTodo = await this.getTodoById(id);
      if (!currentTodo) {
        throw new Error('Todo non trouvé');
      }

      return await this.updateTodo(id, {
        completed: !currentTodo.completed
      });
    } catch (error) {
      console.error('Erreur lors du basculement du statut:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Get todos by category
  static async getTodosByCategory(categoryId: string): Promise<TodoWithRelations[]> {
    try {
      const response = await TodoResource.read({
        where: { categoryId },

      });
      return response || [];
    } catch (error) {
      console.error('Error retrieving todos by category:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Get todos by tag
  static async getTodosByTag(tagId: string): Promise<TodoWithRelations[]> {
    try {
      const response = await TodoResource.read({
        where: {
          tagIds: {
            contains: tagId
          }
        },

      });
      return response || [];
    } catch (error) {
      console.error('Error retrieving todos by tag:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Search todos
  static async searchTodos(query: string): Promise<TodoWithRelations[]> {
    try {
      const response = await TodoResource.read({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        }

      });
      return response || [];
    } catch (error) {
      console.error('Error searching todos:', error);
      throw new Error(handleApiError(error));
    }
  }
}