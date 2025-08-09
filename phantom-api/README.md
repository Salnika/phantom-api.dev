<div align="center">
  <img src="../assets/logo-white-and-black.svg" alt="Phantom API Logo" width="220" />
  
  # Phantom API Client

  **The official TypeScript/JavaScript client for Phantom API - Create powerful backends without the complexity.**

  [![npm version](https://img.shields.io/npm/v/phantom-api-client.svg)](https://www.npmjs.com/package/phantom-api-client)
  [![npm downloads](https://img.shields.io/npm/dm/phantom-api-client.svg)](https://www.npmjs.com/package/phantom-api-client)
  [![GitHub stars](https://img.shields.io/github/stars/salnika/phantom-api.dev.svg)](https://github.com/salnika/phantom-api.dev)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![TypeScript Ready](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
</div>

## TL;DR

**It creates your backend by calling it** 🪄

No need to write schemas, migrations, or endpoints. Just call your API and watch it build itself in real-time!

## Quick Example

```typescript
import { createClient } from 'phantom-api-client';

const client = createClient();
client.setEndpoint('https://your-phantom-api.com');

const users = client.resource('users');

// 🎯 This single call creates the entire backend infrastructure
await users.create({
  name: 'John Doe',
  email: 'john@example.com'
});

// ✨ Database table, validation rules, and REST endpoints are now live!
const allUsers = await users.getAll();
```

## Installation

```bash
npm install phantom-api-client
# or
yarn add phantom-api-client
# or  
bun add phantom-api-client
```

## ✨ Features

- 🪄 **Magic Backend Creation**: Your backend builds itself as you call it - no setup required!
- 🚀 **Zero Boilerplate**: Skip the boring stuff, just start building features
- 🔐 **Authentication Ready**: JWT tokens and sessions work out of the box  
- 📊 **Type Safety**: TypeScript loves it, and so will you
- 🎯 **Smart Queries**: Filter, sort, paginate like you're reading your mind
- ⚡ **Lightning Fast**: Optimized for speed, built for scale
- 🛠️ **CLI Superpowers**: Migrations and seeds that actually make sense
- 💝 **Developer Joy**: Because coding should be fun, not frustrating

## 🚀 Quick Start

### Basic Usage

```typescript
import { createClient } from 'phantom-api-client';

// Initialize the client (yes, it's this simple)
const client = createClient();
client.setEndpoint('https://your-phantom-api.com');

// Grab a resource (it doesn't exist yet, but it will!)
const users = client.resource('users');

// Create a user (and boom! 💥 The entire backend comes to life)
await users.create({
  name: 'John Doe',
  email: 'john@example.com'
});

// Now you can do all the usual stuff
const allUsers = await users.getAll();
const user = await users.get(1);
await users.update(1, { name: 'Jane Doe' });
await users.delete(1);
```

### Advanced Usage (aka the cool stuff 😎)

```typescript
// Query like a pro
const activeUsers = await users.getAll({
  filters: { status: 'active' },
  sort: 'created_at:desc',
  limit: 10,
  offset: 0
});

// Relationships? We got you covered
const posts = client.resource('posts');
const userPosts = await posts.getAll({
  filters: { user_id: 1 }
});

// Batch operations because why not?
await users.createMany([
  { name: 'User 1', email: 'user1@example.com' },
  { name: 'User 2', email: 'user2@example.com' }
]);
```

### Authentication (secure by default 🔒)

```typescript
// Just plug in your token
client.setAuth('your-jwt-token');

// Or do it all at once
const client = createClient({
  endpoint: 'https://your-phantom-api.com',
  token: 'your-jwt-token'
});
```

## 🛠️ CLI Tools (for when you want to feel like a wizard 🧙‍♂️)

### Migration CLI

```bash
# Generate a new migration
phantom-migration generate create_users_table

# Run migrations
phantom-migration up

# Rollback migrations
phantom-migration down
```

### Seed CLI

```bash
# Create seed data
phantom-seed create users

# Run seeds
phantom-seed run
```

## 📖 API Reference

### Client Methods

- `createClient(options?)` - Create a new Phantom API client
- `setEndpoint(url)` - Set the API endpoint URL
- `resource(name)` - Get a resource instance
- `setAuth(token)` - Set authentication token

### Resource Methods

- `getAll(options?)` - Fetch all records
- `get(id)` - Fetch single record by ID
- `create(data)` - Create new record
- `createMany(data[])` - Create multiple records
- `update(id, data)` - Update existing record
- `delete(id)` - Delete record
- `count(filters?)` - Count records

### Query Options

```typescript
interface QueryOptions {
  filters?: Record<string, any>;
  sort?: string;
  limit?: number;
  offset?: number;
  include?: string[];
}
```

## Real-World Examples

### E-commerce Store
```typescript
// Product catalog with categories
await client.resource('products').create({
  name: 'iPhone 15 Pro',
  price: 999.99,
  category_id: 'electronics',
  in_stock: true
});
```

### Task Management
```typescript
// Project tasks with assignments
await client.resource('tasks').create({
  title: 'Design new homepage',
  assignee_id: 'user_456',
  project_id: 'proj_123',
  status: 'in_progress',
  priority: 'high'
});
```

## Environment Management

```typescript
const devClient = createClient({
  endpoint: 'http://localhost:3000'
});

const prodClient = createClient({
  endpoint: 'https://api.yourapp.com',
  token: process.env.PHANTOM_API_TOKEN
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

## 📄 License

Licensed under the [MIT License](LICENSE).

## 🆘 Support

- 📖 [Documentation](https://github.com/salnika/phantom-api.dev)
- 🐛 [Issue Tracker](https://github.com/salnika/phantom-api.dev/issues)
- 💬 [Discussions](https://github.com/salnika/phantom-api.dev/discussions)

---

<div align="center">
  <strong>Built with ❤️ by the Phantom API team</strong><br>
  <em>Connect to powerful backends without the complexity.</em>
</div>