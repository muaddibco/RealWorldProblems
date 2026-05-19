import { HttpRequest } from '@azure/functions';
import { PortalUser } from '../types';
import { getPortalConfig } from './portalConfig';

function decodeClientPrincipal(value: string): PortalUser | null {
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    const principal = JSON.parse(decoded) as {
      userId?: string;
      userDetails?: string;
      identityProvider?: string;
      userRoles?: string[];
      claims?: Array<{ typ?: string; val?: string }>;
    };

    const email = principal.claims?.find((claim) => claim.typ === 'email' || claim.typ === 'preferred_username')?.val;
    const displayName = principal.userDetails ?? email ?? principal.userId ?? 'Authenticated user';

    return {
      isAuthenticated: true,
      userId: principal.userId,
      displayName,
      email,
      authProvider: principal.identityProvider,
      roles: principal.userRoles ?? []
    };
  } catch {
    return null;
  }
}

export function getPortalUser(request: HttpRequest): PortalUser {
  const config = getPortalConfig();
  const principalHeader = request.headers.get('x-ms-client-principal');
  if (principalHeader) {
    const parsed = decodeClientPrincipal(principalHeader);
    if (parsed) {
      return parsed;
    }
  }

  const principalName = request.headers.get('x-ms-client-principal-name');
  if (principalName) {
    return { isAuthenticated: true, displayName: principalName, mock: false };
  }

  if (config.allowMockUser) {
    return {
      isAuthenticated: true,
      displayName: 'Mock Portal User',
      email: 'mock@local',
      authProvider: 'mock',
      roles: ['authenticated', 'admin'],
      mock: true
    };
  }

  return { isAuthenticated: false };
}