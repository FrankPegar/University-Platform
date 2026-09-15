import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { registerSchema, loginSchema } from '../validators/auth.validators.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', requireAuth, authController.logout);

export default router;
