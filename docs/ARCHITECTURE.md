# Elara Architecture Documentation

## System Overview

Elara is an enterprise-grade microservices-based financial dashboard application designed for enterprise-scale data processing and analytics with comprehensive monitoring, security, and observability features.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Web Browser   │    │   Mobile App    │
│    (nginx)      │    │   (Frontend)    │    │   (Future)      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │     API Gateway           │
                    │   (Express.js:3000)       │
                    └─────────────┬─────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼───────┐    ┌───────────▼───────────┐    ┌───────▼───────┐
│ Python Upload │    │   Database Service    │    │ Amazon Q      │
│ Service:5000  │    │   (Python):5001       │    │ Business      │
└───────┬───────┘    └───────────┬───────────┘    └───────┬───────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      MySQL Database       │
                    │        (Port 3306)        │
                    └───────────────────────────┘
```

## Component Architecture

### 1. Frontend Layer (SPA)
```
Frontend (Vanilla JS)
├── Authentication Module
├── Dashboard Module  
├── User Management Module
├── Dataset Management Module
├── Profile Module
├── Audit Module
└── Q Business Integration
```

**Technologies**: Vanilla JavaScript, Chart.js, CSS Grid, WebSockets

### 2. API Gateway (Node.js)
```
Express.js Server (Port 3000)
├── Performance Monitoring Middleware (Correlation IDs)
├── Input Sanitization Middleware (XSS Protection)
├── Authentication Middleware (JWT)
├── Tiered Rate Limiting Middleware
├── Audit Logging Middleware
├── Enhanced Security Headers (Helmet)
├── CORS Configuration
└── Route Handlers
    ├── /api/auth (10 req/15min)
    ├── /api/dashboard
    ├── /api/users
    ├── /api/datasets (5 req/min upload)
    ├── /api/profile
    ├── /api/audit
    ├── /api/qbusiness
    └── /health (comprehensive monitoring)
```

### 3. Microservices Layer

#### Python Upload Service (Port 5000)
```python
Flask Application
├── Excel/CSV Processing (Pandas)
├── Data Validation
├── Batch Processing
├── Memory Optimization
└── Error Handling
```

#### Database Service (Port 5001)
```python
Flask Application  
├── High-Performance Insertion
├── Connection Pooling (15 connections)
├── Transaction Management
├── Batch Operations
└── Health Monitoring
```

### 4. Data Layer
```
MySQL Database (elara_db)
├── users (Authentication & Profiles)
├── datasets (Dataset Metadata)
├── dataset_records (Financial Data)
├── audit_trail (Activity Logging)
└── Indexes & Optimizations
```

## Data Flow Architecture

### 1. Authentication Flow
```
User Login → JWT Generation → Token Storage → API Authorization
     ↓              ↓              ↓              ↓
  Validation → Database Check → Session Create → Access Control
```

### 2. File Upload Flow
```
File Selection → Size Check → Chunking (>50MB) → Python Service
      ↓              ↓              ↓                    ↓
  Validation → Progress Track → Batch Process → Database Insert
      ↓              ↓              ↓                    ↓
  Audit Log → Status Update → Completion → Dashboard Refresh
```

### 3. Dashboard Data Flow
```
Filter Selection → Query Building → Database Query → Data Processing
       ↓               ↓               ↓               ↓
   Caching Check → Performance Opt → Result Format → Chart Rendering
```

## Security Architecture

### 1. Authentication & Authorization
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │ API Gateway │    │  Database   │
│             │    │             │    │             │
│ JWT Token   │───▶│ Verify JWT  │───▶│ User Check  │
│             │    │             │    │             │
│ Role Check  │◀───│ RBAC Logic  │◀───│ Role Data   │
└─────────────┘    └─────────────┘    └─────────────┘
```

### 2. Data Protection
- **Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Input Validation**: Express-validator, file type checking
- **SQL Injection**: Prepared statements, parameterized queries
- **XSS Protection**: Content Security Policy, input sanitization

### 3. Audit Trail
```
User Action → Middleware Capture → Database Log → Audit Dashboard
     ↓              ↓                    ↓              ↓
  Timestamp → IP/User Agent → Change Tracking → Compliance Report
```

## Performance Architecture

### 1. Database Optimization
```sql
-- Indexes for performance
CREATE INDEX idx_dataset_records_company ON dataset_records(company_code);
CREATE INDEX idx_dataset_records_date ON dataset_records(date);
CREATE INDEX idx_audit_trail_user ON audit_trail(user_id, created_at);
```

### 2. Caching Strategy
```
Browser Cache (Static Assets) → CDN → Application Cache → Database
     ↓                           ↓           ↓              ↓
  CSS/JS/Images → Global Assets → Query Results → Raw Data
```

### 3. Connection Pooling
```
Application Layer: 20 connections
Upload Service: 10 connections  
Database Service: 15 connections
Total Pool: 45 concurrent connections
```

## Scalability Architecture

### 1. Horizontal Scaling
```
Load Balancer
├── App Instance 1 (Port 3000)
├── App Instance 2 (Port 3001)  
└── App Instance N (Port 300N)
```

### 2. Database Scaling
```
Master Database (Write)
├── Read Replica 1
├── Read Replica 2
└── Read Replica N
```

### 3. Microservice Scaling
```
Service Discovery
├── Upload Service Pool (5000-5009)
├── DB Service Pool (5001-5010)
└── Health Check Service
```

## Deployment Architecture

### 1. Environment Structure
```
Development → Staging → Production
     ↓           ↓          ↓
  Local DB → Test DB → Prod DB Cluster
     ↓           ↓          ↓
  Mock APIs → Beta APIs → Live APIs
```

### 2. Container Architecture
```dockerfile
# Multi-stage Docker build
FROM node:18-alpine AS builder
FROM python:3.9-alpine AS python-services  
FROM nginx:alpine AS reverse-proxy
```

### 3. Infrastructure
```
Cloud Provider (AWS/Azure)
├── Application Servers (EC2/VM)
├── Database Cluster (RDS/SQL)
├── File Storage (S3/Blob)
├── Load Balancer (ALB/LB)
└── Monitoring (CloudWatch/Monitor)
```

## Monitoring Architecture

### 1. Application Monitoring
```
Structured Logs (Correlation IDs) → Log Rotation → Dashboard
     ↓                              ↓               ↓
  Error Track + Performance → Alert System → Notification
```

### 2. Performance Monitoring
```
Request Timing + Memory → Performance Metrics → Health Dashboard
       ↓                      ↓                     ↓
   Slow Requests (>1000ms) → Memory Alerts → Visual Analytics
```

### 3. Health Checks
```
/health endpoint → Service Status + Metrics → Load Balancer Decision
      ↓                     ↓                        ↓
  DB + Services → Response Time + Memory → Traffic Routing
```

### 4. Security Monitoring
```
XSS Attempts → Security Logs → Alert System
     ↓              ↓               ↓
 Rate Limiting → Audit Trail → Compliance Reports
```

## Integration Architecture

### 1. Amazon Q Business
```
Elara Frontend → Q Business Embed → AWS Q Service
      ↓               ↓                   ↓
  User Context → Authentication → Financial Data Query
```

### 2. Email Integration
```
User Action → Email Trigger → SMTP Service → Email Delivery
     ↓             ↓              ↓              ↓
  Password Reset → Template → Gmail/Outlook → User Inbox
```

## Disaster Recovery Architecture

### 1. Backup Strategy
```
Database Backup (Daily) → File Backup (Hourly) → Config Backup (Weekly)
       ↓                        ↓                        ↓
  MySQL Dump → Upload Directory → Environment Files
       ↓                        ↓                        ↓
  Remote Storage → Cloud Storage → Version Control
```

### 2. Recovery Procedures
```
Incident Detection → Service Isolation → Backup Restore → Service Restart
        ↓                   ↓                ↓               ↓
   Alert System → Traffic Redirect → Data Recovery → Health Verification
```

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Vanilla JS, Chart.js | User Interface |
| API Gateway | Node.js, Express | Request Routing |
| Services | Python Flask | Data Processing |
| Database | MySQL 8.0 | Data Storage |
| Security | JWT, Helmet | Authentication |
| Monitoring | Winston, Custom | Observability |
| Integration | AWS Q Business | AI Analytics |