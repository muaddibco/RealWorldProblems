"use strict";
/**
 * Test utilities for E2E testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttpRequest = createHttpRequest;
exports.extractJsonFromResponse = extractJsonFromResponse;
exports.assertResponseStatus = assertResponseStatus;
exports.assertResponseBody = assertResponseBody;
exports.mockDurableClient = mockDurableClient;
exports.mockInvocationContext = mockInvocationContext;
function createHttpRequest(method = "POST", body, headers) {
    const headerMap = new Map();
    if (headers) {
        for (const [key, value] of Object.entries(headers)) {
            headerMap.set(key.toLowerCase(), value);
        }
    }
    const mockHeaders = {
        get: (name) => headerMap.get(name.toLowerCase()) || null,
        getSetCookie: () => [],
        append: () => { },
        forEach: () => { },
        has: (name) => headerMap.has(name.toLowerCase()),
        set: () => { },
        delete: () => { },
        entries: () => headerMap.entries(),
        keys: () => headerMap.keys(),
        values: () => headerMap.values(),
        [Symbol.iterator]: () => headerMap[Symbol.iterator]()
    };
    return {
        method,
        url: "http://localhost:7071/api/github/webhook",
        headers: mockHeaders,
        text: async () => body || "",
        query: new URLSearchParams()
    };
}
function extractJsonFromResponse(response) {
    if (typeof response.jsonBody === "object") {
        return response.jsonBody;
    }
    throw new Error("Response body is not JSON");
}
function assertResponseStatus(response, expectedStatus) {
    if (response.status !== expectedStatus) {
        throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
    }
}
function assertResponseBody(response, assertions) {
    const body = extractJsonFromResponse(response);
    assertions(body);
}
function mockDurableClient() {
    return {
        getStatus: jest.fn(),
        startNew: jest.fn(),
        raiseEvent: jest.fn(),
        terminate: jest.fn()
    };
}
function mockInvocationContext() {
    return {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    };
}
