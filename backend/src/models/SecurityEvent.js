import { db } from '../config/database.js';

export class SecurityEventModel {
  static async create(eventType, severity, description, userId, documentId, sessionId, eventData, ipAddress, userAgent) {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO security_events
         (id, user_id, document_id, session_id, event_type, severity, description, event_data, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId      || null,
        documentId  || null,
        sessionId   || null,
        eventType,
        severity,
        description || null,
        eventData   ? JSON.stringify(eventData) : null,
        ipAddress   || null,
        userAgent   || null,
      ]
    );
    return { id };
  }

  static async getByUser(userId, limit = 50, offset = 0) {
    const { rows } = await db.query(
      'SELECT * FROM security_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    return rows;
  }

  static async getRecent(limit = 100) {
    const { rows } = await db.query(
      `SELECT se.*, u.email
       FROM security_events se
       LEFT JOIN users u ON se.user_id = u.id
       ORDER BY se.created_at DESC LIMIT ?`,
      [limit]
    );
    return rows;
  }

  static async countByUser(userId, windowMinutes = 60) {
    const { rows } = await db.query(
      `SELECT COUNT(*) AS count FROM security_events
       WHERE user_id = ?
         AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [userId, windowMinutes]
    );
    return parseInt(rows[0].count);
  }

  static async getStats() {
    const { rows } = await db.query(
      `SELECT severity, COUNT(*) AS count FROM security_events
       WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY severity`
    );
    return rows;
  }
}
