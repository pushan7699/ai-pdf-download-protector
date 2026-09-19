import { db } from '../config/database.js';
import { logger } from './logger.js';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    logger.info('Starting database migration...');

    // Read schema file
    const schemaPath = path.join(__dirname, '../../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    await db.query(schema);

    logger.info('Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
