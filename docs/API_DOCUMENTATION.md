# Elara API Documentation

## Overview
Elara Finance Dashboard REST API provides enterprise-grade secure access to financial data analytics, user management, and dataset operations with comprehensive monitoring and observability.

**Base URL**: `https://api.elara.com/api`  
**Version**: v1.0  
**Authentication**: Bearer JWT Token with correlation ID tracking  
**Security**: Enhanced CSP, XSS protection, input sanitization  
**Monitoring**: Request tracing, performance monitoring, health checks

## Authentication

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "SecurePass123!"
}
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "fullname": "John Doe",
    "email": "user@company.com",
    "role": "admin",
    "forcePasswordChange": false
  }
}
```

## Dashboard Endpoints

### Get Dashboard Data
```http
GET /dashboard/data?dataset=1&entity=COMP001&region=ASIA&month=January
Authorization: Bearer {token}
```

**Query Parameters**:
- `dataset` (optional): Dataset ID filter
- `entity` (optional): Company code filter  
- `region` (optional): Region filter
- `month` (optional): Month filter

**Response**:
```json
{
  "success": true,
  "data": {
    "cards": {
      "totalRevenue": 1500000.00,
      "totalCogs": 1200000.00,
      "totalEbitda": 800000.00,
      "totalNettIncome": 600000.00
    },
    "charts": {
      "revenueByEntity": [
        {"name": "COMP001", "value": 750000.00}
      ]
    }
  }
}
```

## User Management (Admin Only)

### List Users
```http
GET /users?page=1&limit=10&status=active
Authorization: Bearer {token}
```

### Create User
```http
POST /users
Authorization: Bearer {token}
Content-Type: application/json

{
  "fullname": "Jane Smith",
  "email": "jane@company.com",
  "role": "user"
}
```

## Dataset Management

### Upload Dataset
```http
POST /datasets/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

name: "Q1 2025 Financial Data"
file: [Excel/CSV file]
```

## Error Responses

### Standard Error Format
```json
{
  "success": false,
  "message": "Error description",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### HTTP Status Codes
- `200` - Success
- `401` - Unauthorized
- `403` - Forbidden
- `500` - Internal Server Error

## Health Check

### Comprehensive Application Health
```http
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 3600,
  "memory": {
    "rss": 150,
    "heapTotal": 120,
    "heapUsed": 85,
    "external": 25
  },
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 15
    },
    "pythonUploadService": {
      "status": "healthy",
      "responseTime": 25
    },
    "databaseService": {
      "status": "healthy",
      "responseTime": 18
    }
  }
}
```

## Rate Limits (Enhanced)
- **General API**: 500 requests per 15 minutes per IP
- **Authentication**: 10 requests per 15 minutes per IP
- **File Upload**: 5 requests per minute per user
- **Health Check**: Excluded from rate limiting

## File Upload Limits
- **Maximum file size**: 300MB
- **Supported formats**: .xls, .xlsx, .csv
- **Security**: File type validation and XSS protection
- **Monitoring**: Upload attempts logged with correlation IDs