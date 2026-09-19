import { db } from '../config/database.js';

export class AccessLogModel {
  static async create(eventType, userId, documentId, sessionId, eventData, ipAddress, userAgent) {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO access_logs (id, user_id, document_id, session_id, event_type, event_data, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId     || null,
        documentId || null,
        sessionId  || null,
        eventType,
        eventData  ? JSON.stringify(eventData) : null,
        ipAddress  || null,
        userAgent  || null,
      ]
    );
    return { id };
  }

  static async getByUser(userId, limit = 100, offset = 0) {
    const { rows } = await db.query(
      'SELECT * FROM access_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    return rows;
  }

  static async getByDocument(documentId, limit = 100, offset = 0) {
    const { rows } = await db.query(
      'SELECT * FROM access_logs WHERE document_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [documentId, limit, offset]
    );
    return rows;
  }

  static async getBySession(sessionId) {
    const { rows } = await db.query(
      'SELECT * FROM access_logs WHERE session_id = ? ORDER BY created_at ASC',
      [sessionId]
    );
    return rows;
  }

  static async getRecent(userId, documentId, windowMinutes = 15) {
    const { rows } = await db.query(
      `SELECT * FROM access_logs
       WHERE user_id = ? AND document_id = ?
         AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
       ORDER BY created_at DESC`,
      [userId, documentId, windowMinutes]
    );
    return rows;
  }

  static async countRecentEvents(userId, eventType, windowMinutes = 15) {
    const { rows } = await db.query(
      `SELECT COUNT(*) AS count FROM access_logs
       WHERE user_id = ? AND event_type = ?
         AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [userId, eventType, windowMinutes]
    );
    return parseInt(rows[0].count);
  }
}
