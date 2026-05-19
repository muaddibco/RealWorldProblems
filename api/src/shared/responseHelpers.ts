import { apiError, jsonResponse } from './http';

export function ok(body: unknown) {
  return jsonResponse({ ok: true, ...((typeof body === 'object' && body !== null) ? body as object : { data: body }) });
}

export function fail(message: string, details?: unknown, status = 500) {
  return apiError(message, details, status);
}