import path from 'path';
import fs from 'fs/promises';
import { PDFDocument } from 'pdf-lib';
import { v4 as uuidv4 } from 'uuid';
import { DocumentModel } from '../models/Document.js';
import { AccessLogModel } from '../models/AccessLog.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { EventType } from '../types/index.js';

export class DocumentService {
  constructor() {
    this.storagePath = config.storage.path;
  }

  async ensureStorageDirectory() {
    try {
      await fs.access(this.storagePath);
    } catch {
      await fs.mkdir(this.storagePath, { recursive: true });
    }
  }

  async extractPDFMetadata(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(fileBuffer);
      return { pageCount: pdfDoc.getPageCount() };
    } catch {
      return { pageCount: 0 };
    }
  }

  generateSecureFilename(originalFilename) {
    const ext = path.extname(originalFilename);
    return `${uuidv4()}${ext}`;
  }

  async uploadDocument(file, title, uploadedBy, description, ipAddress, userAgent) {
    try {
      await this.ensureStorageDirectory();

      const secureFilename = this.generateSecureFilename(file.originalname);
      const filePath = path.join(this.storagePath, secureFilename);

      await fs.writeFile(filePath, file.buffer);

      const metadata = await this.extractPDFMetadata(filePath);

      const document = await DocumentModel.create(
        title,
        secureFilename,
        filePath,
        file.size,
        file.mimetype,
        metadata.pageCount,
        uploadedBy,
        description
      );

      await AccessLogModel.create(
        EventType.DOCUMENT_UPLOADED,
        uploadedBy, document.id, null,
        { originalName: file.originalname, size: file.size },
        ipAddress, userAgent
      );

      logger.info('Document uploaded', { documentId: document.id, uploadedBy });
      return document;
    } catch (error) {
      logger.error('Upload error:', error);
      throw error;
    }
  }

  async getDocument(documentId) {
    return await DocumentModel.findById(documentId);
  }

  async getDocuments(userId, userRole, limit = 50, offset = 0) {
    if (userRole === 'admin') {
      return await DocumentModel.getAll(limit, offset);
    }
    return await DocumentModel.findByUploader(userId, limit, offset);
  }

  async updateDocument(documentId, updates) {
    return await DocumentModel.update(documentId, updates);
  }

  async deleteDocument(documentId, deletedBy, ipAddress, userAgent) {
    try {
      const document = await DocumentModel.findById(documentId);
      if (!document) throw new Error('Document not found');

      await DocumentModel.softDelete(documentId);

      await AccessLogModel.create(
        EventType.DOCUMENT_DELETED,
        deletedBy, documentId, null,
        { title: document.title },
        ipAddress, userAgent
      );

      logger.info('Document deleted', { documentId, deletedBy });
    } catch (error) {
      logger.error('Delete error:', error);
      throw error;
    }
  }

  async getDocumentPath(documentId) {
    const document = await DocumentModel.findById(documentId);
    if (!document) throw new Error('Document not found');
    return document.file_path;
  }

  async searchDocuments(query, limit = 50, offset = 0) {
    return await DocumentModel.search(query, limit, offset);
  }

  validateFile(file) {
    if (!file) return { valid: false, error: 'No file uploaded' };
    if (file.mimetype !== 'application/pdf') return { valid: false, error: 'Only PDF files are allowed' };
    if (file.size > config.storage.maxFileSize) return { valid: false, error: 'File too large (max 50MB)' };
    if (!file.originalname.toLowerCase().endsWith('.pdf')) return { valid: false, error: 'File must have .pdf extension' };
    return { valid: true };
  }
}
