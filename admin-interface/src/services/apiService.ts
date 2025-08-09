import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

// Cache for CSRF token
let csrfTokenCache: string | null = null;

// Function to get CSRF token
const getCSRFToken = async (): Promise<string | null> => {
  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/csrf-token`, {
      withCredentials: true
    });

    if (response.data?.csrfToken) {
      csrfTokenCache = response.data.csrfToken;
      return csrfTokenCache;
    }
  } catch (error) {
    console.warn('Could not fetch CSRF token:', error);
  }

  return null;
};

// Interceptor to add CSRF token to requests
api.interceptors.request.use(async (config) => {
  // Skip CSRF token for the csrf-token endpoint itself
  if (config.url?.includes('/csrf-token')) {
    return config;
  }

  // Only add CSRF token for non-GET requests
  if (config.method && ['post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())) {
    const token = await getCSRFToken();
    if (token) {
      config.headers['CSRF-Token'] = token;
    }
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

export const apiService = {
  // Tables
  async getTables() {
    const response = await api.get('/admin/api/tables');
    return response.data.data || [];
  },

  async getTableData(tableName: string, page = 1, limit = 10) {
    const response = await api.get(`/admin/api/tables/${tableName}/data`, {
      params: { page, limit }
    });
    return response.data;
  },

  async createRecord(tableName: string, data: any) {
    const response = await api.post(`/admin/api/tables/${tableName}/records`, data);
    return response.data;
  },

  async updateRecord(tableName: string, id: string, data: any) {
    const response = await api.put(`/admin/api/tables/${tableName}/records/${id}`, data);
    return response.data;
  },

  async deleteRecord(tableName: string, id: string) {
    const response = await api.delete(`/admin/api/tables/${tableName}/records/${id}`);
    return response.data;
  },

  getTableSchema(tableName: string): Promise<any> {
    // Implement the API call to fetch the schema for a table
    return fetch(`${API_BASE_URL}/admin/api/tables/${tableName}/schema`, {
      credentials: 'include'
    })
      .then(res => res.json())
      .catch(error => ({ success: false, error: error.message }));
  },

  async getTableStats(tableName: string) {
    const response = await api.get(`/admin/api/tables/${tableName}/stats`);
    return response.data;
  },

  // Tokens
  async generateToken(tokenData: {
    role: string;
    expiresIn: string;
    resourceAccess?: string;
    specificResource?: string;
  }) {
    const response = await api.post('/admin/api/generate-token', tokenData);
    return response.data;
  },

  async bulkDelete(tableName: string, ids: string[]) {
    try {
      const response = await api.request({
        url: `/admin/api/tables/${tableName}/records/bulk-delete`,
        method: 'post',
        data: { ids }
      });
      return response.data;
    } catch (error: any) {
      return { success: false, error: error?.response?.data?.error || error.message };
    }
  },

  async exportTable(tableName: string, format: 'csv' | 'json' | 'xlsx' = 'csv', params: any = {}) {
    try {
      const response = await api.get(`/admin/api/tables/${tableName}/export`, {
        params: { ...params, format },
        responseType: 'blob'
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, error: error?.response?.data?.error || error.message };
    }
  }
};