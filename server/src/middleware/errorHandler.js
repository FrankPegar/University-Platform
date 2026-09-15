import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const statusCode = err instanceof AppError ? err.statusCode : err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (statusCode >= 500) {
    console.error('[unhandled error]', err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}
