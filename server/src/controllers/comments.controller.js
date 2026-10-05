import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import * as commentsService from '../services/comments.service.js';

export const listCommentsForQuestion = asyncHandler(async (req, res) => {
  ok(res, await commentsService.listCommentsForQuestion(req.params.id));
});

export const listCommentsForAnswer = asyncHandler(async (req, res) => {
  ok(res, await commentsService.listCommentsForAnswer(req.params.id));
});

export const createComment = asyncHandler(async (req, res) => {
  const comment = await commentsService.createComment({
    ...req.body,
    author_id: req.user.id, // derived from the verified token, not the client
  });
  ok(res, comment, 201);
});

export const deleteComment = asyncHandler(async (req, res) => {
  await commentsService.deleteComment(req.params.id, req.user.id);
  ok(res, { deleted: true });
});

export const updateComment = asyncHandler(async (req, res) => {
  ok(res, await commentsService.updateComment(req.params.id, req.user.id, req.body));
});
