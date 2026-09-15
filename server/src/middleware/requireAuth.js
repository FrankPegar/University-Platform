import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Verifies the bearer token against Supabase Auth and attaches the
 * authenticated user to req.user. Every protected route relies on
 * req.user.id as the ONLY source of truth for "who is making this
 * request" — a user_id/author_id in the request body or params is never
 * trusted for authorization decisions.
 */
export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Missing or invalid Authorization header. Expected: Bearer <token>', 401);
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    throw new AppError('Invalid or expired access token', 401);
  }

  req.user = { id: data.user.id, email: data.user.email };
  req.accessToken = token;
  next();
});
