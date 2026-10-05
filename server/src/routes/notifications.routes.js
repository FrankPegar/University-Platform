import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { listNotificationsSchema, notificationIdSchema, readAllNotificationsSchema } from '../validators/notification.validators.js';
import * as notifications from '../services/notifications.service.js';

const router = Router();
router.use(requireAuth);
router.get('/', validate(listNotificationsSchema), asyncHandler(async (req, res) => {
  ok(res, await notifications.listNotifications(req.user.id, req.query));
}));
router.patch('/read-all', validate(readAllNotificationsSchema), asyncHandler(async (req, res) => {
  ok(res, await notifications.markAllNotificationsRead(req.user.id));
}));
router.patch('/:id/read', validate(notificationIdSchema), asyncHandler(async (req, res) => {
  ok(res, await notifications.markNotificationRead(req.params.id, req.user.id));
}));
router.delete('/:id', validate(notificationIdSchema), asyncHandler(async (req, res) => {
  ok(res, await notifications.deleteNotification(req.params.id, req.user.id));
}));
export default router;
