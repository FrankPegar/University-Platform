import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import * as answersService from '../services/answers.service.js';

export const listAnswers = asyncHandler(async (req, res) => {
  ok(res, await answersService.listAnswersForQuestion(req.params.id));
});

export const createAnswer = asyncHandler(async (req, res) => {
  const answer = await answersService.createAnswer({
    question_id: req.params.id,
    author_id: req.user.id, // derived from the verified token, not the client
    body: req.body.body,
  });
  ok(res, answer, 201);
});

export const updateAnswer = asyncHandler(async (req, res) => {
  ok(res, await answersService.updateAnswer(req.params.id, req.user.id, req.body));
});

export const acceptAnswer = asyncHandler(async (req, res) => {
  // req.user.id (the question author, verified server-side) is the only
  // identity used for the authorization check inside the service.
  ok(res, await answersService.acceptAnswer(req.params.id, req.user.id));
});

export const unacceptAnswer = asyncHandler(async (req, res) => {
  ok(res, await answersService.unacceptAnswer(req.params.id, req.user.id));
});
