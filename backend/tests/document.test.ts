import { DocumentService } from '../src/services/documentService';

describe('DocumentService', () => {
  let documentService: DocumentService;

  beforeEach(() => {
    documentService = new DocumentService();
  });

  describe('validateFile', () => {
    it('should accept valid PDF file', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'document.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024 * 1024, // 1MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = documentService.validateFile(mockFile);
      expect(result.valid).toBe(true);
    });

    it('should reject non-PDF file', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'document.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = documentService.validateFile(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('PDF');
    });

    it('should reject file without .pdf extension', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'document.doc',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = documentService.validateFile(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('.pdf extension');
    });

    it('should reject file with null bytes in filename', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'document\0.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = documentService.validateFile(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid filename');
    });

    it('should reject file that is too large', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'document.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 100 * 1024 * 1024, // 100MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = documentService.validateFile(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('size');
    });

    it('should reject when no file provided', () => {
      const result = documentService.validateFile(undefined as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No file provided');
    });
  });
});
