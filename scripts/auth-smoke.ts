/**
 * End-to-end auth + tenancy check against a running server.
 * Usage: npx tsx scripts/auth-smoke.ts [baseUrl]   (default http://localhost:3000)
 */
import 'dotenv/config';
import assert from 'node:assert/strict';

const BASE = process.argv[2] || 'http://localhost:3000';
const uniq = Date.now().toString(36);

async function call(path: string, opts: { method?: string; body?: any; token?: string; org?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.org) headers['x-organization-id'] = opts.org;
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function register(name: string) {
  const email = `${name}-${uniq}@example.test`;
  const r = await call('/api/v1/auth/register', {
    method: 'POST',
    body: { fullName: name, email, password: 'CorrectHorse9!', organizationName: `${name} Co` },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.ok(r.body.token && r.body.organizationId);
  return { email, token: r.body.token as string, orgId: r.body.organizationId as string };
}

async function readInviteToken(email: string): Promise<string> {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const r = await client.query(
    "SELECT data->>'token' AS token FROM records WHERE collection = 'invitations' AND data->>'email' = $1 AND data->>'status' = 'PENDING'",
    [email]
  );
  await client.end();
  return r.rows[0].token;
}

const a = await register('alice');
const b = await register('bob');

// No / bad token
assert.equal((await call('/api/v1/auth/me')).status, 401);
assert.equal((await call('/api/v1/conversations', { token: 'nope' })).status, 401);
// Old header spoofing no longer works
assert.equal((await call('/api/v1/conversations', { org: a.orgId })).status, 401);

// Valid session sees own org
const me = await call('/api/v1/auth/me', { token: a.token });
assert.equal(me.status, 200);
assert.equal(me.body.organization.id, a.orgId);

// Cross-tenant access is refused
assert.equal((await call('/api/v1/conversations', { token: a.token, org: b.orgId })).status, 403);
// Non-super-admin can't hit admin routes
assert.equal((await call('/api/v1/admin/users', { token: a.token })).status, 403);

// Wrong password rejected, right one accepted
assert.equal((await call('/api/v1/auth/login', { method: 'POST', body: { email: a.email, password: 'wrong-password' } })).status, 401);
const login = await call('/api/v1/auth/login', { method: 'POST', body: { email: a.email, password: 'CorrectHorse9!' } });
assert.equal(login.status, 200);

// Change password requires the current one
assert.equal(
  (await call('/api/v1/auth/change-password', { method: 'POST', token: login.body.token, body: { currentPassword: 'bad', newPassword: 'Another9Pass!' } })).status,
  400
);

// Logout revokes the session
assert.equal((await call('/api/v1/auth/logout', { method: 'POST', token: login.body.token })).status, 200);
assert.equal((await call('/api/v1/auth/me', { token: login.body.token })).status, 401);

// Unsigned webhooks are rejected
const wh = await fetch(`${BASE}/webhooks/instagram`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"object":"instagram","entry":[]}' });
assert.equal(wh.status, 400);

// Invite flow (token is read from the server's DB since email isn't readable here)
const inviteEmail = `carol-${uniq}@example.test`;
const inv = await call('/api/v1/members/invite', { method: 'POST', token: b.token, body: { email: inviteEmail, role: 'AGENT' } });
assert.equal(inv.status, 200, JSON.stringify(inv.body));
assert.equal(inv.body.invitation.token, undefined, 'invite token must not be returned to the inviter');
assert.equal((await call('/api/v1/members/invite', { method: 'POST', token: b.token, body: { email: 'not-an-email' } })).status, 400);
const inviteToken = await readInviteToken(inviteEmail);
const info = await call('/api/v1/auth/invite-info', { method: 'POST', body: { token: inviteToken } });
assert.equal(info.status, 200);
assert.equal(info.body.needsPassword, true);
assert.equal((await call('/api/v1/auth/accept-invite', { method: 'POST', body: { token: inviteToken, password: 'short' } })).status, 400);
const acc = await call('/api/v1/auth/accept-invite', { method: 'POST', body: { token: inviteToken, password: 'CarolPass99!', fullName: 'Carol' } });
assert.equal(acc.status, 200);
assert.equal((await call('/api/v1/auth/me', { token: acc.body.token })).body.organization.id, b.orgId);
assert.equal((await call('/api/v1/auth/accept-invite', { method: 'POST', body: { token: inviteToken, password: 'CarolPass99!' } })).status, 400, 'invite is single-use');
// Invited agent can't manage members
assert.equal((await call('/api/v1/members/invite', { method: 'POST', token: acc.body.token, body: { email: `x-${uniq}@example.test` } })).status, 403);
// Re-inviting an active member is refused
assert.equal((await call('/api/v1/members/invite', { method: 'POST', token: b.token, body: { email: inviteEmail } })).status, 400);

console.log('auth smoke: all checks passed');
console.log(`ALICE_TOKEN=${a.token}`);
