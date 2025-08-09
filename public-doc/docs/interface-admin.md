# 🛠️ Admin Interface

The Phantom API includes a modern React-based admin interface for managing resources, viewing logs, and generating API tokens.

## Features

- **Resource Management**: View, create, edit, and delete all resources
- **Schema Editor**: Modify field definitions and permissions via JSON
- **API Token Management**: Generate JWT tokens with specific roles and expiration
- **Log Viewer**: Real-time application and error logs
- **User Management**: Admin authentication and role-based access
- **Responsive Design**: Modern UI built with React and TypeScript

## Access and Authentication

The admin interface is integrated into the backend and accessible at `/admin`.

## Examples

## Getting Started

### Accessing the Interface

With the backend running, access the admin interface at:

```
http://localhost:3000/admin
```

### Default Login

Use the default admin credentials (configurable via environment variables):

- **Email**: `admin@phantom-api.com`
- **Password**: `admin123`

**Security Note**: Change these credentials in production by updating your `.env` file.

## Core Features

### Resource Management

**View Resources**: Browse all available resources (tables) and their data
- Paginated data tables
- Search and filter capabilities
- Sort by any column
- Export data to CSV/JSON

**Create Records**: Add new entries with form validation
- Auto-generated forms based on schema
- Real-time validation
- Relationship selection for foreign keys

**Edit Records**: Update existing entries
- Inline editing capabilities
- History tracking
- Batch operations

**Delete Records**: Remove entries with cascade handling
- Confirmation dialogs
- Soft delete options
- Cascade delete warnings

### Schema Management

**View Schema**: Examine current field definitions and constraints
```json
{
  "fields": {
    "name": { "type": "string", "required": true },
    "email": { "type": "email", "unique": true }
  },
  "permissions": {
    "create": ["user", "admin"],
    "read": ["anon", "user", "admin"]
  }
}
```

### API Token Management

**Generate Tokens**: Create JWT tokens for API access

=== "Admin Interface"
    1. Navigate to "API Tokens" section
    2. Click "Generate New Token"
    3. Select role: `anon`, `user`, or `admin`
    4. Set expiration (optional)
    5. Copy token for use in applications

=== "API Call"
    ```bash
    curl -X POST \
      http://localhost:3000/auth/login \
      -H "Content-Type: application/json" \
      -d '{
        "email": "admin@phantom-api.com",
        "password": "admin123"
      }'
    ```

**Token Roles**:
- **anon**: Read-only access to public resources
- **user**: Can create, read, update own resources
- **admin**: Full access to all operations

**Token Management** (Not implemented yet):
- View active tokens
- Revoke tokens
- Set expiration dates
- Monitor token usage

### Log Viewer

**Application Logs**: View real-time server logs
- Error logs with stack traces
- API request logs
- Database operation logs
- Security audit logs

**Log Features**:
- Real-time updates
- Log level filtering (error, warn, info, debug)
- Search and filter
- Download log files

## Advanced Features

### Bulk Operations

- **Bulk Import**: Upload CSV/JSON files to import data
- **Bulk Export**: Export filtered datasets
- **Bulk Delete**: Delete multiple records with confirmation
- **Bulk Update**: Update multiple records simultaneously

### Relationship Management

- **Visual Relationships**: See connections between resources
- **Cascade Operations**: Understand delete impacts
- **Relationship Editor**: Modify foreign key constraints

### Monitoring Dashboard (not implemented Yet)

- **API Usage**: Request counts and response times
- **Resource Statistics**: Record counts and growth
- **System Health**: Memory, CPU, and database metrics
- **User Activity**: Login attempts and API usage

## Security Features

### Role-Based Access

- **Admin Authentication**: Secure login system
- **Session Management**: Automatic logout and session tokens
- **Permission Checks**: UI adapts based on user permissions

### Data Protection

- **Input Sanitization**: Prevent XSS and injection attacks
- **CSRF Protection**: Secure form submissions
- **Rate Limiting**: Prevent abuse and brute force attacks

## Configuration

### Environment Variables

Configure the admin interface via `.env`:

```env
# Admin Credentials
ADMIN_EMAIL=your-admin@company.com
ADMIN_PASSWORD=secure-password

# Interface Settings
ADMIN_SESSION_TIMEOUT=3600
ADMIN_LOGS_RETENTION=30
```