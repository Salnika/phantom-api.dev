# 🐳 Self Hosting with Docker

The Phantom API backend can be deployed using Docker for consistent and portable execution across different environments.

## Features

- **Containerized Backend**: Complete backend API in a Docker container
- **Persistent Storage**: SQLite database persisted via Docker volumes
- **Production Ready**: Optimized multi-stage build for security and performance
- **Multi-service Support**: Backend, admin interface, and database
- **Port Configuration**: Configurable port mapping (default: 3000)
- **Health Monitoring**: Built-in health checks and logging


## Docker Configuration

- **Image publiée**: [`docker.io/salnika/phantom-api.dev:latest`](https://hub.docker.com/r/salnika/phantom-api.dev)
- **Base Image**: `node:22-alpine` (pour build custom, voir Dockerfile)
- **Multi-stage Build**: Optimisé pour la production avec build séparé (si build local)
- **Sécurité**: Exécution utilisateur non-root
- **Volume Mapping**: `/app/data` pour la persistance SQLite
- **Health Checks**: Monitoring intégré
- **Variables d'environnement**: Configurables via `.env`

## Quick Start

### Prerequisites

=== "Docker Requirements"
    - Docker and Docker Compose installed
    - Git repository cloned locally
    - Basic understanding of environment variables

=== "System Requirements"
    ```bash
    # Minimum requirements
    - Docker Engine 20.10+
    - Docker Compose 2.0+
    - 512MB RAM available
    - 2GB disk space
    ```

### 1. Environment Setup

=== "Copy Template"
    ```bash
    # Copy environment template
    cp .env.example .env
    
    # Edit environment variables (REQUIRED)
    nano .env  # or your preferred editor
    ```

=== "Generate JWT Secret"
    ```bash
    # Generate a secure JWT secret (32+ characters)
    openssl rand -base64 32
    
    # Copy output to JWT_SECRET in .env file
    ```

**⚠️ Critical**: Update these values in `.env`:
- `JWT_SECRET` - Must be at least 32 characters
- `ADMIN_EMAIL` - Your admin email  
- `ADMIN_PASSWORD` - Secure password


### 2. Build and Start

=== "Production Mode"
    ```bash
    # Use the published image from Docker Hub
    # (No local build required)
    docker-compose up -d
    
    # Check status
    docker-compose ps
    
    # View logs
    docker-compose logs -f phantom-api
    ```

=== "Development Mode"
    ```bash
    # For local development, build is possible
    echo "NODE_ENV=development" >> .env
    docker-compose up --build
    ```

### 3. Verify Deployment

=== "Health Checks"
    ```bash
    # Check container health
    docker-compose ps
    
    # Test health endpoint
    curl http://localhost:3000/health
    
    # View detailed logs
    docker-compose logs phantom-api
    ```

=== "Service Access"
    - **Backend API**: http://localhost:3000
    - **Admin Interface**: http://localhost:3000/admin
    - **Health Check**: http://localhost:3000/health
    - **API Documentation**: http://localhost:3000/api/docs (if enabled)

## Environment Configuration

### Required Variables

```env
# Security Configuration
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=secure-admin-password

# Server Configuration  
NODE_ENV=production
PORT=3000
DB_PATH=/app/data/phantom.db
```

### Optional Variables

```env
# CORS Configuration
CORS_ORIGIN=http://localhost:5173,http://localhost:5174

# Cookie Security
COOKIE_SECRET=your-cookie-secret-key-change-in-production

# Container Configuration
COMPOSE_PROJECT_NAME=phantom-api
```

### Environment-Specific Settings

=== "Development"
    ```env
    NODE_ENV=development
    PORT=3000
    DB_PATH=./data/phantom.db
    CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175
    ```

=== "Production"
    ```env
    NODE_ENV=production
    PORT=3000
    DB_PATH=/app/data/phantom.db
    CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com
    ```

## Container Management

### Basic Operations

=== "Start/Stop Services"
    ```bash
    # Start services
    docker-compose up -d
    
    # Stop services
    docker-compose down
    
    # Restart services
    docker-compose restart
    
    # Stop and remove volumes (⚠️ DELETES DATA)
    docker-compose down -v
    ```

=== "Monitoring"
    ```bash
    # View logs in real-time
    docker-compose logs -f phantom-api
    
    # Check container status
    docker-compose ps
    
    # View resource usage
    docker stats phantom-api-backend
    
    # Inspect container
    docker inspect phantom-api-backend
    ```

### Advanced Operations

=== "Container Shell Access"
    ```bash
    # Access container shell
    docker-compose exec phantom-api sh
    
    # Run commands in container
    docker-compose exec phantom-api node --version
    docker-compose exec phantom-api ls -la /app/data
    ```

=== "Log Management"
    ```bash
    # View specific log levels
    docker-compose logs phantom-api | grep ERROR
    
    # Export logs
    docker-compose logs phantom-api > phantom-api.log
    
    # Clear logs (restart container)
    docker-compose restart phantom-api
    ```

## Data Persistence

### Database Management

=== "Backup Operations"
    ```bash
    # Create manual backup
    docker-compose exec phantom-api cp /app/data/phantom.db /app/data/backup-$(date +%Y%m%d).db
    
    # Copy backup to host
    docker cp phantom-api-backend:/app/data/backup-$(date +%Y%m%d).db ./backups/
    
    # List backups
    docker-compose exec phantom-api ls -la /app/data/*.db
    ```

=== "Restore Operations"
    ```bash
    # Stop service
    docker-compose stop phantom-api
    
    # Restore from backup
    docker cp ./backups/backup-20241201.db phantom-api-backend:/app/data/phantom.db
    
    # Start service
    docker-compose start phantom-api
    ```

### Volume Management

=== "Volume Inspection"
    ```bash
    # List volumes
    docker volume ls
    
    # Inspect data volume
    docker volume inspect phantom-api_phantom-data
    
    # Backup entire volume
    docker run --rm -v phantom-api_phantom-data:/data -v $(pwd):/backup alpine tar czf /backup/data-backup.tar.gz -C /data .
    ```

=== "Volume Restore"
    ```bash
    # Restore volume from backup
    docker run --rm -v phantom-api_phantom-data:/data -v $(pwd):/backup alpine tar xzf /backup/data-backup.tar.gz -C /data
    ```

## Production Deployment

### Security Checklist

=== "Pre-Deployment"
    - [ ] Changed `JWT_SECRET` to secure random string (32+ chars)
    - [ ] Updated `ADMIN_EMAIL` and `ADMIN_PASSWORD`
    - [ ] Reviewed `CORS_ORIGIN` for production domains
    - [ ] Set `NODE_ENV=production`
    - [ ] Configured HTTPS reverse proxy
    - [ ] Set up automated backups
    - [ ] Configured log rotation

=== "Post-Deployment"
    - [ ] Verified health checks are passing
    - [ ] Tested admin interface access
    - [ ] Confirmed API endpoints respond correctly
    - [ ] Validated database persistence
    - [ ] Set up monitoring alerts
    - [ ] Documented rollback procedures

### Resource Configuration

=== "Production Limits"
    ```yaml
    # Add to docker-compose.yml
    services:
      phantom-api:
        deploy:
          resources:
            limits:
              memory: 512M
              cpus: '0.5'
            reservations:
              memory: 256M
              cpus: '0.25'
    ```

=== "Monitoring Setup"
    ```yaml
    # Health check configuration
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    ```

## Troubleshooting

### Common Issues

=== "Startup Problems"
    **Container won't start:**
    ```bash
    # Check logs for errors
    docker-compose logs phantom-api
    
    # Verify environment variables
    docker-compose config
    
    # Check if port is available
    lsof -i :3000
    ```
    
    **Permission denied:**
    ```bash
    # Fix volume permissions
    sudo chown -R $(id -u):$(id -g) ./data
    
    # Reset container
    docker-compose down && docker-compose up --build
    ```

=== "Runtime Issues"
    **Database connection failed:**
    ```bash
    # Verify database file exists
    docker-compose exec phantom-api ls -la /app/data/
    
    # Check database permissions
    docker-compose exec phantom-api stat /app/data/phantom.db
    
    # Recreate database
    docker-compose exec phantom-api rm /app/data/phantom.db
    docker-compose restart phantom-api
    ```
    
    **API not responding:**
    ```bash
    # Check container health
    docker-compose ps
    
    # Test internal connectivity
    docker-compose exec phantom-api curl http://localhost:3000/health
    
    # Verify port mapping
    docker port phantom-api-backend
    ```

### Reset and Recovery

=== "Soft Reset"
    ```bash
    # Restart services
    docker-compose restart
    
    # Rebuild without cache
    docker-compose build --no-cache
    docker-compose up -d
    ```

=== "Hard Reset"
    ```bash
    # ⚠️ WARNING: This will delete all data
    
    # Stop and remove everything
    docker-compose down -v
    
    # Remove images
    docker rmi phantom-api_phantom-api
    
    # Start fresh
    docker-compose up --build -d
    ```

## Advanced Configuration

### Reverse Proxy Setup

=== "Nginx Configuration"
    ```nginx
    server {
        listen 80;
        server_name api.yourdomain.com;
        
        location / {
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    ```

=== "Traefik Labels"
    ```yaml
    # Add to docker-compose.yml
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.phantom-api.rule=Host(`api.yourdomain.com`)"
      - "traefik.http.routers.phantom-api.tls=true"
      - "traefik.http.routers.phantom-api.tls.certresolver=letsencrypt"
    ```

### Multi-Environment Setup

=== "Development"
    ```bash
    # docker-compose.dev.yml
    version: '3.8'
    services:
      phantom-api:
        environment:
          - NODE_ENV=development
        volumes:
          - ./backend:/app/backend:ro
        command: ["yarn", "dev"]
    ```

=== "Production"
    ```bash
    # docker-compose.prod.yml
    version: '3.8'
    services:
      phantom-api:
        restart: unless-stopped
        logging:
          driver: "json-file"
          options:
            max-size: "10m"
            max-file: "3"
    ```
