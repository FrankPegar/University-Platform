import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { searchTagsSchema } from '../validators/tags.validators.js';
import * as tagsController from '../controllers/tags.controller.js';

const router = Router();

router.get('/', validate(searchTagsSchema), tagsController.searchTags);

export default router;
