import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getPortalUser } from '../shared/portalUser';
import { jsonResponse } from '../shared/http';

async function handler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  return jsonResponse({ ok: true, user: getPortalUser(request) });
}

app.http('me', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me',
  handler
});