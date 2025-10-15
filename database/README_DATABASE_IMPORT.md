# Elara Database Import Guide

## Overview
This folder contains the database import scripts and SQL files for the Elara Finance Dashboard application.

## Files Included
- `elara_db_import.sql` - Complete database structure and sample data
- `import-database.bat` - Windows batch script for import
- `import-database.sh` - Linux/Mac shell script for import  
- `import-database.js` - Node.js script for import (recommended)

## Prerequisites
1. **MySQL Server** installed and running
2. **MySQL credentials** configured in `.env` file
3. **Node.js** installed (for Node.js import method)

## Import Methods

### Method 1: Node.js Script (Recommended)
```bash
cd database
node import-database.js
```

### Method 2: Windows Batch Script
```bash
cd database
import-database.bat
```

### Method 3: Linux/Mac Shell Script
```bash
cd database
chmod +x import-database.sh
./import-database.sh
```

### Method 4: Manual MySQL Import
```bash
mysql -h localhost -u root -p < database/elara_db_import.sql
```

## Database Structure

### Tables Created:
1. **departments** - Department master data
2. **divisions** - Division master data  
3. **entitas** - Entity master data
4. **users** - User accounts and authentication
5. **datasets** - Dataset metadata and upload tracking
6. **dataset_records** - Financial transaction data (36+ columns)
7. **audit_trail** - Complete system activity logging

### Sample Data Included:
- **Admin User**: admin@elara.com / Admin123!
- **Regular User**: user@elara.com / User123!
- **Sample Departments**: Finance, IT, Operations, HR, Marketing
- **Sample Divisions**: Corporate, Regional, Branch, Support
- **Sample Entities**: PT Kisel Group, PT Kisel Finance, PT Kisel Technology

## Environment Configuration
Ensure your `.env` file contains:
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=elara_db
DB_USER=root
DB_PASSWORD=your_password
```

## Post-Import Steps
1. Verify database connection: `npm run migrate`
2. Start the application: `npm start`
3. Login with admin credentials
4. Upload sample financial data via Dataset Management

## Troubleshooting

### Common Issues:
1. **Access Denied**: Check MySQL credentials in `.env`
2. **Connection Refused**: Ensure MySQL server is running
3. **Database Exists**: Drop existing database if needed
4. **Permission Error**: Run as administrator/sudo if needed

### Verification Commands:
```sql
USE elara_db;
SHOW TABLES;
SELECT COUNT(*) FROM users;
SELECT * FROM users WHERE role = 'admin';
```

## Security Notes
- Change default passwords after first login
- Use strong passwords in production
- Configure proper MySQL user permissions
- Enable SSL for production deployments

## Support
For issues with database import, check:
1. MySQL server status
2. Environment variables in `.env`
3. Network connectivity
4. User permissions

The import creates a complete Elara database ready for production use with proper indexes, foreign keys, and sample data for testing.