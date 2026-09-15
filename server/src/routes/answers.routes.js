import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { answerIdParamSchema, updateAnswerSchema } from '../validators/answer.validators.js';
import { parentIdParamSchema } from '../validators/comment.validators.js';
import * as answersController from '../controllers/answers.controller.js';
import * as commentsController from '../controllers/comments.controller.js';

const router = Router();

router.use(requireAuth); // Q&A content is authenticated-only per RLS policy

router.patch('/:id', validate(updateAnswerSchema), answersController.updateAnswer);

// Authorization (only the QUESTION author may accept/unaccept) is enforced
// inside answersService.acceptAnswer/unacceptAnswer, not here.
router.post('/:id/accept', validate(answerIdParamSchema), answersController.acceptAnswer);
router.delete('/:id/accept', validate(answerIdParamSchema), answersController.unacceptAnswer);

router.get('/:id/comments', validate(parentIdParamSchema), commentsController.listCommentsForAnswer);

export default router;
