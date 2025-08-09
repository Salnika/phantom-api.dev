# PostgreSQL and Redis Integration Guide

This guide explains how to use PostgreSQL as the database and Redis for caching in the Phantom API project.

## Overview

The Phantom API now supports:
- **Database flexibility**: SQLite (development) or PostgreSQL (production)
- **Redis caching**: Intelligent caching layer for improved performance
- **Graceful degradation**: Application continues if Redis is unavailable
- **Migration utilities**: Easy migration from SQLite to PostgreSQL

## Quick Start

### 1. Using Docker Compose (Recommended)

```bash
# Start all services (PostgreSQL + Redis + Phantom API)
docker compose up -d

# View logs
docker compose logs -f phantom-api
```

### 2. Local Development

```bash
# Install dependencies
cd phantom-api-backend
yarn install

# Set environment variables
cp .env.example .env
# Edit .env file with your configuration

# Start PostgreSQL and Redis (using Docker)
docker compose up -d postgres redis

# Start the application
yarn dev
```

## Configuration

### Environment Variables

```bash
# Database Configuration
DATABASE_TYPE=postgresql  # or 'sqlite'

# PostgreSQL Settings
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=phantom_api
POSTGRES_USER=phantom_user
POSTGRES_PASSWORD=phantom_password
POSTGRES_SSL=false
POSTGRES_POOL_SIZE=10

# Redis Caching
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
CACHE_TTL=300  # 5 minutes default
```

### Database Selection

The application automatically selects the database based on `DATABASE_TYPE`:
- `sqlite` (default): Uses SQLite for development
- `postgresql`: Uses PostgreSQL for production

## PostgreSQL Features

### Dynamic Table Creation
- Tables are created automatically from API calls
- Schema evolution: new columns added when new fields are detected
- Foreign key relationships maintained
- All existing dynamic functionality preserved

### Type Mapping
```
JavaScript → SQLite → PostgreSQL
string     → TEXT   → VARCHAR(255)
text       → TEXT   → TEXT
integer    → INTEGER → INTEGER
boolean    → INTEGER → BOOLEAN
number     → REAL    → DECIMAL
date       → TEXT    → DATE
datetime   → TEXT    → TIMESTAMP
json       → TEXT    → TEXT
```

## Redis Caching

### Cached Data Types

1. **Query Results**: API responses cached by query parameters
2. **Metadata**: Table schemas and resource definitions
3. **Table Schemas**: Dynamic table structure information
4. **Sessions**: User authentication data (future enhancement)

### Cache Keys Structure

```
phantom:api:resource:{tableName}:query:{hash}
phantom:metadata:{resourceName}
phantom:schema:{tableName}
phantom:session:user:{userId}
```

### Cache Invalidation

- **Automatic**: Cache cleared on CREATE, UPDATE, DELETE operations
- **Manual**: Admin endpoints for cache management
- **TTL-based**: Configurable time-to-live for all cache entries

### Performance Benefits

- **Query Results**: 50-90% faster response times for repeated queries
- **Metadata**: Near-instant schema lookups
- **Reduced Database Load**: Fewer database queries

## Migration from SQLite to PostgreSQL

### Using the Migration CLI

```bash
# Basic migration
yarn migrate:postgres

# With backup and validation
yarn migrate:postgres --backup --validate

# Show help
yarn migrate:postgres:help
```

### Manual Migration Steps

1. **Backup your SQLite database**:
   ```bash
   cp data/phantom.db data/phantom.db.backup
   ```

2. **Set up PostgreSQL**:
   ```bash
   docker compose up -d postgres
   ```

3. **Run migration**:
   ```bash
   yarn migrate:postgres --sqlite-path ./data/phantom.db --backup --validate
   ```

4. **Update environment**:
   ```bash
   # In .env file
   DATABASE_TYPE=postgresql
   ```

5. **Restart application**:
   ```bash
   yarn dev
   ```

### Migration Validation

The migration tool validates:
- All tables are created in PostgreSQL
- Record counts match between SQLite and PostgreSQL
- Schema integrity is maintained
- Foreign key relationships are preserved

## Monitoring and Health Checks

### Health Endpoint

```bash
curl http://localhost:3000/health
```

Response includes:
- Database connection status
- Redis cache status
- Memory usage
- System information

### Cache Status Headers

API responses include cache headers:
- `X-Cache: HIT` - Response served from cache
- `X-Cache: MISS` - Response from database

### Logging

Structured logs include:
- Cache hit/miss rates
- Database query performance
- Redis connection status
- Migration progress

## API Changes

### Caching Middleware

GET endpoints automatically cached:
```
GET /api/users          # Cached for 5 minutes
GET /api/users/123      # Cached for 10 minutes
```

Write operations invalidate cache:
```
POST /api/users         # Invalidates users cache
PUT /api/users/123      # Invalidates users cache
DELETE /api/users/123   # Invalidates users cache
```

### Backward Compatibility

- All existing APIs work unchanged
- SQLite remains the default for development
- Graceful fallback if Redis is unavailable

## Production Deployment

### Docker Compose Production

```yaml
services:
  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    
  phantom-api:
    environment:
      DATABASE_TYPE: postgresql
      REDIS_ENABLED: true
```

### Environment Security

- Use strong passwords for PostgreSQL
- Enable Redis authentication in production
- Use SSL connections where applicable
- Configure proper firewall rules

## Performance Tuning

### PostgreSQL

```bash
# Connection pooling
POSTGRES_POOL_SIZE=20

# SSL for production
POSTGRES_SSL=true
```

### Redis

```bash
# Increase cache TTL for stable data
CACHE_TTL=1800  # 30 minutes

# Use Redis password
REDIS_PASSWORD=secure_password
```

### Application

- Use pagination for large result sets
- Implement query optimization
- Monitor cache hit rates
- Tune cache TTL based on data volatility

## Troubleshooting

### Common Issues

1. **PostgreSQL Connection Failed**
   ```bash
   # Check PostgreSQL status
   docker compose logs postgres
   
   # Verify credentials
   psql -h localhost -U phantom_user -d phantom_api
   ```

2. **Redis Connection Issues**
   ```bash
   # Check Redis status
   docker compose logs redis
   
   # Test connection
   redis-cli -h localhost ping
   ```

3. **Migration Failures**
   ```bash
   # Check logs
   yarn migrate:postgres --verbose
   
   # Validate data manually
   yarn migrate:postgres --dry-run
   ```

### Debug Mode

Enable verbose logging:
```bash
NODE_ENV=development
DEBUG=phantom:*
```

## Development

### Local Development Setup

```bash
# Start databases only
docker compose up -d postgres redis

# Develop with hot reload
yarn dev

# Run tests
yarn test

# Check cache status
curl http://localhost:3000/health
```

### Testing

```bash
# Run all tests
yarn test

# Test with PostgreSQL
DATABASE_TYPE=postgresql yarn test

# Test cache functionality
REDIS_ENABLED=true yarn test
```

## Next Steps

1. Monitor performance improvements
2. Implement additional caching strategies
3. Add cache warming for common queries
4. Consider read replicas for PostgreSQL
5. Implement cache analytics

For more information, see:
- [Docker deployment guide](./DOCKER_DEPLOYMENT.md)
- [API documentation](./public-doc/docs/api-reference.md)
- [Project README](./README.md)