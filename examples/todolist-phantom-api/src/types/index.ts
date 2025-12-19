export interface Todo {
  id?: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  categoryId?: string;
  tagIds?: string[];
}

export interface Tag {
  id?: string;
  name: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id?: string;
  name: string;
  color: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TodoWithRelations extends Todo {
  tags?: Tag[];
  category?: Category;
}

export interface CreateTodoData {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  categoryId?: string;
  tagIds?: string[];
}

export interface UpdateTodoData {
  title?: string;
  description?: string;
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  categoryId?: string;
  tagIds?: string[];
}

export interface CreateTagData {
  name: string;
  color: string;
}

export interface CreateCategoryData {
  name: string;
  color: string;
  description?: string;
}

export type FilterType = 'all' | 'pending' | 'completed' | 'high' | 'medium' | 'low';
