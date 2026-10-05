import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import * as profilesService from '../services/profiles.service.js';
import * as avatarsService from '../services/avatars.service.js';

export function requireOwnProfile(req, res, next) {
  if (req.params.id !== req.user.id) return next(new AppError('You can only change your own profile picture', 403));
  next();
}

export const uploadAvatar = asyncHandler(async (req, res) => {
  await avatarsService.uploadAvatar(req.user.id, req.accessToken, req.body, req.get('Content-Type')?.split(';')[0].toLowerCase());
  ok(res, await profilesService.getProfileById(req.user.id));
});

export const removeAvatar = asyncHandler(async (req, res) => {
  await avatarsService.removeAvatar(req.user.id, req.accessToken);
  ok(res, await profilesService.getProfileById(req.user.id));
});

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
