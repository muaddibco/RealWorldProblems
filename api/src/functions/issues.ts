import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listIssues, buildIssueSummary } from '../services/issuePortalService';
import { apiError, jsonResponse } from '../shared/http';

function parseBoolean(value: string | null): boolean {
  return value === 'true';
}

function parseLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function handler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const query = request.query;
    const result = await listIssues({
      status: query.get('status'),
      orchestrationStatus: query.get('orchestrationStatus'),
      stage: query.get('stage'),
      q: query.get('q'),
      defaultView: query.has('defaultView') ? parseBoolean(query.get('defaultView')) : true,
      limit: parseLimit(query.get('limit')),
      refresh: query.has('refresh') ? parseBoolean(query.get('refresh')) : false
    });

      return jsonResponse({ 
        ok: true, 
        issues: result.issues, 
        total: result.total, 
        summary: buildIssueSummary(result.issues),
        cacheInfo: {
          source: query.has('refresh') && parseBoolean(query.get('refresh')) ? 'github' : 'cache',
          timestamp: Date.now()
        }
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return apiError('Failed to list issues', message);
  }
}

app.http('issues', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'issues',
  handler
});