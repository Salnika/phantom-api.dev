# 🚀 API Backend

The Phantom API backend provides a dynamic REST API that automatically generates endpoints, database tables, and validation schemas from JSON metadata definitions.

## Key Concepts

* **Single Endpoint Model**: All operations use `/api/:resource/:action`.
* **Metadata-Driven**: Database schema defined in `phantom-api-backend/meta/*.json` files.
* **Auto-Generated Tables**: SQLite tables created automatically based on the metadata.
* **Zod Validation**: Automatic schema validation driven by the field definitions.
* **Role-Based Permissions**: JWT authentication with the roles `anon`, `user`, `admin`.
* **Dynamic Schema Evolution**: Tables automatically updated when the metadata changes.

## API Examples

### Fetch a Resource’s Schema

Retrieve the field definitions and metadata for any resource.

=== "cURL"

```bash
curl -X GET \
  http://localhost:3000/api/User/schema \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

=== "phantom-api"

```typescript
import { createClient } from 'phantom-api';

const client = createClient({ baseURL: 'http://localhost:3000' });
const userResource = client.resource('User');
const schema = await userResource.getFields();
console.log('User Schema:', schema);
```

### Create a Resource

Create new resources with automatic ID generation and validation.

=== "cURL"

```bash
curl -X POST \
  http://localhost:3000/api/User \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com"
  }'
```

=== "phantom-api"

```typescript
const newUser = await client.resource('User').create({
  name: 'John Doe',
  email: 'john.doe@example.com'
});
```

### Read Resources

Fetch resources with flexible query options.

=== "cURL"

```bash
curl -X GET \
  "http://localhost:3000/api/User?limit=10&where[isActive]=true&sort=-createdAt" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

=== "phantom-api"

```typescript
const users = await client.resource('User').read({
  limit: 10,
  where: { isActive: true },
  sort: ['-createdAt']
});
```

### Update a Resource

Update an existing resource by its ID.

=== "cURL"

```bash
curl -X PUT \
  http://localhost:3000/api/User/user_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "name": "John Smith"
  }'
```

=== "phantom-api"

```typescript
const updatedUser = await client.resource('User').update({
  id: 'user_abc123',
  name: 'John Smith'
});
```

### Delete a Resource

Delete a resource by its ID.

=== "cURL"

```bash
curl -X DELETE \
  http://localhost:3000/api/User/user_abc123 \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

=== "phantom-api"

```typescript
await client.resource('User').delete('user_abc123');
```

### Special Operations

#### `createIfNotExists`

Create a resource only if it does not already exist.

=== "cURL"

```bash
curl -X POST \
  http://localhost:3000/api/User/createIfNotExists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "filter": { "email": "john.doe@example.com" },
    "data": { "email": "john.doe@example.com", "name": "John Doe" }
  }'
```

=== "phantom-api"

```typescript
const result = await client.resource('User').safeCreate({
  filter: { email: 'john.doe@example.com' },
  data: { email: 'john.doe@example.com', name: 'John Doe' }
});
```

#### `updateIfExists`

Update a resource only if it exists.

=== "cURL"

```bash
curl -X POST \
  http://localhost:3000/api/User/updateIfExists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "filter": { "email": "john.doe@example.com" },
    "data": { "name": "John Updated" }
  }'
```

=== "phantom-api"

```typescript
const result = await client.resource('User').safeUpdate({
  filter: { email: 'john.doe@example.com' },
  data: { name: 'John Updated' }
});
```

---

### Authentication Routes

#### `POST /auth/setup` — **Create First Admin User**

Creates the first admin account for the system.  
This endpoint works **only if no admin user already exists**.

=== "cURL"

```bash
curl -X POST \
  http://localhost:3000/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "StrongPassw0rd!",
    "name": "Super Admin"
  }'
```

**Response (example):**

```json
{
  "success": true,
  "message": "Admin user created successfully",
  "user": {
    "id": "user_abc123",
    "email": "admin@example.com",
    "name": "Super Admin",
    "role": "admin"
  }
}
```

💡 **Note:** After creating the first admin, you can log in via `/auth/login` to manage the system.

---

### Batch Operations

Execute multiple operations in a single request.

=== "cURL"

```bash
curl -X POST \
  http://localhost:3000/api/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "requests": [
      { "resource": "User", "action": "create", "data": { "name": "Batch User" } },
      { "resource": "Post", "action": "read", "data": { "limit": 5 } }
    ]
  }'
```

=== "phantom-api"

```typescript
const results = await client.batch([
  { resource: 'User', action: 'create', data: { name: 'Batch User' } },
  { resource: 'Post', action: 'read', data: { limit: 5 } }
]);
```
