import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listIssues } from '../services/issuePortalService';
import { apiError, jsonResponse } from '../shared/http';

async function handler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Force refresh from GitHub
    const result = await listIssues({
      refresh: true,
      defaultView: false,
      limit: 250
    });

    return jsonResponse({
      ok: true,
      issues: result.issues,
      total: result.total,
      message: 'Cache refreshed from GitHub'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return apiError('Failed to refresh issues cache', message);
  }
}

app.http('refreshCache', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'cache/refresh',
  handler
});
