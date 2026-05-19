import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { retryIssue } from '../services/issuePortalService';
import { getPortalUser } from '../shared/portalUser';
import { apiError, jsonResponse } from '../shared/http';

function parseIssueNumber(request: HttpRequest): number | null {
  const raw = request.params.number;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

async function handler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const issueNumber = parseIssueNumber(request);
  if (issueNumber === null) {
    return apiError('Invalid issue number', { issueNumber: request.params.number }, 400);
  }

  try {
    const payload = await request.json() as { reason?: string };
    const reason = payload.reason?.trim() || 'manual retry from portal';
    const user = getPortalUser(request);
    const result = await retryIssue(issueNumber, reason, user.displayName);

    if (!result.ok) {
      return jsonResponse({ ok: false, issueNumber: result.issueNumber, message: result.message, retriedTooRecently: result.retriedTooRecently ?? false }, 400);
    }

    return jsonResponse({ ok: true, issueNumber: result.issueNumber, stageLabel: result.stageLabel, strategy: result.strategy, message: result.message });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return apiError('Failed to retry issue', message);
  }
}

app.http('retryIssue', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'issues/{number:int}/retry',
  handler
});