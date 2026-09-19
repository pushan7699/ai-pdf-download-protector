import { AISecurityService } from './aiSecurityService.js';
import { UserModel } from '../models/User.js';
import { SessionModel } from '../models/Session.js';
import { SecurityEventModel } from '../models/SecurityEvent.js';
import { logger, securityLogger } from '../utils/logger.js';
import { db } from '../config/database.js';

const aiService = new AISecurityService();

export class PreventionService {
  async analyzeAndPrevent(userId, documentId, sessionId, ipAddress, userAgent) {
    try {
      const analysis = await aiService.analyzeBehavior(userId, documentId, sessionId);
      const action = await this.enforceAction(sessionId, analysis, userId, documentId, sessionId, null, ipAddress, userAgent);
      return { analysis, action };
    } catch (error) {
      logger.error('Prevention error:', error);
      return { analysis: null, action: 'ALLOW' };
    }
  }

  async enforceAction(sessionId, analysis, userId, documentId, sessionToken, assessmentId, ipAddress, userAgent) {
    const { recommended_action: action, risk_score: score } = analysis;

    logger.info('Enforcing security action', { action, score, userId });

    switch (action) {
      case 'BLOCK_USER':
        await this.blockUser(sessionId, userId, analysis, assessmentId, ipAddress, userAgent);
        break;
      case 'BLOCK_SESSION':
        await this.blockSession(sessionId, userId, analysis, assessmentId, ipAddress, userAgent);
        break;
      case 'REQUIRE_REAUTH':
        await this.revokeSession(sessionId, userId, analysis, assessmentId, ipAddress, userAgent);
        break;
      case 'RATE_LIMIT':
        await this.logSecurityEvent(userId, documentId, sessionId, 'RATE_LIMIT_APPLIED', 'medium', `Risk score: ${score}`, ipAddress, userAgent);
        break;
      case 'MONITOR':
        await this.logSecurityEvent(userId, documentId, sessionId, 'SUSPICIOUS_ACTIVITY', 'low', `Risk score: ${score}`, ipAddress, userAgent);
        break;
      default:
        break;
    }

    return action;
  }

  async blockUser(sessionId, userId, analysis, assessmentId, ipAddress, userAgent) {
    await UserModel.blockUser(userId);
    await SessionModel.revokeUserSessions(userId);
    await this.logSecurityEvent(userId, null, sessionId, 'USER_BLOCKED', 'critical', `AI blocked user. Score: ${analysis.risk_score}`, ipAddress, userAgent);
    await this.createSecurityAlert(userId, null, sessionId, assessmentId, 'USER_BLOCKED', 'critical', 'User Blocked by AI', analysis.detailed_explanation, ipAddress, userAgent);
    securityLogger.warn('User blocked by AI', { userId, score: analysis.risk_score, reasons: analysis.reasons });
  }

  async blockSession(sessionId, userId, analysis, assessmentId, ipAddress, userAgent) {
    if (sessionId) {
      const session = await SessionModel.findById(sessionId);
      if (session) await SessionModel.revoke(session.id);
    }
    await this.logSecurityEvent(userId, null, sessionId, 'SESSION_BLOCKED', 'high', `AI blocked session. Score: ${analysis.risk_score}`, ipAddress, userAgent);
    await this.createSecurityAlert(userId, null, sessionId, assessmentId, 'SESSION_BLOCKED', 'high', 'Session Blocked by AI', analysis.detailed_explanation, ipAddress, userAgent);
  }

  async revokeSession(sessionId, userId, analysis, assessmentId, ipAddress, userAgent) {
    if (sessionId) {
      const session = await SessionModel.findById(sessionId);
      if (session) await SessionModel.revoke(session.id);
    }
    await this.logSecurityEvent(userId, null, sessionId, 'SESSION_REVOKED', 'medium', `Re-auth required. Score: ${analysis.risk_score}`, ipAddress, userAgent);
  }

  async logSecurityEvent(userId, documentId, sessionId, eventType, severity, description, ipAddress, userAgent) {
    try {
      await SecurityEventModel.create(eventType, severity, description, userId, documentId, sessionId, null, ipAddress, userAgent);
    } catch (error) {
      logger.error('Log security event error:', error.message);
    }
  }

  async createSecurityAlert(userId, documentId, sessionId, assessmentId, alertType, severity, title, description, ipAddress, userAgent) {
    try {
      await db.query(
        `INSERT INTO security_alerts
           (id, user_id, document_id, session_id, risk_assessment_id, alert_type, severity, title, description, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
        [crypto.randomUUID(), userId || null, documentId || null, sessionId || null, assessmentId || null, alertType, severity, title, description]
      );
    } catch (error) {
      logger.error('Create alert error:', error.message);
    }
  }

  shouldAnalyze(userId) {
    return true; // analyze every request; add rate limiting here if needed
  }
}
