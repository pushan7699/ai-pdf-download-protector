import { ViewerService } from '../services/viewerService.js';
import { AccessLogModel } from '../models/AccessLog.js';
import { SecurityEventModel } from '../models/SecurityEvent.js';
import { logger, securityLogger } from '../utils/logger.js';
import { EventType, RiskLevel } from '../types/index.js';

const viewerService = new ViewerService();

export class ViewerController {
  async startSession(req, res) {
    try {
      const { documentId } = req.body;
      if (!documentId) return res.status(400).json({ success: false, message: 'documentId is required' });

      const sessionData = await viewerService.startViewingSession(
        req.user.userId, documentId, req.user.role,
        req.ip, req.headers['user-agent']
      );

      res.json({ success: true, message: 'Session started', data: sessionData });
    } catch (error) {
      logger.error('Start session error:', error);
      const status = error.message === 'Access denied' ? 403
        : error.message === 'Document not found' ? 404 : 500;
      res.status(status).json({ success: false, message: error.message || 'Failed to start session' });
    }
  }

  async getPage(req, res) {
    try {
      const { pageNumber } = req.params;
      const sessionToken = req.headers['x-session-token'] || req.query.session_token;

      if (!sessionToken) return res.status(401).json({ success: false, message: 'Session token required' });

      // Log direct PDF request attempts
      await AccessLogModel.create(
        EventType.TOKEN_REQUEST, req.user?.userId, null, null,
        { pageNumber: parseInt(pageNumber) }, req.ip, req.headers['user-agent']
      ).catch(() => {});

      const result = await viewerService.getPage(
        sessionToken, parseInt(pageNumber),
        req.user.userId, req.ip, req.headers['user-agent']
      );

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });

      res.send(result.pageBuffer);
    } catch (error) {
      logger.error('Get page error:', error);
      const status = error.message.includes('session') ? 401
        : error.message.includes('page') ? 400 : 500;
      res.status(status).json({ success: false, message: error.message || 'Failed to get page' });
    }
  }

  async endSession(req, res) {
    try {
      const sessionToken = req.headers['x-session-token'] || req.body.session_token;
      if (sessionToken) {
        await viewerService.endSession(sessionToken, req.ip, req.headers['user-agent']);
      }
      res.json({ success: true, message: 'Session ended' });
    } catch (error) {
      logger.error('End session error:', error);
      res.status(500).json({ success: false, message: 'Failed to end session' });
    }
  }

  async getSessionInfo(req, res) {
    try {
      const sessionToken = req.headers['x-session-token'] || req.query.session_token;
      if (!sessionToken) return res.status(400).json({ success: false, message: 'Session token required' });

      const info = await viewerService.getSessionInfo(sessionToken);
      if (!info) return res.status(401).json({ success: false, message: 'Invalid or expired session' });

      res.json({ success: true, data: info });
    } catch (error) {
      logger.error('Get session info error:', error);
      res.status(500).json({ success: false, message: 'Failed to get session info' });
    }
  }

  async reportDownloadAttempt(req, res) {
    try {
      const sessionToken = req.headers['x-session-token'];
      await AccessLogModel.create(
        EventType.DOWNLOAD_ATTEMPT, req.user?.userId, null, null,
        { type: req.body.type || 'unknown' }, req.ip, req.headers['user-agent']
      );

      await SecurityEventModel.create(
        EventType.DOWNLOAD_ATTEMPT, RiskLevel.HIGH,
        'Download attempt detected',
        req.user?.userId, null, null, null, req.ip, req.headers['user-agent']
      );

      securityLogger.warn('Download attempt', { userId: req.user?.userId, ip: req.ip });
      res.json({ success: true, message: 'Reported' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Report failed' });
    }
  }
}
