import { DocumentService } from '../services/documentService.js';
import { PermissionService } from '../services/permissionService.js';
import { AccessLogModel } from '../models/AccessLog.js';
import { SecurityEventModel } from '../models/SecurityEvent.js';
import { logger } from '../utils/logger.js';
import { EventType, RiskLevel } from '../types/index.js';

const docService = new DocumentService();
const permService = new PermissionService();

export class DocumentController {
  async upload(req, res) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

      const validation = docService.validateFile(req.file);
      if (!validation.valid) return res.status(400).json({ success: false, message: validation.error });

      const { title, description } = req.body;
      if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

      const document = await docService.uploadDocument(
        req.file, title, req.user.userId, description,
        req.ip, req.headers['user-agent']
      );

      res.status(201).json({ success: true, message: 'Document uploaded', data: { document } });
    } catch (error) {
      logger.error('Upload controller error:', error);
      res.status(500).json({ success: false, message: 'Upload failed' });
    }
  }

  async getDocuments(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const documents = await docService.getDocuments(req.user.userId, req.user.role, limit, offset);
      res.json({ success: true, data: { documents } });
    } catch (error) {
      logger.error('Get documents error:', error);
      res.status(500).json({ success: false, message: 'Failed to get documents' });
    }
  }

  async getDocument(req, res) {
    try {
      const { id } = req.params;
      const document = await docService.getDocument(id);
      if (!document) return res.status(404).json({ success: false, message: 'Document not found' });

      const hasAccess = await permService.hasAccess(req.user.userId, id);
      if (!hasAccess && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      res.json({ success: true, data: { document } });
    } catch (error) {
      logger.error('Get document error:', error);
      res.status(500).json({ success: false, message: 'Failed to get document' });
    }
  }

  async updateDocument(req, res) {
    try {
      const { id } = req.params;
      const document = await docService.getDocument(id);
      if (!document) return res.status(404).json({ success: false, message: 'Document not found' });

      const isOwner = await permService.isAdminOrOwner(req.user.userId, id, req.user.role);
      if (!isOwner) return res.status(403).json({ success: false, message: 'Access denied' });

      const updated = await docService.updateDocument(id, req.body);
      res.json({ success: true, data: { document: updated } });
    } catch (error) {
      logger.error('Update document error:', error);
      res.status(500).json({ success: false, message: 'Update failed' });
    }
  }

  async deleteDocument(req, res) {
    try {
      const { id } = req.params;
      const document = await docService.getDocument(id);
      if (!document) return res.status(404).json({ success: false, message: 'Document not found' });

      const isOwner = await permService.isAdminOrOwner(req.user.userId, id, req.user.role);
      if (!isOwner) return res.status(403).json({ success: false, message: 'Access denied' });

      await docService.deleteDocument(id, req.user.userId, req.ip, req.headers['user-agent']);
      res.json({ success: true, message: 'Document deleted' });
    } catch (error) {
      logger.error('Delete document error:', error);
      res.status(500).json({ success: false, message: 'Delete failed' });
    }
  }

  async grantAccess(req, res) {
    try {
      const { id } = req.params;
      const { userId, expiresAt } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });

      const isOwner = await permService.isAdminOrOwner(req.user.userId, id, req.user.role);
      if (!isOwner) return res.status(403).json({ success: false, message: 'Access denied' });

      const permission = await permService.grantAccess(id, userId, req.user.userId, expiresAt, req.ip, req.headers['user-agent']);
      res.json({ success: true, message: 'Access granted', data: { permission } });
    } catch (error) {
      logger.error('Grant access error:', error);
      res.status(500).json({ success: false, message: 'Failed to grant access' });
    }
  }

  async revokeAccess(req, res) {
    try {
      const { id, userId } = req.params;
      const isOwner = await permService.isAdminOrOwner(req.user.userId, id, req.user.role);
      if (!isOwner) return res.status(403).json({ success: false, message: 'Access denied' });

      await permService.revokeAccess(id, userId, req.user.userId, req.ip, req.headers['user-agent']);
      res.json({ success: true, message: 'Access revoked' });
    } catch (error) {
      logger.error('Revoke access error:', error);
      res.status(500).json({ success: false, message: 'Failed to revoke access' });
    }
  }

  async getPermissions(req, res) {
    try {
      const { id } = req.params;
      const isOwner = await permService.isAdminOrOwner(req.user.userId, id, req.user.role);
      if (!isOwner) return res.status(403).json({ success: false, message: 'Access denied' });

      const permissions = await permService.getDocumentPermissions(id);
      res.json({ success: true, data: { permissions } });
    } catch (error) {
      logger.error('Get permissions error:', error);
      res.status(500).json({ success: false, message: 'Failed to get permissions' });
    }
  }

  async searchDocuments(req, res) {
    try {
      const { q } = req.query;
      if (!q) return res.status(400).json({ success: false, message: 'Search query required' });
      const documents = await docService.searchDocuments(q);
      res.json({ success: true, data: { documents } });
    } catch (error) {
      logger.error('Search error:', error);
      res.status(500).json({ success: false, message: 'Search failed' });
    }
  }
}
