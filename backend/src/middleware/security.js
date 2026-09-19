import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { logger, securityLogger } from '../utils/logger.js';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    securityLogger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({ success: false, message: 'Too many requests, please try again later' });
  },
});

export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
});

export const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  const message = config.nodeEnv === 'production' ? 'An error occurred' : err.message;
  res.status(err.status || 500).json({
    success: false,
    message,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: 'Resource not found' });
};

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${Date.now() - start}ms`,
      ip: req.ip,
    });
  });
  next();
};

export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
  );
  next();
};

export const corsOptions = {
  origin: (origin, callback) => {
    const allowed = process.env.CORS_ORIGIN || 'http://localhost:3000';
    // Allow multiple origins separated by comma, or no origin (server-to-server)
    const allowedList = allowed.split(',').map(o => o.trim());
    if (!origin || allowedList.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token'],
  exposedHeaders: ['Content-Disposition'],
};

export const sanitizeBody = (req, res, next) => {
  if (req.body) {
    const sanitize = (obj) => {
      if (typeof obj === 'string') return obj.replace(/[<>]/g, '');
      if (Array.isArray(obj)) return obj.map(sanitize);
      if (typeof obj === 'object' && obj !== null) {
        const out = {};
        for (const key in obj) out[key] = sanitize(obj[key]);
        return out;
      }
      return obj;
    };
    req.body = sanitize(req.body);
  }
  next();
};
