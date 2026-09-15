import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import * as authService from '../services/auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerStudent(req.body);
  ok(res, result, 201);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.loginStudent(req.body);
  ok(res, result);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logoutStudent(req.accessToken);
  ok(res, { loggedOut: true });
});
