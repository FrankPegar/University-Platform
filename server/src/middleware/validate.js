import { AppError } from '../utils/AppError.js';

/**
 * Takes a zod schema shaped as { body, query, params } and validates the
 * incoming request against it. On success, req.body/query/params are
 * replaced with the parsed (and type-coerced) values.
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return next(new AppError('Validation failed', 400, details));
  }

  if (result.data.body !== undefined) req.body = result.data.body;
  if (result.data.query !== undefined) req.query = result.data.query;
  if (result.data.params !== undefined) req.params = result.data.params;
  next();
};
