import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import * as profilesService from '../services/profiles.service.js';

export const getMe = asyncHandler(async (req, res) => {
  const profile = await profilesService.getProfileById(req.user.id);
  ok(res, profile);
});

export const getProfile = asyncHandler(async (req, res) => {
  const profile = await profilesService.getProfileById(req.params.id);
  ok(res, profile);
});

export const updateProfile = asyncHandler(async (req, res) => {
  if (req.params.id !== req.user.id) {
    throw new AppError('You can only update your own profile', 403);
  }
  const profile = await profilesService.updateProfile(req.params.id, req.body);
  ok(res, profile);
});
