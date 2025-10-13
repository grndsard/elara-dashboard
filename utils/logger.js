const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Log levels
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'INFO';
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
    }

    writeToFile(filename, content) {
        const filePath = path.join(logsDir, filename);
        fs.appendFileSync(filePath, content);
    }

    shouldLog(level) {
        return LOG_LEVELS[level] <= LOG_LEVELS[this.logLevel];
    }

    error(message, meta = {}) {
        if (!this.shouldLog('ERROR')) return;
        const logMessage = this.formatMessage('ERROR', message, meta);
        console.error(logMessage.trim());
        this.writeToFile('error.log', logMessage);
        this.writeToFile('combined.log', logMessage);
    }

    warn(message, meta = {}) {
        if (!this.shouldLog('WARN')) return;
        const logMessage = this.formatMessage('WARN', message, meta);
        console.warn(logMessage.trim());
        this.writeToFile('combined.log', logMessage);
    }

    info(message, meta = {}) {
        if (!this.shouldLog('INFO')) return;
        const logMessage = this.formatMessage('INFO', message, meta);
        console.log(logMessage.trim());
        this.writeToFile('combined.log', logMessage);
    }

    debug(message, meta = {}) {
        if (!this.shouldLog('DEBUG')) return;
        const logMessage = this.formatMessage('DEBUG', message, meta);
        console.log(logMessage.trim());
        this.writeToFile('debug.log', logMessage);
        this.writeToFile('combined.log', logMessage);
    }

    // HTTP request logging
    logRequest(req, res, responseTime) {
        const meta = {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            userId: req.user?.id || 'anonymous'
        };
        
        if (res.statusCode >= 400) {
            this.error(`HTTP ${res.statusCode} - ${req.method} ${req.originalUrl}`, meta);
        } else {
            this.info(`HTTP ${res.statusCode} - ${req.method} ${req.originalUrl}`, meta);
        }
    }

    // Database operation logging
    logDatabase(operation, table, meta = {}) {
        this.info(`Database ${operation} on ${table}`, meta);
    }

    // Authentication logging
    logAuth(action, userId, meta = {}) {
        this.info(`Auth: ${action}`, { userId, ...meta });
    }
}

module.exports = new Logger();