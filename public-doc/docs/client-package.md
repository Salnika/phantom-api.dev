# 📦 Client Package (`phantom-api`)

The `phantom-api` NPM package provides a TypeScript SDK for seamless frontend integration with the Phantom API backend.

## Installation

```bash
npm install phantom-api
# or
yarn add phantom-api
```

## Quick Start

```typescript
import { createClient } from 'phantom-api';

// 1. Create a client instance
const client = createClient({
  baseURL: 'http://localhost:3000',
  token: 'your-jwt-token' // optional
});

// 2. Access a resource
const userResource = client.resource('User');

// 3. Use CRUD operations
const newUser = await userResource.create({ email: 'user@example.com', name: 'John Doe' });
const allUsers = await userResource.read();
```

## Features

* **Type-Safe**: Full TypeScript support with autocompletion.
* **Resource-Based**: Intuitive API matching backend resources.
* **Error Handling**: Consistent error responses and handling.
* **Batch Operations**: Multiple API calls in a single request.
* **Authentication**: JWT and CSRF token management.
* **Flexible Queries**: Advanced filtering, sorting, and pagination.

## Examples

### Configuration

The recommended approach is to create a dedicated client instance.

```typescript
import { createClient } from 'phantom-api';

// Configure the client depending on the environment
const baseURL = process.env.NODE_ENV === 'production'
  ? 'https://api.yourapp.com'
  : 'http://localhost:3000';

const client = createClient({ baseURL });

// Set the token from localStorage or an environment variable
const token = localStorage.getItem('auth_token');
if (token) {
  client.setToken(token);
}
```

### Resource Operations

#### Create a Resource

```typescript
const userResource = client.resource('User');

try {
  const newUser = await userResource.create({
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    isActive: true
  });
  console.log('User created:', newUser);
} catch (error) {
  console.error('Failed to create user:', error.message);
}
```

#### Read Resources

Fetch resources with flexible query options.

**Get all resources**

```typescript
const allUsers = await userResource.read();
```

**Get a single resource by ID**

```typescript
const user = await userResource.read({ id: 'user_abc123' });
```

**Advanced query**

```typescript
const activeUsers = await userResource.read({
  where: {
    isActive: true,
    age: { gte: 18 },
    role: { in: ['admin', 'editor'] }
  },
  sort: ['-createdAt'],
  limit: 20,
  offset: 0,
  select: ['id', 'name', 'email', 'role'],
  populate: ['profile']
});
```

#### Update a Resource

```typescript
try {
  const updatedUser = await userResource.update({
    id: 'user_abc123',
    name: 'Jane Smith'
  });
  console.log('User updated:', updatedUser);
} catch (error) {
  console.error('Update failed:', error.message);
}
```

#### Delete a Resource

```typescript
try {
  await userResource.delete('user_abc123');
  console.log('User successfully deleted');
} catch (error) {
  console.error('Deletion failed:', error.message);
}
```

### Batch Operations

Execute multiple operations in one request for better performance.

```typescript
const results = await client.batch([
  {
    resource: 'User',
    action: 'create',
    data: { name: 'John Doe', email: 'john@example.com' }
  },
  {
    resource: 'Post',
    action: 'read',
    data: { limit: 5 }
  }
]);

results.forEach(result => {
  if (result.success) {
    console.log('Operation succeeded:', result.data);
  } else {
    console.error('Operation failed:', result.error);
  }
});
```

### Advanced Methods

#### `safeCreate`

Creates a new entry only if no matching resource exists.

```typescript
await client.resource('User').safeCreate({
  filter: { email: 'a@b.com' },
  data: { email: 'a@b.com', name: 'Alex' }
});
```

#### `safeUpdate`

Updates an existing entry only if a matching resource is found.

```typescript
await client.resource('User').safeUpdate({
  filter: { email: 'a@b.com' },
  data: { name: 'Alex Smith' }
});
```

### Error Handling

The client manages errors in a structured way. The built-in Axios interceptor logs errors.

```typescript
try {
  await client.resource('User').create({ email: 'invalid-email' });
} catch (error) {
  // Error is already logged by the client's interceptor
  // You can add custom error handling here
  if (error.response?.status === 400) {
    alert('Invalid data. Please check the fields.');
  }
}
```

### React Integration

Example of a React hook for resource management.

```typescript
import { useState, useEffect, useCallback } from 'react';
import { PhantomAPIClient } from 'phantom-api'; // Ensure client is initialized elsewhere

const client = new PhantomAPIClient({ baseURL: 'http://localhost:3000' });

function useResource<T>(resourceName: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resource = client.resource<T>(resourceName);

  const fetchData = useCallback(async (query = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await resource.read(query);
      setData(Array.isArray(result) ? result : [result]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [resource]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ... other functions (create, update, delete)

  return { data, loading, error, refresh: fetchData };
}

// Usage in a component
function UserList() {
  const { data: users, loading, error } = useResource('User');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ul>
      {users.map(user => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}
```
