# Phantom API - Self-Generating Backend

A dynamic backend system that automatically creates API endpoints, database tables, and validation schemas based on JSON metadata definitions.

## Features

- **Dynamic API**: Single route `/api/:resource/:action` handles all operations
- **Front-End as Model**: Tables and schemas defined automaticaly by calling the backend.
- **Advanced Relations**: Foreign keys, cascading deletes, self-referencing tables
- **Rich Field Types**: String, text, integer, boolean, datetime, enum, JSON, email
- **Zod Validation**: Automatic schema generation and validation
- **Role-based Auth**: JWT authentication with `anon`, `user`, `admin` roles
- **Admin Interface**: React-based admin panel with logs viewer
- **Client Package**: TypeScript NPM package for frontend integration
- **Process Management**: PM2 ecosystem for production deployment
- **Structured Logging**: Pino logger with file rotation and admin interface
- **Docker**: Containerized backend with persistent SQLite storage

## Project Structure

```
├── phantom-api-backend/  # Express server with dynamic API
│   ├── src/             # TypeScript source code
│   ├── meta/            # JSON schema
│   ├── logs/            # Application and error logs
│   └── data/            # SQLite database files
├── admin-interface/      # React admin panel
├── phantom-api/          # NPM package for frontend integration
├── phantom-api-demo/    # Vite React demo application
├── website/             # Marketing website
├── public-doc/          # MkDocs documentation
├── ecosystem.config.js  # PM2 process configuration
├── Dockerfile           # Backend containerization
└── docker-compose.yml   # Multi-service orchestration
```

## Quick Start

### 1. Install Phantom Api
```bash
yarn install phantom-api
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
# Install PM2 globally
yarn add -g pm2

# Start all services
yarn pm2:start

# Check status
pm2 status

# View logs
yarn pm2:logs
```

Services will run on:
- **Backend**: http://localhost:3000 - API
- **Admin Interface**: http://localhost:5173 - Admin Panel
- **Demo Frontend**: http://localhost:5174 - Example application
- **Website**: http://localhost:5175 - Landing Page
- **Documentation** http://localhost:3000 - Docs

### 4. Alternative: Start Individual Services
```bash
# Backend only
cd phantom-api-backend && yarn dev

# Admin interface only  
cd admin-interface && yarn dev

# Demo frontend only
cd templates/todolist-phantom-api && yarn dev
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
```

More at [Client Package Doc](client-package.md)

## Docker Deployment

=== "Quick Start"
    ```bash
    # Copy environment template
    cp .env.example .env
    
    # Generate secure JWT secret
    openssl rand -base64 32
    # Copy to JWT_SECRET in .env
    
    # Start services
    docker-compose up --build -d
    ```

=== "Verify Setup"
    ```bash
    # Check health
    curl http://localhost:3000/health
    
    # Access admin interface
    open http://localhost:3000/admin
    ```

For detailed Docker configuration, see [Docker Deployment](self-host-docker.md).

## How It Works

1. **Request**: Frontend sends POST to `/api/Resource/action`
2. **Validation**: Zod schema auto-generated/validated
3. **Permissions**: Checked against `meta/Resource.json`
4. **Database**: Table auto-created if needed
5. **Response**: JSON with success/error status

The system use your frontend data structure and automatically:
- Creates SQLite tables with appropriate column types
- Generates Zod validation schemas
- Sets up permission defaults
- Provides admin interface for management

Perfect for rapid prototyping and dynamic applications!
