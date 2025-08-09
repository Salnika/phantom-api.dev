module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: './phantom-api-backend',
      script: 'yarn',
      args: 'dev',
      interpreter: 'bash',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        JWT_SECRET: process.env.JWT_SECRET || 'development-jwt-secret-key-very-long-and-secure-for-local-development-only-32chars+'
      },
      log_file: './logs/backend.log',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z'
    },
    {
      name: 'admin',
      cwd: './admin-interface',
      script: 'yarn',
      args: 'dev',
      interpreter: 'bash',
      env: {
        NODE_ENV: 'development',
        PORT: 5173
      },
      log_file: './logs/admin-interface.log',
      error_file: './logs/admin-interface-error.log',
      out_file: './logs/admin-interface-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z'
    },
    {
      name: 'website',
      cwd: './website',
      script: 'yarn',
      args: 'dev',
      interpreter: 'bash',
      env: {
        NODE_ENV: 'development',
        PORT: 5175
      },
      log_file: './logs/website.log',
      error_file: './logs/website-error.log',
      out_file: './logs/website-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z'
    },
    {
      name: 'public-doc',
      cwd: './public-doc',
      script: 'npx',
      args: 'serve site -l 8000',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        PORT: 8000
      },
      log_file: './logs/public-doc.log',
      error_file: './logs/public-doc-error.log',
      out_file: './logs/public-doc-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z'
    }
  ]
};
