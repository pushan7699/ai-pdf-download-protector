import { Router } from 'express';
import { DocumentController } from '../controllers/documentController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();
const docs = new DocumentController();

router.post('/documents/upload', authenticate, upload.single('pdf'), (req, res) => docs.upload(req, res));
router.get('/documents', authenticate, (req, res) => docs.getDocuments(req, res));
router.get('/documents/search', authenticate, (req, res) => docs.searchDocuments(req, res));
router.get('/documents/:id', authenticate, (req, res) => docs.getDocument(req, res));
router.put('/documents/:id', authenticate, (req, res) => docs.updateDocument(req, res));
router.delete('/documents/:id', authenticate, (req, res) => docs.deleteDocument(req, res));
router.post('/documents/:id/permissions', authenticate, (req, res) => docs.grantAccess(req, res));
router.delete('/documents/:id/permissions/:userId', authenticate, (req, res) => docs.revokeAccess(req, res));
router.get('/documents/:id/permissions', authenticate, (req, res) => docs.getPermissions(req, res));

export default router;
