import { TagResource, CategoryResource, handleApiError, formatForApi } from './api';
import { Tag, Category, CreateTagData, CreateCategoryData } from '../types';

export class TagService {
  // Get all tags
  static async getAllTags(): Promise<Tag[]> {
    try {
      const response = await TagResource.read();
      return response || [];
    } catch (error) {
      console.error('Error retrieving tags:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Get a tag by ID
  static async getTagById(id: string): Promise<Tag | null> {
    try {
      const response = await TagResource.read({
        where: { id }
      });
      return response || null;
    } catch (error) {
      console.error('Error retrieving tag:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Create a new tag
  static async createTag(data: CreateTagData): Promise<Tag> {
    try {
      const tagData = formatForApi({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const response = await TagResource.safeCreate({
        filter: { name: data.name },
        data: tagData
      });

      if (!response) {
        throw new Error(response.error || 'Failed to create tag');
      }

      return response;
    } catch (error) {
      console.error('Error creating tag:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Update a tag
  static async updateTag(id: string, data: Partial<CreateTagData>): Promise<Tag> {
    try {
      const updateData = formatForApi({
        ...data,
        updatedAt: new Date().toISOString()
      });

      const response = await TagResource.safeUpdate({ filter: { id }, data: updateData });

      if (!response) {
        throw new Error(response.error || 'Failed to update tag');
      }

      return response;
    } catch (error) {
      console.error('Error updating tag:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Delete a tag
  static async deleteTag(id: string): Promise<void> {
    try {
      await TagResource.delete(id);
    } catch (error) {
      console.error('Erreur lors de la suppression du tag:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Find or create a tag by name
  static async findOrCreateTag(name: string, color: string = '#007bff'): Promise<Tag> {
    try {
      const existingTags = await this.getAllTags();
      const existingTag = existingTags.find(tag =>
        tag.name.toLowerCase() === name.toLowerCase()
      );

      if (existingTag) {
        return existingTag;
      }

      return await this.createTag({ name, color });
    } catch (error) {
      console.error('Erreur lors de la recherche/création du tag:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Search tags
  static async searchTags(query: string): Promise<Tag[]> {
    try {
      const response = await TagResource.read({
        where: {
          name: { contains: query, mode: 'insensitive' }
        }
      });
      return response || [];
    } catch (error) {
      console.error('Error searching tags:', error);
      throw new Error(handleApiError(error));
    }
  }
}

export class CategoryService {
  // Get all categories
  static async getAllCategories(): Promise<Category[]> {
    try {
      const response = await CategoryResource.read();
      return response || [];
    } catch (error) {
      console.error('Error retrieving categories:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Get a category by ID
  static async getCategoryById(id: string): Promise<Category | null> {
    try {
      const response = await CategoryResource.read({
        where: { id }
      });
      return response || null;
    } catch (error) {
      console.error('Error retrieving category:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Create a new category
  static async createCategory(data: CreateCategoryData): Promise<Category> {
    try {
      const categoryData = formatForApi({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const response = await CategoryResource.safeCreate({
        filter: { name: data.name },
        data: categoryData
      });

      if (!response) {
        throw new Error(response.error || 'Failed to create category');
      }

      return response;
    } catch (error) {
      console.error('Error creating category:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Update a category
  static async updateCategory(id: string, data: Partial<CreateCategoryData>): Promise<Category> {
    try {
      const updateData = formatForApi({
        ...data,
        updatedAt: new Date().toISOString()
      });

      const response = await CategoryResource.safeUpdate({ filter: { id }, data: updateData });

      if (!response) {
        throw new Error(response.error || 'Failed to update category');
      }

      return response;
    } catch (error) {
      console.error('Error updating category:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Delete a category
  static async deleteCategory(id: string): Promise<void> {
    try {
      await CategoryResource.delete(id);
    } catch (error) {
      console.error('Erreur lors de la suppression de la catégorie:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Find or create a category by name
  static async findOrCreateCategory(name: string, color: string = '#28a745'): Promise<Category> {
    try {
      const existingCategories = await this.getAllCategories();
      const existingCategory = existingCategories.find(category =>
        category.name.toLowerCase() === name.toLowerCase()
      );

      if (existingCategory) {
        return existingCategory;
      }

      return await this.createCategory({ name, color });
    } catch (error) {
      console.error('Erreur lors de la recherche/création de la catégorie:', error);
      throw new Error(handleApiError(error));
    }
  }
}