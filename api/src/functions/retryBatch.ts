import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { retryIssues } from '../services/issuePortalService';
import { getPortalUser } from '../shared/portalUser';
import { apiError, jsonResponse } from '../shared/http';

async function handler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const payload = await request.json() as { issueNumbers?: number[]; reason?: string };
    const issueNumbers = Array.isArray(payload.issueNumbers) ? payload.issueNumbers.filter((value): value is number => Number.isFinite(value)) : [];
    const reason = payload.reason?.trim() || 'manual bulk retry from portal';
    const user = getPortalUser(request);
    const result = await retryIssues(issueNumbers, reason, user.displayName);
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return apiError('Failed to retry batch', message);
  }
}

app.http('retryBatch', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'issues/retry-batch',
  handler
});