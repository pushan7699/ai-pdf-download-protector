import path from 'path';
import { DocumentModel } from '../models/Document.js';
import { SessionModel } from '../models/Session.js';
import { AccessLogModel } from '../models/AccessLog.js';
import { WatermarkService } from './watermarkService.js';
import { PermissionService } from './permissionService.js';
import { PreventionService } from './preventionService.js';
import { JWTUtil } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { EventType, RiskLevel } from '../types/index.js';

const watermarkService = new WatermarkService();
const permissionService = new PermissionService();
const preventionService = new PreventionService();

export class ViewerService {
  async startViewingSession(userId, documentId, userRole, ipAddress, userAgent) {
    try {
      const document = await DocumentModel.findById(documentId);
      if (!document) throw new Error('Document not found');

      const hasAccess = await permissionService.hasAccess(userId, documentId);
      if (!hasAccess && userRole !== 'admin') throw new Error('Access denied');

      // Allow up to 5 concurrent sessions (React StrictMode mounts twice in dev)
      const activeCount = await SessionModel.getActiveSessionCount(userId, documentId);
      if (activeCount >= 5) {
        // Auto-revoke oldest sessions instead of blocking
        await SessionModel.revokeUserSessions(userId, documentId);
      }

      const sessionToken = JWTUtil.generateSessionToken();
      // Use MySQL NOW() + 2 hours so timezone matches DB
      const session = await SessionModel.create(
        userId, documentId, sessionToken, null, ipAddress, userAgent
      );

      await AccessLogModel.create(
        EventType.SESSION_START, userId, documentId, session.id, null, ipAddress, userAgent
      );

      return {
        sessionToken,
        sessionId: session.id,
        documentId,
        pageCount: document.page_count,
        title: document.title,
        expiresAt: session.expires_at,
      };
    } catch (error) {
      logger.error('Start session error:', error);
      throw error;
    }
  }

  async validateSession(sessionToken) {
    const session = await SessionModel.validate(sessionToken);
    if (!session) return { valid: false };

    const document = await DocumentModel.findById(session.document_id);
    return { valid: true, session, document };
  }

  async getPage(sessionToken, pageNumber, userId, ipAddress, userAgent) {
    try {
      const { valid, session, document } = await this.validateSession(sessionToken);
      if (!valid || !session) throw new Error('Invalid or expired session');

      if (pageNumber < 1) throw new Error('Invalid page number');

      // If page_count is 0 (not yet extracted), allow the request through
      // and validate against actual PDF page count below
      if (document.page_count > 0 && pageNumber > document.page_count) {
        throw new Error('Invalid page number');
      }

      await SessionModel.updateActivity(sessionToken);

      await AccessLogModel.create(
        EventType.PAGE_VIEW, userId, session.document_id, session.id,
        { pageNumber }, ipAddress, userAgent
      );

      // AI behavior analysis (async, non-blocking)
      if (preventionService.shouldAnalyze(userId)) {
        preventionService.analyzeAndPrevent(userId, session.document_id, session.id, ipAddress, userAgent)
          .catch(err => logger.error('Prevention analysis error:', err.message));
      }

      // Get user info for watermark
      const userInfo = { userId, userEmail: 'user@domain.com', userName: 'User', sessionId: session.id, documentTitle: document.title };

      // Extract page and add watermark
      let pageBuffer;
      try {
        pageBuffer = await watermarkService.extractPage(document.file_path, pageNumber);
        pageBuffer = await watermarkService.addWatermarkToPage(pageBuffer, 1, userInfo);
      } catch (err) {
        logger.error('Watermark error, serving plain page:', err.message);
        const fs = await import('fs/promises');
        pageBuffer = await fs.readFile(document.file_path);
      }

      return {
        pageBuffer,
        pageNumber,
        totalPages: document.page_count,
        sessionId: session.id,
      };
    } catch (error) {
      logger.error('Get page error:', error);
      throw error;
    }
  }

  async endSession(sessionToken, ipAddress, userAgent) {
    try {
      const session = await SessionModel.findByToken(sessionToken);
      if (!session) return;

      await SessionModel.revoke(session.id);

      await AccessLogModel.create(
        EventType.SESSION_END, session.user_id, session.document_id, session.id,
        null, ipAddress, userAgent
      );
    } catch (error) {
      logger.error('End session error:', error);
    }
  }

  async getSessionInfo(sessionToken) {
    const { valid, session, document } = await this.validateSession(sessionToken);
    if (!valid) return null;
    return { session, document };
  }
}
