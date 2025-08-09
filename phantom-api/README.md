<div align="center">
  <img src="https://raw.githubusercontent.com/salnika/phantom-api.dev/main/assets/logo-blue.svg" alt="Phantom API Logo" width="120" height="120">
  
  # Phantom API Client
  
  **Dynamic backend system that builds type-safe, schema-based APIs with zero boilerplate**
  
  [![npm version](https://img.shields.io/npm/v/phantom-api-client.svg)](https://www.npmjs.com/package/phantom-api-client)
  [![npm downloads](https://img.shields.io/npm/dm/phantom-api-client.svg)](https://www.npmjs.com/package/phantom-api-client)
  [![GitHub stars](https://img.shields.io/github/stars/salnika/phantom-api.dev.svg)](https://github.com/salnika/phantom-api.dev)
  [![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-blue.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
  [![Documentation](https://img.shields.io/badge/docs-phantom--api.dev-blue)](https://phantom-api.dev)
</div>

## TL;DR

**Phantom API is a dynamic backend system that builds type-safe, schema-based APIs with zero boilerplate.**

Skip writing database schemas, migrations, validation rules, and REST endpoints. Just call your API and watch it build itself in real-time.

## Quick Example

```typescript
import { createClient } from 'phantom-api-client';

const client = createClient({ baseURL: 'https://api.example.com' });
const tasks = client.resource('Task');

// 🎯 This single call creates the database table, validation schema, and REST endpoints
await tasks.create({ name: 'Write README', done: false, priority: 'high' });

// ✅ Table "tasks" now exists with columns: id, name, done, priority, created_at
const list = await tasks.read({ where: { done: false } });
```

[→ See complete examples](https://phantom-api.dev/docs/examples)

## Installation

```bash
npm install phantom-api-client
# or
yarn add phantom-api-client
# or  
bun add phantom-api-client
```

## Documentation

📚 **[Full documentation →](https://phantom-api.dev)**

## Why Phantom API?

🧠 **Data-first**: Auto-generates tables, validations, and routes from your actual data  
🔐 **Fine-grained permissions**: Built-in policy system with role-based and attribute-based access control  
⚡️ **Fast to deploy**: No backend code required - works with any frontend framework  
🧱 **Works everywhere**: Next.js, React Native, Vue, Svelte, vanilla JavaScript  
🎯 **Type-safe**: Full TypeScript support with auto-generated types  
🔄 **Real-time**: Built-in WebSocket support for live data updates  

## Feature Comparison

| Tool | Backend Code Needed | Permissions | Hosted | Custom Logic |
|------|-------------------|-------------|---------|--------------|
| **Phantom** | ❌ None | ✅ Built-in | ✅ | ✅ With Hooks |
| Supabase | ✅ SQL/Edge Functions | ⚠️ Limited | ✅ | ✅ |
| Strapi | ✅ JS/TS | ✅ Advanced | ❌ | ✅ |
| Hasura | ❌ GraphQL Config | ⚠️ Complex | ✅ | ⚠️ Indirect |
| Firebase | ✅ Cloud Functions | ⚠️ Basic Rules | ✅ | ⚠️ Limited |

## Core Features

### 🚀 Dynamic Resource Creation

```typescript
// Creates table, schema, and endpoints automatically
const users = client.resource('User');
const posts = client.resource('Post'); 
const comments = client.resource('Comment');

// Relationships detected from field names
await posts.create({
  title: 'Hello World',
  content: 'My first post!',
  authorId: 'user_123'  // 👈 Auto-creates foreign key to User table
});
```

### 🔍 Advanced Querying

```typescript
const posts = await client.resource('Post').read({
  where: {
    published: true,
    createdAt: { gte: '2024-01-01' },
    tags: { contains: 'javascript' }
  },
  populate: ['author', 'comments'],
  sort: ['-createdAt'],
  limit: 20
});
```

### ⚡ Batch Operations

```typescript
const results = await client.batch([
  { resource: 'User', action: 'create', data: { name: 'Alice' } },
  { resource: 'User', action: 'create', data: { name: 'Bob' } },
  { resource: 'Post', action: 'create', data: { title: 'Hello', authorId: 'user_123' } }
]);
```

### 🎯 Type Safety

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

const user = await client.resource<User>('User').create({
  email: 'john@example.com',
  name: 'John Doe'
});
// user is fully typed! ✅
```

## Real-World Usage

### E-commerce Store
```typescript
// Product catalog with categories and inventory
await client.resource('Product').create({
  name: 'iPhone 15 Pro',
  price: 999.99,
  categoryId: 'electronics',
  inStock: true,
  variants: ['128GB', '256GB', '512GB']
});
```

### Social Media App
```typescript
// User posts with likes and comments
await client.resource('Post').create({
  content: 'Building with Phantom API! 🚀',
  authorId: 'user_123',
  tags: ['#phantomapi', '#nocode']
});

await client.resource('Like').create({
  postId: 'post_456',
  userId: 'user_789'
});
```

### Task Management
```typescript
// Project tasks with assignments
await client.resource('Task').create({
  title: 'Design new homepage',
  description: 'Create wireframes and mockups',
  assigneeId: 'user_456',
  projectId: 'proj_123',
  status: 'in_progress',
  priority: 'high',
  dueDate: '2024-02-15'
});
```

## Authentication & Security

```typescript
// JWT authentication
const client = createClient({
  baseURL: 'https://api.yourapp.com',
  token: 'your-jwt-token'
});
```

## Migration & Deployment

### CLI Tools
```bash
# Preview database changes
phantom-migration --preview

# Apply migrations
phantom-migration --apply

# Seed development data
phantom-seed --file ./seeds/demo.json
```

### Environment Management
```typescript
const devClient = createClient({
  baseURL: 'http://localhost:3000'
});

const prodClient = createClient({
  baseURL: 'https://api.yourapp.com',
  token: process.env.PHANTOM_API_TOKEN
});
```

## Roadmap / Contributing

We're actively developing Phantom API! Here's what's coming:

- 🔄 Real-time subscriptions
- 📊 Advanced analytics dashboard  
- 🤖 AI-powered schema suggestions
- 📱 Mobile SDKs (React Native, Flutter)

**Want to contribute?** Check out our [GitHub Issues](https://github.com/salnika/phantom-api.dev/issues) or join our community!

## Community & Support

- 📖 **Documentation**: [phantom-api.dev](https://phantom-api.dev)
- 💬 **Discord**: [Join our community](https://discord.gg/phantom-api)
- 🐛 **Issues**: [GitHub Issues](https://github.com/salnika/phantom-api.dev/issues)
- 🔄 **Updates**: Follow [@PhantomAPI](https://twitter.com/phantomapi) on Twitter

## License

CC BY-NC-SA 4.0 – see the LICENSE file in the repository root.

---

<div align="center">
  <strong>Built with ❤️ by the Phantom API team</strong><br>
  <em>Stop writing boilerplate. Start building features.</em>
</div>
