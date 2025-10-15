# Elara Deployment Guide

## Production Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database optimized and backed up
- [ ] SSL certificates installed
- [ ] Security headers configured
- [ ] Monitoring tools setup
- [ ] Load balancer configured

### Environment Setup

#### 1. Production Environment Variables
```env
NODE_ENV=production
PORT=3000

# Database
DB_HOST=prod-mysql-cluster.company.com
DB_PORT=3306
DB_NAME=elara_prod
DB_USER=elara_app
DB_PASSWORD=SecureProductionPassword123!
DB_MAX_CONNECTIONS=50

# Security
JWT_SECRET=SuperSecureProductionJWTSecret2024!
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=500

# Email
SMTP_HOST=smtp.company.com
SMTP_PORT=587
SMTP_USER=noreply@company.com
SMTP_PASS=EmailServicePassword
FROM_EMAIL=noreply@elara.company.com

# Services
PYTHON_SERVICE_URL=http://internal-lb:5000
DB_SERVICE_URL=http://internal-lb:5001

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
Q_BUSINESS_APPLICATION_ID=app-123...
```

#### 2. Database Setup
```sql
-- Create production database
CREATE DATABASE elara_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create application user
CREATE USER 'elara_app'@'%' IDENTIFIED BY 'SecureProductionPassword123!';
GRANT SELECT, INSERT, UPDATE, DELETE ON elara_prod.* TO 'elara_app'@'%';
FLUSH PRIVILEGES;

-- Run migrations
npm run migrate

-- Insert initial admin user
npm run seed
```

#### 3. SSL Configuration (nginx)
```nginx
server {
    listen 443 ssl http2;
    server_name elara.company.com;
    
    ssl_certificate /etc/ssl/certs/elara.crt;
    ssl_certificate_key /etc/ssl/private/elara.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api/datasets/upload {
        client_max_body_size 300M;
        proxy_pass http://localhost:3000;
        proxy_read_timeout 300s;
    }
}

server {
    listen 80;
    server_name elara.company.com;
    return 301 https://$server_name$request_uri;
}
```

## Docker Deployment

### 1. Dockerfile
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM python:3.9-alpine AS python-builder
WORKDIR /app
COPY python_upload_service/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

FROM node:18-alpine AS production
WORKDIR /app

# Copy Node.js dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Install Python and dependencies
RUN apk add --no-cache python3 py3-pip
COPY --from=python-builder /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages

EXPOSE 3000 5000 5001
CMD ["npm", "start"]
```

### 2. Docker Compose
```yaml
version: '3.8'
services:
  elara-app:
    build: .
    ports:
      - "3000:3000"
      - "5000:5000"
      - "5001:5001"
    environment:
      - NODE_ENV=production
    depends_on:
      - mysql
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: elara_prod
      MYSQL_USER: elara_app
      MYSQL_PASSWORD: apppassword
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - elara-app

volumes:
  mysql_data:
```

## Kubernetes Deployment

### 1. Deployment YAML
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elara-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: elara
  template:
    metadata:
      labels:
        app: elara
    spec:
      containers:
      - name: elara
        image: elara:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: elara-secrets
              key: db-host
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

### 2. Service YAML
```yaml
apiVersion: v1
kind: Service
metadata:
  name: elara-service
spec:
  selector:
    app: elara
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## PM2 Deployment

### 1. PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'elara-main',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log'
  }, {
    name: 'elara-python-upload',
    script: 'python_upload_service/app.py',
    interpreter: 'python3',
    instances: 2,
    env: {
      FLASK_ENV: 'production'
    }
  }, {
    name: 'elara-db-service',
    script: 'db_service/app.py',
    interpreter: 'python3',
    instances: 2,
    env: {
      FLASK_ENV: 'production'
    }
  }]
};
```

### 2. PM2 Commands
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# Logs
pm2 logs

# Restart
pm2 restart all

# Auto-startup
pm2 startup
pm2 save
```

## Database Optimization

### 1. Production Indexes
```sql
-- Performance indexes
CREATE INDEX idx_dataset_records_company_date ON dataset_records(company_code, date);
CREATE INDEX idx_dataset_records_account_group ON dataset_records(account_group_name);
CREATE INDEX idx_audit_trail_user_action ON audit_trail(user_id, action, created_at);
CREATE INDEX idx_users_email_status ON users(email, status);

-- Composite indexes for dashboard queries
CREATE INDEX idx_dataset_records_filters ON dataset_records(dataset_id, company_code, location_parent_code, month);
```

### 2. MySQL Configuration
```ini
# /etc/mysql/mysql.conf.d/mysqld.cnf
[mysqld]
innodb_buffer_pool_size = 2G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
query_cache_size = 128M
max_connections = 200
innodb_thread_concurrency = 16
```

## Monitoring Setup

### 1. Comprehensive Health Check Endpoint
```javascript
// Enhanced health check with service monitoring
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {},
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
  
  let overallHealthy = true;
  
  // Database health check with response time
  try {
    const startTime = Date.now();
    await db.execute('SELECT 1');
    health.services.database = { 
      status: 'healthy', 
      responseTime: Date.now() - startTime 
    };
  } catch (error) {
    health.services.database = { status: 'unhealthy', error: error.message };
    overallHealthy = false;
  }
  
  // Python services health check
  // ... additional service checks
  
  health.status = overallHealthy ? 'healthy' : 'unhealthy';
  res.status(overallHealthy ? 200 : 503).json(health);
});
```

### 2. Log Aggregation
```javascript
// Enhanced logging
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
```

## Security Hardening

### 1. Security Headers
```javascript
// Enhanced helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 2. Rate Limiting
```javascript
// Production rate limiting
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);
```

## Backup Strategy

### 1. Database Backup
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u elara_app -p elara_prod > /backups/elara_${DATE}.sql
gzip /backups/elara_${DATE}.sql

# Keep only last 30 days
find /backups -name "elara_*.sql.gz" -mtime +30 -delete
```

### 2. File Backup
```bash
#!/bin/bash
# file-backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backups/uploads_${DATE}.tar.gz uploads/
aws s3 cp /backups/uploads_${DATE}.tar.gz s3://elara-backups/
```

## Post-Deployment Verification

### 1. Smoke Tests
```bash
# Health check
curl -f https://elara.company.com/health

# Login test
curl -X POST https://elara.company.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@elara.com","password":"Admin123!"}'

# Dashboard test
curl -H "Authorization: Bearer $TOKEN" \
  https://elara.company.com/api/dashboard/data
```

### 2. Performance Tests
```bash
# Load testing with Apache Bench
ab -n 1000 -c 10 https://elara.company.com/

# Database performance
mysql -e "SHOW PROCESSLIST; SHOW STATUS LIKE 'Threads%';"
```

## Rollback Procedures

### 1. Application Rollback
```bash
# PM2 rollback
pm2 stop all
git checkout previous-stable-tag
npm install
pm2 start ecosystem.config.js
```

### 2. Database Rollback
```bash
# Restore from backup
mysql -u elara_app -p elara_prod < /backups/elara_backup.sql
```