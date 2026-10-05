import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import * as profilesController from '../controllers/profiles.controller.js';

import authRoutes from './auth.routes.js';
import profilesRoutes from './profiles.routes.js';
import departmentsRoutes from './departments.routes.js';
import tagsRoutes from './tags.routes.js';
import questionsRoutes from './questions.routes.js';
import answersRoutes from './answers.routes.js';
import commentsRoutes from './comments.routes.js';
import votesRoutes from './votes.routes.js';
import notificationsRoutes from './notifications.routes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));

// Convenience alias for "my own profile" - GET /api/me
router.get('/me', requireAuth, profilesController.getMe);

router.use('/auth', authRoutes);
router.use('/profiles', profilesRoutes);
router.use('/departments', departmentsRoutes);
router.use('/tags', tagsRoutes);
router.use('/questions', questionsRoutes);
router.use('/answers', answersRoutes);
router.use('/comments', commentsRoutes);
router.use('/votes', votesRoutes);
router.use('/notifications', notificationsRoutes);

export default router;
