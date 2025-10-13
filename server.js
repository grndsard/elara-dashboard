require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('./utils/logger');
const { requestLogger, errorLogger } = require('./middleware/logging');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/users');
const datasetRoutes = require('./routes/datasets');
const auditRoutes = require('./routes/audit');
const profileRoutes = require('./routes/profile');
const qBusinessRoutes = require('./routes/qbusiness');

const app = express();
const PORT = process.env.PORT || 3000;

// Check if port is available
const net = require('net');
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', () => resolve(false));
  });
}

// Request logging middleware
app.use(requestLogger);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 1000,
  message: 'Too many requests from this IP',
  skip: (req) => req.url === '/favicon.ico'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://yourdomain.com' : 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '300mb' }));
app.use(express.urlencoded({ extended: true, limit: '300mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/qbusiness', qBusinessRoutes);

// Add comprehensive audit logging to all routes
const { comprehensiveAuditMiddleware } = require('./middleware/comprehensive-audit');
app.use(comprehensiveAuditMiddleware);

// API 404 handler - must come before catch-all
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error logging middleware
app.use(errorLogger);

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Global error handler triggered', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({ 
    success: false, 
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

const server = app.listen(PORT, () => {
  logger.info(`Elara server started on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  });
  console.log(`\n🚀 Elara Finance Dashboard is running!`);
  console.log(`📊 Frontend: http://localhost:${PORT}`);
  console.log(`🐍 Python Service: http://localhost:5000`);
  console.log(`\n💡 Use Ctrl+C to stop the server\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use!`);
    console.error(`\n💡 Solutions:`);
    console.error(`   1. Run: kill-processes.bat`);
    console.error(`   2. Or use: restart.bat`);
    console.error(`   3. Or change PORT in .env file\n`);
    process.exit(1);
  } else {
    logger.error('Server error:', err);
    throw err;
  }
});