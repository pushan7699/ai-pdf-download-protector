import dotenv from 'dotenv';
dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000'),
  host: process.env.HOST || 'localhost',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'pdf_security',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change_this_secret_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  session: {
    secret: process.env.SESSION_SECRET || 'change_this_session_secret',
    tokenExpiresIn: process.env.SESSION_TOKEN_EXPIRES_IN || '15m',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  storage: {
    path: process.env.STORAGE_PATH || './storage/private',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
  },

  security: {
    lowRiskThreshold: parseInt(process.env.LOW_RISK_THRESHOLD || '30'),
    mediumRiskThreshold: parseInt(process.env.MEDIUM_RISK_THRESHOLD || '60'),
    highRiskThreshold: parseInt(process.env.HIGH_RISK_THRESHOLD || '80'),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },

  admin: {
    defaultEmail: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com',
    defaultPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeThisPassword123!',
  },
};

export default config;
