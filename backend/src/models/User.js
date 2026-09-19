import { db } from '../config/database.js';
import { HashUtil } from '../utils/hash.js';

export class UserModel {
  static async create(email, password, fullName, role = 'user') {
    const passwordHash = await HashUtil.hashPassword(password);
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)`,
      [id, email, passwordHash, fullName, role]
    );
    return await this.findById(id);
  }

  static async findByEmail(email) {
    const { rows } = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  }

  static async findById(id) {
    const { rows } = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByIdSafe(id) {
    const { rows } = await db.query(
      'SELECT id, email, full_name, role, is_blocked, created_at, updated_at, last_login FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async updateLastLogin(id) {
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [id]);
  }

  static async incrementFailedAttempts(email) {
    await db.query(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE
             WHEN failed_login_attempts + 1 >= 5
             THEN DATE_ADD(NOW(), INTERVAL 15 MINUTE)
             ELSE locked_until
           END
       WHERE email = ?`,
      [email]
    );
  }

  static async resetFailedAttempts(email) {
    await db.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = ?',
      [email]
    );
  }

  static async isLocked(email) {
    const { rows } = await db.query(
      'SELECT locked_until FROM users WHERE email = ?',
      [email]
    );
    if (!rows[0]) return false;
    const { locked_until } = rows[0];
    return locked_until && new Date(locked_until) > new Date();
  }

  static async blockUser(id) {
    await db.query('UPDATE users SET is_blocked = 1 WHERE id = ?', [id]);
  }

  static async unblockUser(id) {
    await db.query(
      'UPDATE users SET is_blocked = 0, failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [id]
    );
  }

  static async getAll(limit = 50, offset = 0) {
    const { rows } = await db.query(
      'SELECT id, email, full_name, role, is_blocked, created_at, last_login FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return rows;
  }

  static async delete(id) {
    await db.query('DELETE FROM users WHERE id = ?', [id]);
  }

  static async verifyPassword(user, password) {
    return await HashUtil.comparePassword(password, user.password_hash);
  }
}
