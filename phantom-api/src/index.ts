import axios, { AxiosInstance, AxiosResponse } from 'axios';

/**
 * Configuration interface for the Phantom API client.
 */
interface PhantomAPIConfig {
  /** The base URL of the Phantom API. */
  baseURL: string;
  /** Optional authentication token. */
  token?: string;
}

/**
 * Represents a standard API response structure from the Phantom API.
 * @template T The type of the data payload in the response.
 */
interface APIResponse<T = any> {
  /** Indicates if the API call was successful. */
  success: boolean;
  /** The name of the resource involved in the operation (optional). */
  resource?: string;
  /** The action performed on the resource (e.g., 'create', 'read') (optional). */
  action?: string;
  /** The data payload returned by the API. */
  data: T;
  /** Optional human-readable message from the API. */
  message?: string;
  /** An error message if the operation failed (optional). */
  error?: string;
  /** Detailed error information (optional). */
  details?: string[];
}

/**
 * Represents a single request item within a batch operation.
 */
interface BatchRequestItem {
  /** The name of the resource for this request. */
  resource: string;
  /** The action to perform on the resource (e.g., 'create', 'update'). */
  action: string;
  /** The data payload for this request. */
  data: Record<string, any>;
}

/**
 * Represents a single response item within a batch operation, extending `APIResponse`.
 */
interface BatchResponseItem extends APIResponse { }


/**
 * Options for querying resources.
 */
interface ResourceQueryOptions {
  /** Optional: The ID of a specific resource to retrieve. */
  id?: string;
  /** Optional: The maximum number of records to return. */
  limit?: number;
  /** Optional: The number of records to skip. */
  offset?: number;
  /** Optional: Fields to populate (e.g., related resources). Can be a single string or an array of strings. */
  populate?: string | string[];
  /** Optional: Fields to sort by. Can be a single string or an array of strings (e.g., 'name:asc', '-createdAt'). */
  sort?: string | string[];
  /** Optional: Fields to select. Can be a single string or an array of strings. */
  select?: string | string[];
  /** Optional: A WHERE clause for filtering records. */
  where?: Record<string, any>;
  /** Optional: The page number for pagination. */
  page?: number;
}

/**
 * Represents the metadata fields for a resource, describing its structure.
 */
interface ResourceMetaFields {
  [key: string]: {
    /** The data type of the field (e.g., 'string', 'integer', 'boolean'). */
    type: string;
    // Add other field properties as needed
  };
}

/**
 * Represents a specific resource in the Phantom API, providing methods for CRUD operations.
 * @template T The type of the resource data.
 */
class Resource<T = any> {
  private resourceName: string;
  private client: AxiosInstance;

  /**
   * Creates an instance of Resource.
   * @param resourceName The name of the resource (e.g., 'User', 'Product').
   * @param client The Axios instance used for making API requests.
   */
  constructor(resourceName: string, client: AxiosInstance) {
    this.resourceName = resourceName;
    this.client = client;
  }

  /**
   * Creates a new resource.
   * @param data The data for the new resource.
   * @returns A Promise that resolves to the created resource.
   * @throws An error if the create operation fails.
   */
  async create(data: Record<string, any>): Promise<T> {
    const response = await this.client.post<APIResponse>(`/api/${this.resourceName}`, data);
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Create operation failed');
  }

  /**
   * Reads one or more resources based on the provided options.
   * @param options Query options for filtering, sorting, pagination, and population.
   * @returns A Promise that resolves to a single resource or an array of resources.
   * @throws An error if the read operation fails.
   */
  async read(options: ResourceQueryOptions = {}): Promise<T | T[]> {
    const { populate, ...restOptions } = options;
    let url = `/api/${this.resourceName}`;

    const queryParams = new URLSearchParams();
    
    if (populate) {
      const populateString = Array.isArray(populate) ? populate.join(',') : populate;
      queryParams.append('populate', populateString);
    }
    
    // Add other query parameters
    Object.entries(restOptions).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, String(value));
      }
    });

    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }

    const response = await this.client.get<APIResponse>(url);
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Read operation failed');
  }

  /**
   * Updates an existing resource.
   * @param data The data to update, including the resource's ID.
   * @returns A Promise that resolves to the updated resource.
   * @throws An error if the update operation fails or if the ID is missing.
   */
  async update(data: Record<string, any> & { id: string }): Promise<T> {
    if (!data.id) {
      throw new Error('ID is required for update operation');
    }
    const { id, ...updateData } = data;
    const response = await this.client.put<APIResponse>(`/api/${this.resourceName}/${id}`, updateData);
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Update operation failed');
  }

  /**
   * Deletes a resource by its ID.
   * @param id The ID of the resource to delete.
   * @returns A Promise that resolves to true if the deletion was successful.
   * @throws An error if the delete operation fails.
   */
  async delete(id: string): Promise<boolean> {
    const response = await this.client.delete<APIResponse>(`/api/${this.resourceName}/${id}`);
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Delete operation failed');
  }

  /**
   * Retrieves the metadata (schema) for the resource.
   * @returns A Promise that resolves to the resource's meta fields.
   * @throws An error if fetching the schema fails.
   */
  async getFields(): Promise<ResourceMetaFields> {
    const response = await this.client.get<APIResponse>(`/api/schema/${this.resourceName}`);
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to fetch resource schema');
  }

  /**
   * Creates a resource if it does not already exist, based on a filter.
   * @param payload An object containing a filter and the data to create.
   * @returns A Promise that resolves to the created resource and a 'created' flag.
   * @throws An error if the safe create operation fails.
   */
  async safeCreate(payload: { filter: Record<string, any>; data: Record<string, any> }): Promise<T & { created: boolean }> {
    const response = await this.client.post<APIResponse<T & { created: boolean }>>(`/api/${this.resourceName}/createIfNotExists`, payload);
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Safe create operation failed');
  }

  /**
   * Updates a resource if it exists, based on a filter.
   * @param payload An object containing a filter and the data to update.
   * @returns A Promise that resolves to the updated resource and an 'updated' flag.
   * @throws An error if the safe update operation fails.
   */
  async safeUpdate(payload: { filter: Record<string, any>; data: Record<string, any> }): Promise<T & { updated: boolean }> {
    const response = await this.client.post<APIResponse<T & { updated: boolean }>>(`/api/${this.resourceName}/updateIfExists`, payload);
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Safe update operation failed');
  }
}

/**
 * The main client for interacting with the Phantom API.
 */
class PhantomAPIClient {
  private client: AxiosInstance;
  private config: PhantomAPIConfig;
  private csrfToken: string | null = null;

  /**
   * Creates an instance of PhantomAPIClient.
   * @param config Configuration for the API client, including baseURL and optional token.
   */
  constructor(config: PhantomAPIConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        ...(config.token && { Authorization: `Bearer ${config.token}` })
      }
    });

    // Add request interceptor for CSRF token
    this.client.interceptors.request.use(async (config) => {
      // Skip CSRF token for the csrf-token endpoint itself and GET requests
      if (config.url?.includes('/csrf-token') || config.method?.toUpperCase() === 'GET') {
        return config;
      }

      // Only add CSRF token for non-GET requests
      if (config.method && ['post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())) {
        const token = await this.getCSRFToken();
        if (token) {
          config.headers['CSRF-Token'] = token;
        }
      }

      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse<APIResponse>) => response,
      async (error) => {
        console.error('Phantom API Error:', error.response?.data || error.message);

        // If we get a CSRF error, try to refresh the token and retry once
        if (error.response?.status === 403 &&
          error.response?.data?.code === 'CSRF_TOKEN_INVALID' &&
          !error.config._retry) {

          console.log('CSRF token invalid, refreshing and retrying...');
          error.config._retry = true;

          // Get a fresh CSRF token
          const newToken = await this.getCSRFToken(true);
          if (newToken) {
            error.config.headers['CSRF-Token'] = newToken;
            return this.client.request(error.config);
          }
        }

        throw error;
      }
    );
  }

  /**
   * Fetches the CSRF token from the server.
   * @param forceRefresh If true, forces a refresh of the token even if one is already present.
   * @returns A Promise that resolves to the CSRF token or null if not available.
   */
  private async getCSRFToken(forceRefresh: boolean = false): Promise<string | null> {
    if (this.csrfToken && !forceRefresh) {
      return this.csrfToken;
    }

    try {
      console.log('Fetching CSRF token from server...');
      const response = await this.client.get('/csrf-token');

      if (response.data?.success && response.data?.csrfToken) {
        this.csrfToken = response.data.csrfToken;
        console.log('CSRF token retrieved successfully');
        return this.csrfToken;
      } else {
        console.warn('Invalid CSRF token response:', response.data);
      }
    } catch (error) {
      console.warn('Could not fetch CSRF token:', error);
      this.csrfToken = null;
    }

    return null;
  }

  /**
   * Sets the authentication token for the client.
   * @param token The JWT token to be used for authentication.
   */
  setToken(token: string) {
    this.config.token = token;
    this.client.defaults.headers['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Sets the base URL for the API client.
   * @param baseURL The new base URL for API requests.
   */
  setEndpoint(baseURL: string) {
    this.config.baseURL = baseURL;
    this.client.defaults.baseURL = baseURL;
  }

  /**
   * Refreshes the CSRF token.
   * @returns A Promise that resolves to the new CSRF token or null.
   */
  async refreshCSRFToken(): Promise<string | null> {
    return this.getCSRFToken(true);
  }

  /**
   * Creates a resource client for a specific resource name.
   * @template T The type of the resource.
   * @param resourceName The name of the resource (e.g., 'User', 'Product').
   * @returns An instance of the Resource class for the specified resource.
   */
  resource<T = any>(resourceName: string): Resource<T> {
    return new Resource<T>(resourceName, this.client);
  }

  /**
   * Performs a health check on the API.
   * @returns A Promise that resolves to the health check response data.
   * @throws An error if the health check fails.
   */
  async health() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } // eslint-disable-next-line @typescript-eslint/no-unused-vars
    catch (_error) {
      throw new Error('Health check failed');
    }
  }

  /**
   * Pulls migrations from the API.
   * @returns A Promise that resolves to the API response for pull migrations.
   * @throws An error if pulling migrations fails.
   */
  async pullMigrations() {
    try {
      const response = await this.client.post<APIResponse>('/admin/api/migrations/pull', {});
      return response.data;
    } catch (error) {
      throw new Error(`Failed to pull migrations: ${(error as Error).message}`);
    }
  }

  /**
   * Applies a specific migration by file name.
   * @param fileName The name of the migration file to apply.
   * @returns A Promise that resolves to the API response for applying the migration.
   * @throws An error if applying the migration fails.
   */
  async applyMigration(fileName: string) {
    try {
      const response = await this.client.post<APIResponse>('/admin/api/migrations/apply', { fileName });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to apply migration: ${(error as Error).message}`);
    }
  }

  /**
   * Generates seed data.
   * @returns A Promise that resolves to the API response for generating seed data.
   * @throws An error if generating seed data fails.
   */
  async generateSeedData() {
    try {
      const response = await this.client.post<APIResponse>('/admin/api/seeds/generate', {});
      return response.data;
    } catch (error) {
      throw new Error(`Failed to generate seed data: ${(error as Error).message}`);
    }
  }

  /**
   * Applies seed data from a specific file.
   * @param fileName The name of the seed file to apply.
   * @returns A Promise that resolves to the API response for applying seed data.
   * @throws An error if applying seed data fails.
   */
  async applySeedData(fileName: string) {
    try {
      const response = await this.client.post<APIResponse>('/admin/api/seeds/apply', { fileName });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to apply seed data: ${(error as Error).message}`);
    }
  }

  /**
   * Executes a batch of requests.
   * @param requests An array of batch request items.
   * @returns A Promise that resolves to an array of batch response items.
   * @throws An error if the batch operation fails.
   */
  async batch(requests: BatchRequestItem[]): Promise<BatchResponseItem[]> {
    try {
      const response = await this.client.post<APIResponse<BatchResponseItem[]>>('/api/batch', { requests });
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Batch operation failed');
    } catch (error) {
      throw new Error(`Failed to execute batch requests: ${(error as Error).message}`);
    }
  }
}

// Global instance for convenience
let globalClient: PhantomAPIClient | null = null;

/**
 * Creates a new Phantom API client instance.
 * @param config Configuration for the client.
 * @returns A new PhantomAPIClient instance.
 */
export function createClient(config: PhantomAPIConfig): PhantomAPIClient {
  return new PhantomAPIClient(config);
}

/**
 * Sets the base URL for the global Phantom API client instance.
 * If a global client does not exist, it will be created.
 * @param baseURL The base URL to set.
 */
export function setEndpoint(baseURL: string) {
  if (!globalClient) {
    globalClient = new PhantomAPIClient({ baseURL });
  } else {
    globalClient.setEndpoint(baseURL);
  }
}

/**
 * Sets the authentication token for the global Phantom API client instance.
 * @param token The JWT token to set.
 * @throws An error if `setEndpoint` has not been called first or `createClient` has not been used.
 */
export function setToken(token: string) {
  if (!globalClient) {
    throw new Error('Must call setEndpoint first or use createClient');
  }
  globalClient.setToken(token);
}

/**
 * Gets a resource client for a specific resource name from the global Phantom API client instance.
 * @template T The type of the resource.
 * @param resourceName The name of the resource.
 * @returns A Resource instance for the specified resource.
 * @throws An error if `setEndpoint` has not been called first or `createClient` has not been used.
 */
export function resource<T = any>(resourceName: string): Resource<T> {
  if (!globalClient) {
    throw new Error('Must call setEndpoint first or use createClient');
  }
  return globalClient.resource(resourceName);
}

/**
 * Executes a batch of requests using the global Phantom API client instance.
 * @param requests An array of batch request items.
 * @returns A Promise that resolves to an array of batch response items.
 * @throws An error if `setEndpoint` has not been called first or `createClient` has not been used.
 */
export async function batch(requests: BatchRequestItem[]): Promise<BatchResponseItem[]> {
  if (!globalClient) {
    throw new Error('Must call setEndpoint first or use createClient');
  }
  return globalClient.batch(requests);
}

/**
 * Performs a health check using the global Phantom API client instance.
 * @returns A Promise that resolves to the health check response data.
 * @throws An error if `setEndpoint` has not been called first or `createClient` has not been used.
 */
export async function health() {
  if (!globalClient) {
    throw new Error('Must call setEndpoint first or use createClient');
  }
  return globalClient.health();
}

/**
 * Pulls migrations using the global Phantom API client instance.
 * @returns A Promise that resolves to the API response for pull migrations.
 * @throws An error if `setEndpoint` has not been called first or `createClient` has not been used.
 */
export async function pullMigrations() {
  if (!globalClient) {
    throw new Error('Must call setEndpoint first or use createClient');
  }
  return globalClient.pullMigrations();
}

/**
 * Applies a specific migration by file name using the global Phantom API client instance.
 * @param fileName The name of the migration file to apply.
 * @returns A Promise that resolves to the API response for applying the migration.
 * @throws An error if `setEndpoint` has not been called first or `createClient` has not been used.
 */
export async function applyMigration(fileName: string) {
  if (!globalClient) {
    throw new Error('Must call setEndpoint first or use createClient');
  }
  return globalClient.applyMigration(fileName);
}

/**
 * Generates seed data using the global Phantom API client instance.
 * @returns A Promise that resolves to the API response for generating seed data.
 * @throws An error if `setEndpoint` has not been called first or `createClient` has not been used.
 */
export async function generateSeedData() {
  if (!globalClient) {
    throw new Error('Must call setEndpoint first or use createClient');
  }
  return globalClient.generateSeedData();
}

/**
 * Applies seed data from a specific file using the global Phantom API client instance.
 * @param fileName The name of the seed file to apply.
 * @returns A Promise that resolves to the API response for applying seed data.
 * @throws An error if `setEndpoint` has not been called first or `createClient` has not been used.
 */
export async function applySeedData(fileName: string) {
  if (!globalClient) {
    throw new Error('Must call setEndpoint first or use createClient');
  }
  return globalClient.applySeedData(fileName);
}

/**
 * Refreshes the CSRF token using the global Phantom API client instance.
 * @returns A Promise that resolves to the new CSRF token or null.
 * @throws An error if `setEndpoint` has not been called first or `createClient` has not been used.
 */
export async function refreshCSRFToken(): Promise<string | null> {
  if (!globalClient) {
    throw new Error('Must call setEndpoint first or use createClient');
  }
  return globalClient.refreshCSRFToken();
}


// Export types
export type { PhantomAPIConfig, APIResponse, ResourceQueryOptions, ResourceMetaFields, BatchRequestItem, BatchResponseItem };
export { PhantomAPIClient, Resource };

// Default export for convenience
export default {
  createClient,
  setEndpoint,
  setToken,
  resource,
  health,
  pullMigrations,
  applyMigration,
  generateSeedData,
  applySeedData,
  refreshCSRFToken,
  batch
};
