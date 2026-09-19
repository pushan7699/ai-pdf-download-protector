import { db } from '../config/database.js';

export class SessionModel {
  static async create(userId, documentId, sessionToken, expiresAt, ipAddress, userAgent) {
    const id = crypto.randomUUID();
    // Let MySQL compute expires_at as NOW() + 2 hours to avoid timezone mismatch
    await db.query(
      `INSERT INTO sessions (id, user_id, document_id, session_token, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 HOUR), ?, ?)`,
      [id, userId, documentId, sessionToken, ipAddress || null, userAgent || null]
    );
    return await this.findById(id);
  }

  static async findByToken(sessionToken) {
    const { rows } = await db.query(
      'SELECT * FROM sessions WHERE session_token = ?',
      [sessionToken]
    );
    return rows[0] || null;
  }

  static async findById(id) {
    const { rows } = await db.query('SELECT * FROM sessions WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async validate(sessionToken) {
    // Use NOW() so the comparison is in the same timezone as the stored value
    const { rows } = await db.query(
      `SELECT * FROM sessions
       WHERE session_token = ?
         AND is_active = 1
         AND expires_at > NOW()
         AND revoked_at IS NULL`,
      [sessionToken]
    );
    return rows[0] || null;
  }

  static async updateActivity(sessionToken) {
    await db.query(
      `UPDATE sessions SET last_activity = NOW(), page_views = page_views + 1
       WHERE session_token = ?`,
      [sessionToken]
    );
  }

  static async revoke(id) {
    await db.query(
      'UPDATE sessions SET is_active = 0, revoked_at = NOW() WHERE id = ?',
      [id]
    );
  }

  static async revokeUserSessions(userId, documentId) {
    if (documentId) {
      await db.query(
        'UPDATE sessions SET is_active = 0, revoked_at = NOW() WHERE user_id = ? AND document_id = ? AND is_active = 1',
        [userId, documentId]
      );
    } else {
      await db.query(
        'UPDATE sessions SET is_active = 0, revoked_at = NOW() WHERE user_id = ? AND is_active = 1',
        [userId]
      );
    }
  }

  static async getActiveSessions(userId, documentId) {
    if (documentId) {
      const { rows } = await db.query(
        'SELECT * FROM sessions WHERE user_id = ? AND document_id = ? AND is_active = 1 AND expires_at > NOW()',
        [userId, documentId]
      );
      return rows;
    }
    const { rows } = await db.query(
      'SELECT * FROM sessions WHERE user_id = ? AND is_active = 1 AND expires_at > NOW()',
      [userId]
    );
    return rows;
  }

  static async getActiveSessionCount(userId, documentId) {
    const { rows } = await db.query(
      'SELECT COUNT(*) AS count FROM sessions WHERE user_id = ? AND document_id = ? AND is_active = 1 AND expires_at > NOW()',
      [userId, documentId]
    );
    return parseInt(rows[0].count);
  }
}
