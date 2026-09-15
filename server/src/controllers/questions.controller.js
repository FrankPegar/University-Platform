import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import * as questionsService from '../services/questions.service.js';

export const listQuestions = asyncHandler(async (req, res) => {
  const { department_id, sort, search, page, limit } = req.query;
  const result = await questionsService.listQuestions({
    department_id,
    sort,
    search,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  ok(res, result);
});

export const createQuestion = asyncHandler(async (req, res) => {
  const question = await questionsService.createQuestion({
    ...req.body,
    author_id: req.user.id, // derived from the verified token, not the client
  });
  ok(res, question, 201);
});

export const getQuestion = asyncHandler(async (req, res) => {
  ok(res, await questionsService.getQuestionById(req.params.id));
});

export const updateQuestion = asyncHandler(async (req, res) => {
  ok(res, await questionsService.updateQuestion(req.params.id, req.user.id, req.body));
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  await questionsService.deleteQuestion(req.params.id, req.user.id);
  ok(res, { deleted: true });
});
