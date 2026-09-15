import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { profileIdParamSchema, updateProfileSchema } from '../validators/profiles.validators.js';
import * as profilesController from '../controllers/profiles.controller.js';

const router = Router();

router.use(requireAuth); // profiles are authenticated-only per RLS policy

router.get('/:id', validate(profileIdParamSchema), profilesController.getProfile);
router.patch('/:id', validate(updateProfileSchema), profilesController.updateProfile);

export default router;
