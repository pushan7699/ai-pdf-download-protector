import { Router } from 'express';
import { SecurityController } from '../controllers/securityController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
const security = new SecurityController();

router.get('/security/events', authenticate, authorize('admin'), (req, res) => security.getSecurityEvents(req, res));
router.get('/security/stats', authenticate, authorize('admin'), (req, res) => security.getSecurityStats(req, res));
router.get('/security/alerts', authenticate, authorize('admin'), (req, res) => security.getAlerts(req, res));
router.put('/security/alerts/:id', authenticate, authorize('admin'), (req, res) => security.updateAlert(req, res));
router.get('/security/assessments', authenticate, authorize('admin'), (req, res) => security.getRiskAssessments(req, res));
router.get('/security/logs', authenticate, authorize('admin'), (req, res) => security.getAccessLogs(req, res));

export default router;
