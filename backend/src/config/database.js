import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME     || 'pdf_security',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  // Don't convert timezone — store/read dates as-is matching MySQL server time
  timezone: 'local',
});

export const db = {
  /** Run a query. Params use ? placeholders (MySQL style). */
  async query(sql, params) {
    try {
      const [rows, fields] = await pool.execute(sql, params || []);
      // For SELECT → rows is an array
      // For INSERT/UPDATE/DELETE → rows is a ResultSetHeader
      const isResultSet = Array.isArray(rows);
      return {
        rows:      isResultSet ? rows : [],
        rowCount:  isResultSet ? rows.length : (rows.affectedRows ?? 0),
        insertId:  isResultSet ? null : (rows.insertId ?? null),
      };
    } catch (error) {
      console.error('Database query error:', error.message);
      throw error;
    }
  },

  async testConnection() {
    try {
      const [rows] = await pool.execute('SELECT 1');
      console.log('Database connected successfully');
      return true;
    } catch (error) {
      console.error('Database connection failed:', error.message);
      return false;
    }
  },

  async end() {
    await pool.end();
  },
};
