import { db } from '../config/database.js';
import { AccessLogModel } from '../models/AccessLog.js';
import { logger } from '../utils/logger.js';
import { EventType } from '../types/index.js';

export class PermissionService {
  async grantAccess(documentId, userId, grantedBy, expiresAt, ipAddress, userAgent) {
    try {
      // Upsert permission
      await db.query(
        `INSERT INTO document_permissions (id, document_id, user_id, can_view, granted_by, expires_at)
         VALUES (UUID(), ?, ?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE
           can_view = 1, granted_by = VALUES(granted_by),
           expires_at = VALUES(expires_at), revoked_at = NULL`,
        [documentId, userId, grantedBy, expiresAt || null]
      );

      await AccessLogModel.create(
        EventType.PERMISSION_GRANTED,
        grantedBy, documentId, null,
        { targetUserId: userId },
        ipAddress, userAgent
      );

      const { rows } = await db.query(
        'SELECT * FROM document_permissions WHERE document_id = ? AND user_id = ?',
        [documentId, userId]
      );
      return rows[0];
    } catch (error) {
      logger.error('Grant access error:', error);
      throw error;
    }
  }

  async revokeAccess(documentId, userId, revokedBy, ipAddress, userAgent) {
    try {
      await db.query(
        'UPDATE document_permissions SET can_view = 0, revoked_at = NOW() WHERE document_id = ? AND user_id = ?',
        [documentId, userId]
      );

      await AccessLogModel.create(
        EventType.PERMISSION_REVOKED,
        revokedBy, documentId, null,
        { targetUserId: userId },
        ipAddress, userAgent
      );
    } catch (error) {
      logger.error('Revoke access error:', error);
      throw error;
    }
  }

  async hasAccess(userId, documentId) {
    try {
      // Owner always has access
      const { rows: owned } = await db.query(
        'SELECT id FROM documents WHERE id = ? AND uploaded_by = ? AND is_deleted = 0',
        [documentId, userId]
      );
      if (owned.length > 0) return true;

      // Explicit permission
      const { rows: perm } = await db.query(
        `SELECT id FROM document_permissions
         WHERE document_id = ? AND user_id = ? AND can_view = 1 AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [documentId, userId]
      );
      return perm.length > 0;
    } catch (error) {
      logger.error('Has access error:', error);
      return false;
    }
  }

  async getDocumentPermissions(documentId) {
    const { rows } = await db.query(
      `SELECT dp.*, u.email, u.full_name
       FROM document_permissions dp
       JOIN users u ON dp.user_id = u.id
       WHERE dp.document_id = ? AND dp.revoked_at IS NULL
       ORDER BY dp.granted_at DESC`,
      [documentId]
    );
    return rows;
  }

  async getUserPermissions(userId) {
    const { rows } = await db.query(
      `SELECT dp.*, d.title, d.filename
       FROM document_permissions dp
       JOIN documents d ON dp.document_id = d.id
       WHERE dp.user_id = ? AND dp.can_view = 1 AND dp.revoked_at IS NULL
         AND d.is_deleted = 0
       ORDER BY dp.granted_at DESC`,
      [userId]
    );
    return rows;
  }

  async isAdminOrOwner(userId, documentId, userRole) {
    if (userRole === 'admin') return true;
    const { rows } = await db.query(
      'SELECT id FROM documents WHERE id = ? AND uploaded_by = ?',
      [documentId, userId]
    );
    return rows.length > 0;
  }

  async grantBulkAccess(documentId, userIds, grantedBy, expiresAt) {
    const results = [];
    for (const userId of userIds) {
      const r = await this.grantAccess(documentId, userId, grantedBy, expiresAt);
      results.push(r);
    }
    return results;
  }
}
