import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { createCommentSchema, commentIdParamSchema, updateCommentSchema } from '../validators/comment.validators.js';
import * as commentsController from '../controllers/comments.controller.js';

const router = Router();

router.use(requireAuth); // Q&A content is authenticated-only per RLS policy

router.post('/', validate(createCommentSchema), commentsController.createComment);
router.patch('/:id', validate(updateCommentSchema), commentsController.updateComment);
router.delete('/:id', validate(commentIdParamSchema), commentsController.deleteComment);

export default router;
