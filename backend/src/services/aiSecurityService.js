import OpenAI from 'openai';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AccessLogModel } from '../models/AccessLog.js';
import { SecurityEventModel } from '../models/SecurityEvent.js';
import { SessionModel } from '../models/Session.js';
import { db } from '../config/database.js';

export class AISecurityService {
  constructor() {
    this.openai = null;
    if (config.openai.apiKey) {
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
      logger.info('OpenAI client initialized for AI-enhanced detection');
    } else {
      logger.warn('OpenAI API key not configured - using rule-based detection only');
    }
  }

  async analyzeBehavior(userId, documentId, sessionId) {
    try {
      const features = await this.gatherBehavioralFeatures(userId, documentId, sessionId);
      const baseScore = this.calculateRuleBasedRisk(features);

      let analysis;
      if (this.openai && baseScore > 20) {
        analysis = await this.performAIAnalysis(baseScore, features);
      } else {
        analysis = this.createRuleBasedAnalysis(features, baseScore);
      }

      await this.saveAssessment(analysis, userId, documentId, sessionId);
      return analysis;
    } catch (error) {
      logger.error('Behavior analysis error:', error);
      return { risk_score: 0, classification: 'Analysis Error', confidence: 0, reasons: [], recommended_action: 'ALLOW', detailed_explanation: 'Analysis failed' };
    }
  }

  async gatherBehavioralFeatures(userId, documentId, sessionId) {
    const windowMinutes = 15;
    const now = new Date();

    const [recentLogs, sessionData, securityEvents, sessions] = await Promise.all([
      AccessLogModel.getRecent(userId, documentId, windowMinutes),
      sessionId ? SessionModel.findById(sessionId) : Promise.resolve(null),
      SecurityEventModel.countByUser(userId, windowMinutes),
      SessionModel.getActiveSessions(userId, documentId),
    ]);

    const pageViews = recentLogs.filter(l => l.event_type === 'PAGE_VIEW').length;
    const downloadAttempts = recentLogs.filter(l => l.event_type === 'DOWNLOAD_ATTEMPT').length;
    const directPdfAttempts = recentLogs.filter(l => l.event_type === 'DIRECT_PDF_REQUEST').length;
    const tokenFailures = recentLogs.filter(l => l.event_type === 'TOKEN_FAILURE').length;

    const sessionDuration = sessionData
      ? (now - new Date(sessionData.started_at)) / 60000
      : 0;

    const pageNumbers = recentLogs
      .filter(l => l.event_type === 'PAGE_VIEW' && l.event_data?.pageNumber)
      .map(l => l.event_data.pageNumber);

    const uniquePages = new Set(pageNumbers).size;
    const totalPages = pageNumbers.length;
    const pagesPerMin = windowMinutes > 0 ? pageViews / windowMinutes : 0;
    const rapidSwitching = pagesPerMin > 5;

    const userResult = await db.query(
      'SELECT created_at, failed_login_attempts FROM users WHERE id = ?',
      [userId]
    );
    const user = userResult.rows[0];
    const accountAgeDays = user
      ? (now - new Date(user.created_at)) / 86400000
      : 0;

    return {
      user_id: userId,
      document_id: documentId,
      session_id: sessionId,
      time_window_minutes: windowMinutes,
      total_page_views: pageViews,
      pages_per_minute: pagesPerMin,
      unique_pages_accessed: uniquePages,
      total_document_requests: recentLogs.length,
      concurrent_sessions: sessions.length,
      session_duration_minutes: sessionDuration,
      rapid_page_switching: rapidSwitching,
      failed_token_requests: tokenFailures,
      direct_pdf_attempts: directPdfAttempts,
      download_button_clicks: downloadAttempts,
      unauthorized_endpoint_attempts: securityEvents,
      sequential_page_access: this.isSequential(pageNumbers),
      random_page_jumps: this.countRandomJumps(pageNumbers),
      repeated_page_views: totalPages - uniquePages,
      user_account_age_days: accountAgeDays,
      previous_violations: securityEvents,
      average_session_duration: sessionDuration,
      multiple_ip_addresses: false,
      suspicious_user_agents: false,
      api_abuse_indicators: directPdfAttempts > 0,
    };
  }

  isSequential(pages) {
    if (pages.length < 3) return false;
    let sequential = 0;
    for (let i = 1; i < pages.length; i++) {
      if (pages[i] === pages[i - 1] + 1) sequential++;
    }
    return sequential / pages.length > 0.7;
  }

  countRandomJumps(pages) {
    let jumps = 0;
    for (let i = 1; i < pages.length; i++) {
      if (Math.abs(pages[i] - pages[i - 1]) > 5) jumps++;
    }
    return jumps;
  }

  calculateRuleBasedRisk(features) {
    let score = 0;

    if (features.pages_per_minute > 10) score += 30;
    else if (features.pages_per_minute > 5) score += 15;

    if (features.direct_pdf_attempts > 0) score += 25;
    if (features.download_button_clicks > 3) score += 20;
    if (features.failed_token_requests > 2) score += 15;
    if (features.concurrent_sessions > 2) score += 20;
    if (features.total_page_views > 50) score += 10;
    if (features.unauthorized_endpoint_attempts > 5) score += 20;
    if (features.rapid_page_switching) score += 15;
    if (features.user_account_age_days < 1) score += 10;
    if (features.previous_violations > 3) score += 15;

    return Math.min(100, score);
  }

  createRuleBasedAnalysis(features, score) {
    const reasons = [];

    if (features.pages_per_minute > 10) reasons.push('Extremely rapid page access (possible automation)');
    else if (features.pages_per_minute > 5) reasons.push('Rapid page access detected');
    if (features.direct_pdf_attempts > 0) reasons.push('Direct PDF download attempts detected');
    if (features.download_button_clicks > 3) reasons.push('Multiple download attempts');
    if (features.failed_token_requests > 2) reasons.push('Multiple failed token requests');
    if (features.concurrent_sessions > 2) reasons.push('Multiple concurrent sessions');
    if (features.rapid_page_switching) reasons.push('Rapid page switching behavior');
    if (features.user_account_age_days < 1) reasons.push('Very new account');

    let classification, action;
    if (score >= 80) { classification = 'Critical Risk - Likely AI/Bot'; action = 'BLOCK_USER'; }
    else if (score >= 60) { classification = 'High Risk - Suspicious'; action = 'BLOCK_SESSION'; }
    else if (score >= 30) { classification = 'Medium Risk - Monitor'; action = 'MONITOR'; }
    else { classification = 'Normal Activity'; action = 'ALLOW'; }

    return {
      risk_score: score,
      classification,
      confidence: 0.75,
      reasons,
      recommended_action: action,
      detailed_explanation: this.generateExplanation(features, score, reasons),
    };
  }

  async performAIAnalysis(baseScore, features) {
    try {
      const prompt = this.buildAIPrompt(features, baseScore);
      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: 'You are a document security AI. Analyze user behavior and respond with JSON only.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: config.openai.maxTokens,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in AI response');

      const aiResult = JSON.parse(jsonMatch[0]);
      return {
        risk_score: Math.max(baseScore, aiResult.risk_score || 0),
        classification: aiResult.classification || 'Unknown',
        confidence: aiResult.confidence || 0.5,
        reasons: aiResult.reasons || [],
        recommended_action: aiResult.recommended_action || 'MONITOR',
        detailed_explanation: aiResult.explanation || '',
      };
    } catch (error) {
      logger.error('AI analysis failed, falling back to rules:', error.message);
      return this.createRuleBasedAnalysis(features, baseScore);
    }
  }

  buildAIPrompt(features, baseScore) {
    return `Analyze this PDF document access behavior. Respond with JSON only.

Behavioral Data:
- Pages per minute: ${features.pages_per_minute.toFixed(2)}
- Total page views: ${features.total_page_views}
- Concurrent sessions: ${features.concurrent_sessions}
- Direct PDF download attempts: ${features.direct_pdf_attempts}
- Download button clicks: ${features.download_button_clicks}
- Failed token requests: ${features.failed_token_requests}
- Rule-based risk score: ${baseScore}/100
- Account age: ${features.user_account_age_days.toFixed(1)} days

Respond with:
{
  "risk_score": 0-100,
  "classification": "string",
  "confidence": 0.0-1.0,
  "reasons": ["reason1", "reason2"],
  "recommended_action": "ALLOW|MONITOR|RATE_LIMIT|BLOCK_SESSION|BLOCK_USER",
  "explanation": "string"
}`;
  }

  generateExplanation(features, score, reasons) {
    if (score >= 80) return `CRITICAL: Strong AI/bot indicators. ${reasons.join('. ')}`;
    if (score >= 60) return `HIGH RISK: Suspicious patterns detected. ${reasons.join('. ')}`;
    if (score >= 30) return `MEDIUM RISK: Some unusual patterns. ${reasons.join('. ')}`;
    return 'Normal document access behavior.';
  }

  async saveAssessment(analysis, userId, documentId, sessionId) {
    try {
      const rid = crypto.randomUUID();
      await db.query(
        `INSERT INTO ai_risk_assessments
         (id, user_id, document_id, session_id, risk_score, classification, confidence, reasons, recommended_action, detailed_explanation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rid,
          userId, documentId || null, sessionId || null,
          analysis.risk_score, analysis.classification, analysis.confidence,
          JSON.stringify(analysis.reasons), analysis.recommended_action,
          analysis.detailed_explanation,
        ]
      );
    } catch (error) {
      logger.error('Save assessment error:', error.message);
    }
  }
}
