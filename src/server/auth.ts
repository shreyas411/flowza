/**
 * Password hashing (scrypt) and opaque session tokens stored hashed in the `sessions` collection.
 */
import crypto from 'crypto';
import { promisify } from 'util';
import { dbInstance, User } from './db/database';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hex] = (stored || '').split('$');
  if (algo !== 'scrypt' || !salt || !hex) return false; // legacy/placeholder hashes never match
  const hash = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(hash, expected);
}

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  dbInstance.getState().sessions.push({
    id: `ses_${crypto.randomBytes(8).toString('hex')}`,
    userId,
    tokenHash: sha256(token),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    createdAt: new Date(now).toISOString(),
  });
  dbInstance.commit();
  return token;
}

export function userFromToken(token: string | undefined | null): User | null {
  if (!token) return null;
  const state = dbInstance.getState();
  const hash = sha256(token);
  const session = state.sessions.find((s) => s.tokenHash === hash);
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null;
  const user = state.users.find((u) => u.id === session.userId);
  return user && user.status === 'ACTIVE' ? user : null;
}

export function revokeSession(token: string | undefined) {
  if (!token) return;
  const state = dbInstance.getState();
  const hash = sha256(token);
  state.sessions = state.sessions.filter((s) => s.tokenHash !== hash);
  dbInstance.commit();
}

export function revokeAllSessions(userId: string) {
  const state = dbInstance.getState();
  state.sessions = state.sessions.filter((s) => s.userId !== userId);
  dbInstance.commit();
}

/** Org the user may act in: the requested one if they're an active member (or super admin), else their first. */
export function resolveOrgForUser(user: User, requestedOrgId?: string | null): string | null {
  const state = dbInstance.getState();
  const memberOrgIds = state.organizationMembers
    .filter((m) => m.userId === user.id && m.status === 'ACTIVE')
    .map((m) => m.organizationId);
  if (requestedOrgId) {
    if (memberOrgIds.includes(requestedOrgId)) return requestedOrgId;
    if (user.isSuperAdmin && state.organizations.some((o) => o.id === requestedOrgId)) return requestedOrgId;
    return null;
  }
  return memberOrgIds[0] ?? null;
}

export function bearerToken(header: string | undefined): string | undefined {
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

/** HMAC-signed OAuth state so the unauthenticated Meta callback can trust the orgId in it. */
const stateSecret = () => {
  const s = process.env.JWT_SECRET || '';
  if (s.length < 32) throw new Error('JWT_SECRET must be set (at least 32 chars)');
  return s;
};
export function signState(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}
export function verifyState(state: string): any {
  const [body, sig] = (state || '').split('.');
  const expected = crypto.createHmac('sha256', stateSecret()).update(body || '').digest('base64url');
  if (!body || !sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('Invalid OAuth state signature');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (Date.now() - payload.timestamp > 15 * 60 * 1000) throw new Error('OAuth state expired');
  return payload;
}
