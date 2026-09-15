import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listQuestionsSchema,
  createQuestionSchema,
  questionIdParamSchema,
  updateQuestionSchema,
} from '../validators/question.validators.js';
import { createAnswerSchema } from '../validators/answer.validators.js';
import { parentIdParamSchema } from '../validators/comment.validators.js';
import * as questionsController from '../controllers/questions.controller.js';
import * as answersController from '../controllers/answers.controller.js';
import * as commentsController from '../controllers/comments.controller.js';

const router = Router();

router.use(requireAuth); // Q&A content is authenticated-only per RLS policy

router.get('/', validate(listQuestionsSchema), questionsController.listQuestions);
router.post('/', validate(createQuestionSchema), questionsController.createQuestion);
router.get('/:id', validate(questionIdParamSchema), questionsController.getQuestion);
router.patch('/:id', validate(updateQuestionSchema), questionsController.updateQuestion);
router.delete('/:id', validate(questionIdParamSchema), questionsController.deleteQuestion);

router.get('/:id/answers', validate(parentIdParamSchema), answersController.listAnswers);
router.post('/:id/answers', validate(createAnswerSchema), answersController.createAnswer);

router.get('/:id/comments', validate(parentIdParamSchema), commentsController.listCommentsForQuestion);

export default router;
