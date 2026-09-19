import { SecurityEventModel } from '../models/SecurityEvent.js';
import { AccessLogModel } from '../models/AccessLog.js';
import { db } from '../config/database.js';
import { logger } from '../utils/logger.js';

export class SecurityController {
  async getSecurityEvents(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const events = await SecurityEventModel.getRecent(limit);
      res.json({ success: true, data: { events } });
    } catch (error) {
      logger.error('Get security events error:', error);
      res.status(500).json({ success: false, message: 'Failed to get events' });
    }
  }

  async getSecurityStats(req, res) {
    try {
      const stats = await SecurityEventModel.getStats();
      const alertsResult = await db.query(
        "SELECT COUNT(*) AS count FROM security_alerts WHERE status = 'open'"
      ).catch(() => ({ rows: [{ count: 0 }] }));

      res.json({
        success: true,
        data: {
          eventsBySeverity: stats,
          openAlerts: parseInt(alertsResult.rows[0].count),
        },
      });
    } catch (error) {
      logger.error('Get stats error:', error);
      res.status(500).json({ success: false, message: 'Failed to get stats' });
    }
  }

  async getAlerts(req, res) {
    try {
      const status = req.query.status || 'open';
      const { rows } = await db.query(
        `SELECT sa.*, u.email AS user_email
         FROM security_alerts sa
         LEFT JOIN users u ON sa.user_id = u.id
         WHERE sa.status = ?
         ORDER BY sa.created_at DESC LIMIT 100`,
        [status]
      ).catch(() => ({ rows: [] }));

      res.json({ success: true, data: { alerts: rows } });
    } catch (error) {
      logger.error('Get alerts error:', error);
      res.status(500).json({ success: false, message: 'Failed to get alerts' });
    }
  }

  async updateAlert(req, res) {
    try {
      const { id } = req.params;
      const { status, resolution_notes } = req.body;

      await db.query(
        `UPDATE security_alerts
         SET status = ?,
             resolution_notes = ?,
             resolved_at = CASE WHEN ? = 'resolved' THEN NOW() ELSE resolved_at END
         WHERE id = ?`,
        [status, resolution_notes || null, status, id]
      ).catch(() => {});

      const { rows } = await db.query(
        'SELECT * FROM security_alerts WHERE id = ?', [id]
      ).catch(() => ({ rows: [] }));

      if (!rows[0]) return res.status(404).json({ success: false, message: 'Alert not found' });
      res.json({ success: true, data: { alert: rows[0] } });
    } catch (error) {
      logger.error('Update alert error:', error);
      res.status(500).json({ success: false, message: 'Failed to update alert' });
    }
  }

  async getRiskAssessments(req, res) {
    try {
      const { rows } = await db.query(
        `SELECT ar.*, u.email
         FROM ai_risk_assessments ar
         LEFT JOIN users u ON ar.user_id = u.id
         ORDER BY ar.created_at DESC LIMIT 100`
      ).catch(() => ({ rows: [] }));

      res.json({ success: true, data: { assessments: rows } });
    } catch (error) {
      logger.error('Get assessments error:', error);
      res.status(500).json({ success: false, message: 'Failed to get assessments' });
    }
  }

  async getAccessLogs(req, res) {
    try {
      const { userId, documentId } = req.query;
      const limit = parseInt(req.query.limit) || 100;

      let logs;
      if (userId) {
        logs = await AccessLogModel.getByUser(userId, limit);
      } else if (documentId) {
        logs = await AccessLogModel.getByDocument(documentId, limit);
      } else {
        const { rows } = await db.query(
          'SELECT * FROM access_logs ORDER BY created_at DESC LIMIT ?',
          [limit]
        ).catch(() => ({ rows: [] }));
        logs = rows;
      }

      res.json({ success: true, data: { logs } });
    } catch (error) {
      logger.error('Get access logs error:', error);
      res.status(500).json({ success: false, message: 'Failed to get logs' });
    }
  }
}
