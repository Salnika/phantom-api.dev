export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface QueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
  search?: string;
}

export interface CreateRecordData {
  [key: string]: any;
}

export interface UpdateRecordData {
  id: string;
  [key: string]: any;
}

export interface JwtTokenInfo {
  id: string;
  token_hash: string;
  user_id?: string;
  token_type: 'access' | 'refresh' | 'api' | 'reset_password';
  is_revoked: boolean;
  expires_at: string;
  issued_at: string;
  revoked_at?: string;
  last_used_at?: string;
  device_info?: any;
  ip_address?: string;
  user_agent?: string;
  scopes?: string;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
}

export class ApiService {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        ...this.defaultHeaders,
        ...options.headers,
        ...(token && { Authorization: `Bearer ${token}` }),
      };

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        return {
          success: false,
          error: errorMessage,
        };
      }

      const data = await response.json();
      return {
        success: true,
        ...data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  private buildQueryString(params: QueryParams): string {
    const searchParams = new URLSearchParams();

    if (params.page !== undefined) {
      searchParams.append('page', params.page.toString());
    }
    
    if (params.limit !== undefined) {
      searchParams.append('limit', params.limit.toString());
    }
    
    if (params.sortBy) {
      searchParams.append('sortBy', params.sortBy);
    }
    
    if (params.sortOrder) {
      searchParams.append('sortOrder', params.sortOrder);
    }
    
    if (params.search) {
      searchParams.append('search', params.search);
    }

    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(`filter[${key}]`, String(value));
        }
      });
    }

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  async getTables(): Promise<ApiResponse<string[]>> {
    return this.request<string[]>('/admin/api/tables');
  }

  async getTableSchema(tableName: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/admin/api/tables/${tableName}/schema`);
  }

  async getTableData(
    tableName: string,
    params: QueryParams = {}
  ): Promise<ApiResponse<any[]>> {
    const queryString = this.buildQueryString(params);
    return this.request<any[]>(`/admin/api/tables/${tableName}/data${queryString}`);
  }

  async createRecord(
    tableName: string,
    data: CreateRecordData
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/${tableName}/create`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRecord(
    tableName: string,
    data: UpdateRecordData
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/${tableName}/update`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteRecord(
    tableName: string,
    id: string
  ): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/${tableName}/delete`, {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  }

  async bulkDelete(
    tableName: string,
    ids: string[]
  ): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/${tableName}/bulk-delete`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  async searchRecords(
    tableName: string,
    query: string,
    params: Omit<QueryParams, 'search'> = {}
  ): Promise<ApiResponse<any[]>> {
    const queryString = this.buildQueryString({ ...params, search: query });
    return this.request<any[]>(`/admin/api/tables/${tableName}/search${queryString}`);
  }

  async getRecordById(
    tableName: string,
    id: string
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/${tableName}/read`, {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  }

  async exportTable(
    tableName: string,
    format: 'csv' | 'json' | 'xlsx' = 'csv',
    params: QueryParams = {}
  ): Promise<ApiResponse<Blob>> {
    const queryString = this.buildQueryString(params) + (format ? `&format=${format}` : '');
    
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        ...(token && { Authorization: `Bearer ${token}` }),
      };

      const response = await fetch(
        `${this.baseUrl}/admin/api/tables/${tableName}/export${queryString}`,
        {
          headers,
          credentials: 'include',
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Export failed: ${response.statusText}`,
        };
      }

      const blob = await response.blob();
      return {
        success: true,
        data: blob,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  async importData(
    tableName: string,
    file: File,
    options: {
      skipFirstRow?: boolean;
      updateExisting?: boolean;
      columnMapping?: Record<string, string>;
    } = {}
  ): Promise<ApiResponse<{ imported: number; updated: number; errors: string[] }>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify(options));

      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        ...(token && { Authorization: `Bearer ${token}` }),
      };

      const response = await fetch(
        `${this.baseUrl}/admin/api/tables/${tableName}/import`,
        {
          method: 'POST',
          headers,
          body: formData,
          credentials: 'include',
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Import failed: ${response.statusText}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  async validateRecord(
    tableName: string,
    data: CreateRecordData | UpdateRecordData
  ): Promise<ApiResponse<{ valid: boolean; errors: Record<string, string[]> }>> {
    return this.request<{ valid: boolean; errors: Record<string, string[]> }>(
      `/admin/api/tables/${tableName}/validate`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async getTableStats(
    tableName: string
  ): Promise<ApiResponse<{
    totalRecords: number;
    lastUpdated: string;
    columnStats: Record<string, {
      type: string;
      nullCount: number;
      uniqueCount: number;
      minValue?: any;
      maxValue?: any;
      avgValue?: number;
    }>;
  }>> {
    return this.request(`/admin/api/tables/${tableName}/schema`);
  }

  generateToken(params: { role: string; expiresIn: string }): Promise<ApiResponse<{
    token: string;
    expiresIn: string;
    payload: any;
  }>> {
    return this.request('/admin/api/tokens/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  getCurrentUser(): Promise<ApiResponse<{ id: string; email: string; role: string }>> {
    return this.request('/admin/api/current-user');
  }

  login(credentials: { email: string; password: string }): Promise<ApiResponse<{
    token: string;
    user: { id: string; email: string; role: string };
  }>> {
    return this.request('/admin/api/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.request('/admin/api/logout', {
      method: 'POST',
    });
  }

  // System User and Role Management
  async getSystemUsers(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/system/users');
  }

  async getSystemUserById(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/system/users/${id}`);
  }

  async createSystemUser(data: { email: string; password?: string; roleId: string }): Promise<ApiResponse<any>> {
    return this.request<any>('/system/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSystemUser(id: string, data: { email?: string; password?: string; roleId?: string }): Promise<ApiResponse<any>> {
    return this.request<any>(`/system/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSystemUser(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/system/users/${id}`, {
      method: 'DELETE',
    });
  }

  async getSystemRoles(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/system/roles');
  }

  async getSystemRoleById(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/system/roles/${id}`);
  }

  async createSystemRole(data: { name: string; permissions?: string[] }): Promise<ApiResponse<any>> {
    return this.request<any>('/system/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSystemRole(id: string, data: { name?: string; permissions?: string[] }): Promise<ApiResponse<any>> {
    return this.request<any>(`/system/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSystemRole(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/system/roles/${id}`, {
      method: 'DELETE',
    });
  }

  // Storage Management
  async getStorageInfo(): Promise<ApiResponse<{
    isUsingVolume: boolean;
    volumeName?: string;
    dataDirectory: string;
    totalSizeBytes: number;
    totalSizeMB: number;
    maxSizeGB: number;
    usagePercentage: number;
    breakdown: {
      database: { size: number; files: number };
      schemas: { size: number; files: number };
      logs: { size: number; files: number };
      other: { size: number; files: number };
    };
    files: Array<{
      path: string;
      size: number;
      sizeMB: number;
      type: string;
    }>;
  }>> {
    return this.request('/system/storage');
  }

  async getStorageSummary(): Promise<ApiResponse<{
    summary: string;
    warning?: string;
  }>> {
    return this.request('/system/storage/summary');
  }

  // JWT Token Management
  async getTokens(params?: {
    page?: number;
    limit?: number;
    userId?: string;
    tokenType?: string;
    isRevoked?: boolean;
    includeExpired?: boolean;
  }): Promise<ApiResponse<{
    tokens: JwtTokenInfo[];
    pagination: {
      page: number;
      limit: number;
      total: number;
    };
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.tokenType) queryParams.append('tokenType', params.tokenType);
    if (params?.isRevoked !== undefined) queryParams.append('isRevoked', params.isRevoked.toString());
    if (params?.includeExpired !== undefined) queryParams.append('includeExpired', params.includeExpired.toString());
    
    const url = `/admin/api/tokens${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(url);
  }

  async getTokenStats(): Promise<ApiResponse<{
    total: number;
    active: number;
    revoked: number;
    expired: number;
    byType: Record<string, number>;
  }>> {
    return this.request('/admin/api/tokens/stats');
  }

  async getTokenById(tokenId: string): Promise<ApiResponse<JwtTokenInfo>> {
    return this.request(`/admin/api/tokens/${tokenId}`);
  }

  async getUserTokens(userId: string, params?: {
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<JwtTokenInfo[]>> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    
    const url = `/admin/api/tokens/user/${userId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(url);
  }

  async createToken(data: {
    userId?: string;
    tokenType?: 'api' | 'access' | 'refresh';
    expiresIn?: string;
    scopes?: string | string[];
    metadata?: any;
  }): Promise<ApiResponse<{
    token: string;
    tokenInfo: {
      id: string;
      type: string;
      expiresAt: string;
      scopes?: string;
    };
  }>> {
    return this.request('/admin/api/tokens', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeToken(tokenId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/admin/api/tokens/${tokenId}/revoke`, {
      method: 'POST',
    });
  }

  async revokeAllUserTokens(userId: string): Promise<ApiResponse<{
    message: string;
    revokedCount: number;
  }>> {
    return this.request(`/admin/api/tokens/user/${userId}/revoke-all`, {
      method: 'POST',
    });
  }

  async cleanupExpiredTokens(): Promise<ApiResponse<{
    message: string;
    deletedCount: number;
  }>> {
    return this.request('/admin/api/tokens/cleanup', {
      method: 'POST',
    });
  }

  async validateToken(token: string): Promise<ApiResponse<{
    valid: boolean;
    tokenInfo?: {
      id: string;
      type: string;
      expiresAt: string;
      lastUsedAt?: string;
      scopes?: string;
    };
    reason?: string;
  }>> {
    return this.request('/admin/api/tokens/validate', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;
export const apiService = new ApiService(API_BASE_URL);
