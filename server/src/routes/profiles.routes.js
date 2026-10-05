import { Router, raw } from 'express';
import { AVATAR_MAX_BYTES } from '../services/avatars.service.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { profileIdParamSchema, updateProfileSchema } from '../validators/profiles.validators.js';
import * as profilesController from '../controllers/profiles.controller.js';

const router = Router();

router.use(requireAuth); // profiles are authenticated-only per RLS policy

router.post('/:id/avatar', validate(profileIdParamSchema), profilesController.requireOwnProfile,
  raw({ type: () => true, limit: AVATAR_MAX_BYTES }), profilesController.uploadAvatar);
router.delete('/:id/avatar', validate(profileIdParamSchema), profilesController.requireOwnProfile, profilesController.removeAvatar);

router.get('/:id', validate(profileIdParamSchema), profilesController.getProfile);
router.patch('/:id', validate(updateProfileSchema), profilesController.updateProfile);

export default router;
