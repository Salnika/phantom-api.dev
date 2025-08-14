<div align="center">
  <img src="../assets/logo-white-and-black.svg" alt="Phantom API Logo" width="220" />
  
  # Phantom API Client

  **The official TypeScript/JavaScript client for Phantom API - Create powerful backends without the complexity.**

  [![npm version](https://img.shields.io/npm/v/phantom-api-client.svg)](https://www.npmjs.com/package/phantom-api-client)
  [![npm downloads](https://img.shields.io/npm/dm/phantom-api-client.svg)](https://www.npmjs.com/package/phantom-api-client)
  [![GitHub stars](https://img.shields.io/github/stars/salnika/phantom-api.dev.svg)](https://github.com/salnika/phantom-api.dev)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
</div>

# Phantom API - Self-Generating Backend

A dynamic backend system that automatically creates API endpoints, database tables, and validation schemas based on api call from frontend.

- [Website](https://phantom-api.dev)
- [github](https://github.com/Salnika/phantom-api.dev)
- [Complete Documentation](https://salnika.github.io/phantom-api.dev/)

## Features

- **Dynamic API**: Single route `/api/:resource/:action` handles all operations
- **Dynamic Table Creation**: Tables automatically created from API calls, no configuration needed
- **Advanced Relations**: Foreign keys, cascading deletes, self-referencing tables
- **Rich Field Types**: String, text, integer, boolean, datetime, enum, JSON, email
- **Zod Validation**: Automatic schema generation and validation
- **🆕 Advanced Policies Management**: Role-based, attribute-based, and custom access control policies
- **JWT Security**: Secure authentication with configurable roles and permissions
- **Admin Interface**: Modern React-based admin panel with policy management and logs viewer
- **Client Package**: TypeScript NPM package for frontend integration
- **Process Management**: PM2 ecosystem for production deployment
- **Structured Logging**: Pino logger with file rotation and admin interface
- **Docker Ready**: Containerized backend with persistent SQLite storage

## Project Structure

```
├── phantom-api-backend/  # backend (Express server with dynamic API)
│   ├── src/             # TypeScript source code
│   ├── meta/            # Optional schema files (auto-generated)
│   ├── logs/            # Application and error logs
│   └── data/            # SQLite database files
├── admin-interface/      # admin (React admin panel)
├── phantom-api/          # client (NPM package for frontend integration)
├── ecosystem.config.js  # PM2 process configuration
├── Dockerfile           # Backend containerization
└── docker-compose.yml   # Multi-service orchestration
```

## Prerequisites

Before getting started, ensure you have the following installed:

### Required
- **Node.js** 18+ (recommended: 22+)
- **Yarn** 4.9.2 (package manager)
- **Git** (version control)

### Optional (for full development experience)
- **PM2** (process management): `yarn add -g pm2`
- **Python 3.8+** and **MkDocs** (documentation): `pip install mkdocs mkdocs-material`
- **Docker** and **Docker Compose** (containerization)

### Installation Verification
```bash
# Check versions
node --version    # Should be 18+
yarn --version    # Should be 4.9.2
git --version     # Any recent version

# Optional tools
pm2 --version     # For process management
mkdocs --version  # For documentation server
docker --version  # For containerized deployment
```

## Quick Start

### 1. Install Dependencies
```bash
yarn install
```

### 2. Environment Setup
Copy the example environment file and configure it:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Secret Key (CHANGE THIS IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Database Configuration
DB_PATH=./data/phantom.db

# Admin Panel Configuration
ADMIN_EMAIL=admin@phantom-api.com
ADMIN_PASSWORD=admin123
```

### 3. Start All Services with PM2
```bash
# Install PM2 globally (if not already installed)
yarn add -g pm2

# Start all services
yarn pm2:start

# Check status
pm2 status

# View logs
yarn pm2:logs
```

Services will run on:
- **Backend**: http://localhost:3000 - API endpoints and data management
- **Admin Interface**: http://localhost:5173 - Modern admin panel with logs viewer
- **# Demo Frontend**: http://localhost:5174 - Example application using the API
- **Website**: http://localhost:5175 - Marketing and documentation site
- **Documentation**: http://localhost:8000 - MkDocs technical documentation

### 4. Alternative: Start Individual Services
```bash
# Backend only
cd phantom-api-backend && yarn dev

# Admin interface only  
cd admin-interface && yarn dev

# Demo frontend only
cd demo && yarn dev

# Documentation server only
cd public-doc && mkdocs serve
```

### 5. Use Client Package
```typescript
import { setEndpoint, setToken, resource } from 'phantom-api';

// Configure
setEndpoint('http://localhost:3000');
setToken('your-jwt-token'); // optional

// Use resources
const users = resource('User');
await users.create({ email: 'test@example.com', name: 'John' });
const allUsers = await users.read();

// Update a user
await users.update({ id: allUsers[0].id, name: 'John Doe Updated' });

// Delete a user
await users.delete({ id: allUsers[0].id });
```

## Docker Deployment

For containerized deployment with optimized production setup:

```bash
# Copy environment template
cp .env.example .env

# Generate secure JWT secret (32+ characters)
openssl rand -base64 32
# Copy to JWT_SECRET in .env

# Build and start
docker-compose up --build -d

# Verify deployment
curl http://localhost:3000/health
```

**Services accessible at:**
- Backend API: http://localhost:3000
- Admin Interface: http://localhost:3000/admin
- Health Check: http://localhost:3000/health

For detailed Docker configuration, see documentation at http://localhost:8000 (when MkDocs is running).

## Dynamic Table Creation

Phantom API creates database tables automatically from your API calls - no configuration files needed!

### How It Works

1. **Call Any Resource**: Simply use `resource('AnyTableName')` in your frontend
2. **Auto-Detection**: The system detects field types from the data you send
3. **Table Creation**: SQLite tables are created instantly with appropriate columns
4. **Schema Evolution**: New fields are automatically added when you send new data

### Field Type Detection

```typescript
// These calls automatically create a User table
const User = resource('User');
User.create({
  email: 'user@example.com',    // → VARCHAR (email format detected)
  name: 'John Doe',             // → VARCHAR 
  age: 30,                      // → INTEGER
  isActive: true,               // → BOOLEAN
  birthDate: '1990-01-01',      // → DATE
  createdAt: new Date(),        // → DATETIME
  metadata: { role: 'admin' }   // → JSON
});
```

### Automatic Relations

```typescript
// Foreign key relationships are auto-detected
const Article = resource('Article');
Article.create({
  title: 'My Article',
  content: 'Article content...',
  authorId: 'user_123',         // → Creates FK to User table
  categoryId: 'cat_456'         // → Creates FK to Category table  
});
```

### Supported Data Types

- **String**: Text fields, emails, URLs
- **Integer**: Numbers, IDs, counts
- **Boolean**: true/false values
- **Date**: ISO date strings
- **DateTime**: ISO datetime strings
- **JSON**: Objects and arrays
- **Relations**: Foreign keys (detected by 'Id' suffix)

## API Usage

All operations use POST requests to `/api/:resource/:action`:

### Create
```bash
curl -X POST http://localhost:3000/api/User/create \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "name": "John Doe"}'
```

### Read
```bash
# Get all
curl -X POST http://localhost:3000/api/User/read \
  -H "Content-Type: application/json" \
  -d '{}'

# Get by ID
curl -X POST http://localhost:3000/api/User/read \
  -H "Content-Type: application/json" \
  -d '{"id": "user_123"}'
```

### Update
```bash
curl -X POST http://localhost:3000/api/User/update \
  -H "Content-Type: application/json" \
  -d '{"id": "user_123", "name": "Jane Doe"}'
```

### Delete
```bash
curl -X POST http://localhost:3000/api/User/delete \
  -H "Content-Type: application/json" \
  -d '{"id": "user_123"}'
```

## Authentication & Authorization

### JWT Authentication
Generate JWT tokens in the admin interface with configurable roles:
- `anon`: Anonymous access (limited)
- `user`: Standard user permissions
- `admin`: Administrative access
- `moderator`: Content moderation permissions
- `viewer`: Read-only access
- `editor`: Content editing permissions

### Advanced Policies System
Phantom API now includes a comprehensive policies management system:

- **Role-Based Access Control (RBAC)**: Traditional role-based permissions
- **Attribute-Based Access Control (ABAC)**: Dynamic permissions based on user/resource attributes
- **Custom Policies**: Complex business logic with conditional rules
- **Policy Templates**: Pre-built policies for common scenarios
- **Real-time Testing**: Test policies before deployment
- **Analytics & Monitoring**: Track policy usage and access patterns

**Example Policy:**
```json
{
  "name": "User Data Ownership",
  "type": "ATTRIBUTE_BASED",
  "rules": [
    {
      "resource": "User",
      "action": "update",
      "effect": "ALLOW",
      "conditions": [
        {
          "field": "user.id",
          "operator": "eq",
          "value": "${resource.id}",
          "context": "user"
        }
      ]
    }
  ]
}
```

**Security Note**: Make sure to change the default JWT_SECRET in production!

📖 **[Complete Policies Documentation](./POLICIES_DOCUMENTATION.md)**

## How It Works

1. **Frontend Call**: `resource('User').create({ email: 'test@mail.com', name: 'MARTIN' })`
2. **Auto-Detection**: System analyzes data types and structure
3. **Table Creation**: SQLite table created instantly if it doesn't exist
4. **Schema Evolution**: New columns added automatically for new fields
5. **Response**: Data saved and returned with generated ID

The system learns from your data and automatically:
- Creates tables with appropriate column types
- Detects relationships from field names (e.g., 'authorId' → User table)
- Generates validation schemas on-the-fly
- Provides admin interface for data management

**Zero configuration required** - just start coding and let Phantom API handle the database!

Perfect for rapid prototyping and dynamic applications!
