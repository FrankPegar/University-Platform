const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(message, statusCode, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Every call to the Express API goes through here. Handles JSON encoding,
 * attaching the bearer token when present, and unwrapping the
 * { success, data } / { success, error } response shape used by every
 * endpoint in server/src.
 */
async function request(path, { method = 'GET', body, token, params, file } = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
  }

  const headers = { 'Content-Type': file ? file.type : 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: file || (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(
      'Could not reach the server. Check that the API is running and VITE_API_URL is correct.',
      0
    );
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message = payload?.error?.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload?.error?.details);
  }

  return payload?.data;
}

export const apiClient = {
  upload: (path, file, options) => request(path, { ...options, method: 'POST', file }),
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};
