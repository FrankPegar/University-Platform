import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import * as votesService from '../services/votes.service.js';

export const addVote = asyncHandler(async (req, res) => {
  const vote = await votesService.addVote({ ...req.body, user_id: req.user.id });
  ok(res, vote, 201);
});

export const removeVote = asyncHandler(async (req, res) => {
  await votesService.removeVote({ ...req.body, user_id: req.user.id });
  ok(res, { removed: true });
});
