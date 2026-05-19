import { ApiError } from '../types';

export function jsonResponse(body: unknown, status = 200): { status: number; jsonBody: unknown } {
  return { status, jsonBody: body };
}

export function apiError(message: string, details?: unknown, status = 500): { status: number; jsonBody: ApiError } {
  return { status, jsonBody: { ok: false, message, details } };
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : 'Unknown error';
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}