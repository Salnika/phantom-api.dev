-- PostgreSQL initialization script for Phantom API
-- This script is executed when the PostgreSQL container starts for the first time

-- Create additional database user if needed (optional)
-- CREATE USER phantom_readonly WITH PASSWORD 'readonly_password';

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom functions for UUID generation (compatible with Phantom API)
CREATE OR REPLACE FUNCTION generate_phantom_uuid()
RETURNS TEXT AS $$
BEGIN
    RETURN uuid_generate_v4()::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions to the phantom user
GRANT ALL PRIVILEGES ON DATABASE phantom_api TO phantom_user;
GRANT USAGE ON SCHEMA public TO phantom_user;
GRANT CREATE ON SCHEMA public TO phantom_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO phantom_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO phantom_user;

-- Create a function to update timestamp on record updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Log successful initialization
\echo 'PostgreSQL initialization completed for Phantom API';