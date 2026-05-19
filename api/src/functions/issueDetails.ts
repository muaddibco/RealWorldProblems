import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getIssueDetails } from '../services/issuePortalService';
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
    const issue = await getIssueDetails(issueNumber);
    if (!issue) {
      return apiError('Issue not found', { issueNumber }, 404);
    }

    return jsonResponse({ ok: true, issue });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return apiError('Failed to load issue details', message);
  }
}

app.http('issueDetails', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'issues/{number:int}',
  handler
});