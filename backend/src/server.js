import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { db } from './config/database.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
  securityHeaders,
  corsOptions,
  sanitizeBody,
  rateLimiter,
} from './middleware/security.js';

import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import userRoutes from './routes/users.js';
import viewerRoutes from './routes/viewer.js';
import securityRoutes from './routes/security.js';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(securityHeaders);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(sanitizeBody);

// Logging + rate limiting
app.use(requestLogger);
app.use('/api/', rateLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', documentRoutes);
app.use('/api', userRoutes);
app.use('/api', viewerRoutes);
app.use('/api', securityRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.port;
const HOST = config.host;

async function startServer() {
  try {
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      logger.warn('⚠️  Database not connected — run PostgreSQL and set DB_* env vars');
      logger.warn('   Run: npm run migrate  then  npm run seed');
    }
  } catch (error) {
    logger.warn('Database connection failed — server starting without DB');
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`✅ Server running on http://${HOST}:${PORT}`);
    logger.info(`📋 Health: http://localhost:${PORT}/health`);
    logger.info(`🔑 Auth:   http://localhost:${PORT}/api/auth/login`);
    logger.info(`📄 Docs:   http://localhost:${PORT}/api/documents`);
  });
}

process.on('SIGTERM', async () => { await db.end(); process.exit(0); });
process.on('SIGINT',  async () => { await db.end(); process.exit(0); });

startServer();

export default app;
