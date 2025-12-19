import { createClient } from 'phantom-api-client';

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.VITE_JWT_SECRET;

const client = createClient({ 
  baseURL: API_BASE_URL,
  token: JWT_SECRET 
});

export const TodoResource = client.resource('Todo');
export const TagResource = client.resource('Tag');
export const CategoryResource = client.resource('Category');

export const handleApiError = (error: any): string => {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.message) {
    return error.message;
  }
  return 'Unknown error occurred while communicating with the API.';
};

export const formatForApi = (data: any) => {
  const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);

  return cleanData;
};