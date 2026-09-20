import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '../../../database/schema.sql');

async function migrate() {
  console.log('Connecting to database...');

  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  console.log('Connected! Running schema...');

  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Split on semicolons and run each statement individually
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let count = 0;
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      count++;
      process.stdout.write('.');
    } catch (err) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.message.includes('already exists')) {
        process.stdout.write('s'); // skipped
      } else {
        console.error(`\nError on statement: ${stmt.substring(0, 80)}...`);
        console.error(err.message);
      }
    }
  }

  await conn.end();
  console.log(`\n✅ Migration complete — ${count} statements executed.`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
