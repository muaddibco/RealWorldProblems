/**
 * Test utilities for E2E testing
 */

import { HttpRequest, HttpResponseInit } from "@azure/functions";

export function createHttpRequest(
  method: "GET" | "POST" = "POST",
  body?: string,
  headers?: Record<string, string>
): Partial<HttpRequest> {
  const headerMap = new Map<string, string>();
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      headerMap.set(key.toLowerCase(), value);
    }
  }

  const mockHeaders = {
    get: (name: string) => headerMap.get(name.toLowerCase()) || null,
    getSetCookie: () => [],
    append: () => {},
    forEach: () => {},
    has: (name: string) => headerMap.has(name.toLowerCase()),
    set: () => {},
    delete: () => {},
    entries: () => headerMap.entries(),
    keys: () => headerMap.keys(),
    values: () => headerMap.values(),
    [Symbol.iterator]: () => headerMap[Symbol.iterator]()
  } as any;

  return {
    method,
    url: "http://localhost:7071/api/github/webhook",
    headers: mockHeaders,
    text: async () => body || "",
    query: new URLSearchParams()
  };
}

export function extractJsonFromResponse(response: HttpResponseInit): Record<string, unknown> {
  if (typeof response.jsonBody === "object") {
    return response.jsonBody as Record<string, unknown>;
  }
  throw new Error("Response body is not JSON");
}

export function assertResponseStatus(response: HttpResponseInit, expectedStatus: number): void {
  if (response.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
  }
}

export function assertResponseBody(
  response: HttpResponseInit,
  assertions: (body: Record<string, unknown>) => void
): void {
  const body = extractJsonFromResponse(response);
  assertions(body);
}

export function mockDurableClient() {
  return {
    getStatus: jest.fn(),
    startNew: jest.fn(),
    raiseEvent: jest.fn(),
    terminate: jest.fn()
  };
}

export function mockInvocationContext() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
}
