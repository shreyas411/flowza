/**
 * API client: sends the session token and the active organization on every request.
 */

const TOKEN_KEY = 'flowza_token';
const ORG_KEY = 'flowza_org';

let currentOrgId = localStorage.getItem(ORG_KEY) || '';
let authToken = localStorage.getItem(TOKEN_KEY) || '';

export function setApiTenant(orgId: string) {
  currentOrgId = orgId;
  localStorage.setItem(ORG_KEY, orgId);
}

export function setAuthToken(token: string | null) {
  authToken = token || '';
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ORG_KEY);
    currentOrgId = '';
  }
}

export function getApiTenant() {
  return { orgId: currentOrgId, token: authToken };
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (currentOrgId) headers.set('x-organization-id', currentOrgId);
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Session expired or revoked: drop it and go back to the login screen.
    if (response.status === 401 && authToken) {
      setAuthToken(null);
      window.location.reload();
    }
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const data = await response.json();
      if (data.error) errorMsg = data.error;
    } catch (e) {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}
