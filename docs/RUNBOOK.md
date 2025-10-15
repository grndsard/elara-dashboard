# Elara Operations Runbook

## Quick Start

### Service Startup
```bash
# Start all services
start-all-optimized.bat

# Check service health
check-ports.bat

# Restart if needed
restart.bat
```

### Service Ports
- **Main App**: 3000
- **Python Upload**: 5000  
- **Database Service**: 5001
- **MySQL**: 3306

## Common Issues

### 1. Database Connection Failed
**Symptoms**: Login fails, dashboard empty
**Solution**:
```bash
# Check MySQL service
net start mysql80

# Verify connection
mysql -u root -p -e "SHOW DATABASES;"

# Restart services
restart.bat
```

### 2. Python Services Not Starting
**Symptoms**: Upload fails, processing errors
**Solution**:
```bash
# Check Python installation
python --version

# Install dependencies
cd python_upload_service
pip install -r requirements.txt

# Start manually
python app.py
```

### 3. File Upload Errors
**Symptoms**: Upload stuck, timeout errors
**Solution**:
```bash
# Check disk space
dir uploads\

# Clear temp files
del uploads\temp\*

# Restart upload service
kill-processes.bat
start-all-optimized.bat
```

### 4. Port Conflicts
**Symptoms**: EADDRINUSE errors
**Solution**:
```bash
# Kill conflicting processes
kill-processes.bat

# Check available ports
check-ports.bat

# Change ports in .env if needed
```

## Monitoring

### Health Checks
```bash
# Comprehensive application health with service monitoring
curl http://localhost:3000/health

# Python service health  
curl http://localhost:5000/health

# Database service health
curl http://localhost:5001/health
```

### Performance Monitoring
```bash
# Check application logs with correlation IDs
type logs\combined.log

# Monitor error logs
type logs\error.log

# Check memory usage and performance metrics
curl http://localhost:3000/health | jq '.memory'
```

### Log Locations
- **Application**: `logs/combined.log`
- **Errors**: `logs/error.log`
- **Access**: Console output

### Performance Monitoring
```bash
# Check memory usage
tasklist /fi "imagename eq node.exe"

# Check disk usage
dir uploads\ /s

# Monitor database connections
mysql -e "SHOW PROCESSLIST;"
```

## Backup & Recovery

### Database Backup
```bash
# Daily backup
mysqldump -u root -p elara_db > backup_$(date +%Y%m%d).sql

# Restore from backup
mysql -u root -p elara_db < backup_20240115.sql
```

### File Backup
```bash
# Backup uploads
xcopy uploads\ backup\uploads\ /E /I

# Backup configuration
copy .env backup\.env.backup
```

## Security Maintenance

### Password Policy Enforcement
- Minimum 8 characters
- Must contain uppercase, lowercase, number, special character
- Force change every 90 days

### Audit Trail Monitoring
```bash
# Check failed logins
mysql -e "SELECT * FROM audit_trail WHERE action LIKE '%FAILED%' ORDER BY created_at DESC LIMIT 10;"

# Monitor admin actions
mysql -e "SELECT * FROM audit_trail WHERE user_id IN (SELECT id FROM users WHERE role='admin') ORDER BY created_at DESC LIMIT 20;"
```

## Deployment

### Production Deployment
```bash
# Set environment
set NODE_ENV=production

# Install dependencies
npm install --production

# Run database migrations
npm run migrate

# Start with PM2
pm2 start server.js --name elara
```

### Environment Variables
```env
NODE_ENV=production
DB_HOST=prod-db-server
JWT_SECRET=strong-production-secret
SMTP_HOST=smtp.company.com
```

## Troubleshooting Commands

### Service Status
```bash
# Check all processes
tasklist | findstr "node python mysql"

# Check network connections
netstat -an | findstr "3000 5000 5001 3306"
```

### Database Diagnostics
```bash
# Check table sizes
mysql -e "SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)' FROM information_schema.tables WHERE table_schema = 'elara_db';"

# Check slow queries
mysql -e "SHOW PROCESSLIST;"
```

### Performance Optimization
```bash
# Clear temp files
del uploads\temp\*

# Restart services for memory cleanup
restart.bat

# Optimize database
optimize-database.bat
```

## Emergency Procedures

### Service Down
1. Check logs: `type logs\error.log`
2. Restart services: `restart.bat`
3. Verify health: `check-ports.bat`
4. Contact admin if issues persist

### Data Corruption
1. Stop all services: `kill-processes.bat`
2. Restore from backup
3. Run integrity checks
4. Restart services

### Security Incident
1. Change JWT secret immediately
2. Force password reset for all users
3. Review audit logs
4. Update security policies

## Contact Information
- **System Admin**: admin@company.com
- **Database Admin**: dba@company.com
- **Security Team**: security@company.com