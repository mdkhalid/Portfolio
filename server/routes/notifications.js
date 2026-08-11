const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { int, mongoId } = require('../middleware/validate');
const {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
} = require('../services/notifications');

const router = express.Router();

/** GET /api/notifications — recent notifications + unread count. */
router.get('/', asyncHandler(async (req, res) => {
  const page = int(req.query, 'page', { min: 1, optional: true }) || 1;
  const limit = Math.min(int(req.query, 'limit', { min: 1, max: 100, optional: true }) || 20, 100);
  const data = await listNotifications(req.adminId, { page, limit });
  res.json(data);
}));

/** GET /api/notifications/unread-count */
router.get('/unread-count', asyncHandler(async (req, res) => {
  res.json({ count: await unreadCount(req.adminId) });
}));

/** PUT /api/notifications/:id/read — mark one notification as read. */
router.put('/:id/read', asyncHandler(async (req, res) => {
  const id = mongoId(req.params.id, 'notificationId');
  const doc = await markRead(req.adminId, id);
  if (!doc) return res.status(404).json({ error: 'Notification not found' });
  res.json({ read: true, notification: doc });
}));

/** PUT /api/notifications/read-all */
router.put('/read-all', asyncHandler(async (req, res) => {
  const result = await markAllRead(req.adminId);
  res.json({ read: true, modified: result.modified });
}));

module.exports = router;
