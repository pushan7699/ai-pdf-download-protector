import { UserModel } from '../models/User.js';
import { SecurityEventModel } from '../models/SecurityEvent.js';
import { logger, securityLogger } from '../utils/logger.js';
import { EventType, RiskLevel } from '../types/index.js';

export class UserController {
  async getUsers(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const users = await UserModel.getAll(limit, offset);
      res.json({ success: true, data: { users } });
    } catch (error) {
      logger.error('Get users error:', error);
      res.status(500).json({ success: false, message: 'Failed to get users' });
    }
  }

  async getUser(req, res) {
    try {
      const user = await UserModel.findByIdSafe(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, data: { user } });
    } catch (error) {
      logger.error('Get user error:', error);
      res.status(500).json({ success: false, message: 'Failed to get user' });
    }
  }

  async blockUser(req, res) {
    try {
      const { id } = req.params;
      const user = await UserModel.findById(id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      await UserModel.blockUser(id);

      await SecurityEventModel.create(
        EventType.USER_BLOCKED, RiskLevel.HIGH,
        `User blocked by admin ${req.user.userId}`,
        id, null, null, null, req.ip, req.headers['user-agent']
      );

      securityLogger.warn('User blocked by admin', { targetUserId: id, adminId: req.user.userId });
      res.json({ success: true, message: 'User blocked' });
    } catch (error) {
      logger.error('Block user error:', error);
      res.status(500).json({ success: false, message: 'Failed to block user' });
    }
  }

  async unblockUser(req, res) {
    try {
      const { id } = req.params;
      const user = await UserModel.findById(id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      await UserModel.unblockUser(id);

      await SecurityEventModel.create(
        EventType.USER_UNBLOCKED, RiskLevel.LOW,
        `User unblocked by admin ${req.user.userId}`,
        id, null, null, null, req.ip, req.headers['user-agent']
      );

      res.json({ success: true, message: 'User unblocked' });
    } catch (error) {
      logger.error('Unblock user error:', error);
      res.status(500).json({ success: false, message: 'Failed to unblock user' });
    }
  }

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      if (id === req.user.userId) {
        return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
      }
      await UserModel.delete(id);
      res.json({ success: true, message: 'User deleted' });
    } catch (error) {
      logger.error('Delete user error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
  }

  async getUserActivity(req, res) {
    try {
      const events = await SecurityEventModel.getByUser(req.params.id, 50, 0);
      res.json({ success: true, data: { events } });
    } catch (error) {
      logger.error('Get activity error:', error);
      res.status(500).json({ success: false, message: 'Failed to get activity' });
    }
  }
}
