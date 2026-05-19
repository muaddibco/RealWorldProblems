import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { jsonResponse } from '../shared/http';

async function handler(_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  return jsonResponse({ ok: true });
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler
});