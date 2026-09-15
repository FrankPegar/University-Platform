export const ok = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ success: true, data });
