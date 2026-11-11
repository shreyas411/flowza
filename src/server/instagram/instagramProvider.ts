/**
 * Instagram Platform Provider Service: Instagram API with Unified Login
 * (https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login).
 * - Login: Facebook Login for Business dialog with config_id; uses the Meta app ID/secret
 * - Token: Business Integration System User token, scoped to the client's business portfolio
 * - Everything else (accounts, messages, webhook subscriptions) goes through graph.facebook.com
 */

import crypto from 'crypto';
import { dbInstance, decryptSecret, encryptSecret } from '../db/database';
import { signState, verifyState } from '../auth';

const NOT_CONFIGURED =
  'Instagram is not configured: set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET (Meta app ID/secret), INSTAGRAM_CONFIG_ID and INSTAGRAM_REDIRECT_URI';

export interface MetaSendResult {
  recipientId: string;
  messageId: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED';
  deliveryTimestamp: string;
  rawResponse?: any;
}

export class InstagramProviderService {
  private appId: string;
  private appSecret: string;
  private redirectUri: string;
  private webhookVerifyToken: string;
  private apiVersion: string;
  private configId: string;

  constructor() {
    this.appId = process.env.INSTAGRAM_APP_ID || '';
    this.appSecret = process.env.INSTAGRAM_APP_SECRET || '';
    this.redirectUri = process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:3000/api/v1/integrations/instagram/callback';
    this.webhookVerifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'instaflow_verify_secret_token';
    this.apiVersion = process.env.META_GRAPH_API_VERSION || 'v27.0';
    this.configId = process.env.INSTAGRAM_CONFIG_ID || '';
  }

  public isLiveCredentialsConfigured(): boolean {
    return Boolean(
      this.appId && 
      this.appId !== 'your_meta_app_id' && 
      this.appSecret && 
      this.appSecret !== 'your_meta_app_secret' &&
      this.configId
    );
  }

  /**
   * Generates secure OAuth initiation URL with CSRF state
   */
  public getOAuthAuthorizationUrl(organizationId: string, customState?: string): { url: string; state: string } {
    const statePayload = {
      orgId: organizationId,
      nonce: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
      custom: customState || '',
    };
    const state = signState(statePayload);

    if (!this.isLiveCredentialsConfigured()) throw new Error(NOT_CONFIGURED);
    // Permissions come from the Facebook Login for Business configuration (config_id), not a scope param.
    const params = new URLSearchParams({
      client_id: this.appId,
      config_id: this.configId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      override_default_response_type: 'true',
      prompt: 'login',
      state,
    });
    return { url: `https://www.facebook.com/${this.apiVersion}/dialog/oauth?${params}`, state };
  }

  /**
   * Exchanges OAuth authorization code for Access Token
   */
  public async exchangeOAuthCode(code: string, state: string): Promise<{ username: string; connected: string[] }> {
    const organizationId: string = verifyState(state).orgId;
    if (!this.isLiveCredentialsConfigured()) throw new Error(NOT_CONFIGURED);
    if (!code) throw new Error('Instagram login was cancelled');

    const graph = `https://graph.facebook.com/${this.apiVersion}`;
    const tokenParams = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: this.redirectUri,
      code,
    });
    const tokenResp = await fetch(`${graph}/oauth/access_token?${tokenParams}`);
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      throw new Error(`Meta OAuth exchange failed: ${tokenData.error?.message || JSON.stringify(tokenData)}`);
    }
    const accessToken: string = tokenData.access_token;
    // Expiry is chosen in the login configuration; a non-expiring token comes back without expires_in.
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : new Date(Date.now() + 10 * 365 * 86400_000).toISOString();

    // /me is the business system user; the shared Instagram accounts are listed separately.
    const accResp = await fetch(`${graph}/me/assigned_instagram_accounts?fields=id,username&access_token=${encodeURIComponent(accessToken)}`);
    const accData = await accResp.json();
    if (!accResp.ok) throw new Error(`Could not read Instagram accounts: ${accData.error?.message || JSON.stringify(accData)}`);
    let igAccounts: { id: string; username: string }[] = accData.data || [];
    if (!igAccounts.length) igAccounts = await this.accountsFromGrantedScopes(graph, accessToken);
    if (!igAccounts.length) throw new Error('No Instagram professional account was shared during login');

    const stateDb = dbInstance.getState();
    const now = new Date().toISOString();
    for (const ig of igAccounts) {
      const existing = stateDb.instagramAccounts.find((a) => a.instagramBusinessId === ig.id);
      if (existing && existing.organizationId !== organizationId) {
        throw new Error(`@${ig.username} is already connected to another workspace`);
      }
    }

    for (const ig of igAccounts) {
      // Without this subscription Meta does not deliver this account's DMs to our webhook.
      const subResp = await fetch(`${graph}/${ig.id}/subscribed_apps`, {
        method: 'POST',
        body: new URLSearchParams({ subscribed_fields: 'messages', access_token: accessToken }),
      });
      if (!subResp.ok) {
        const subErr = await subResp.json().catch(() => ({}));
        throw new Error(`Could not subscribe @${ig.username} to messages: ${subErr.error?.message || subResp.status}`);
      }

      const existing = stateDb.instagramAccounts.find((a) => a.instagramBusinessId === ig.id);
      // Reconnecting the same account refreshes it instead of creating a duplicate.
      const accountId = existing?.id ?? `ig_${ig.id}`;
      const accountData = {
        id: accountId,
        organizationId,
        instagramBusinessId: ig.id,
        username: ig.username,
        name: existing?.name || ig.username,
        profilePictureUrl: existing?.profilePictureUrl || '',
        accountType: existing?.accountType ?? ('BUSINESS' as const),
        isConnected: true,
        lastSyncAt: now,
        tokenExpiresAt: expiresAt,
        createdAt: existing?.createdAt ?? now,
      };
      if (existing) Object.assign(existing, accountData);
      else stateDb.instagramAccounts.push(accountData);

      stateDb.instagramTokens = stateDb.instagramTokens.filter((t) => t.instagramAccountId !== accountId);
      stateDb.instagramTokens.push({
        id: `tok_${crypto.randomBytes(6).toString('hex')}`,
        instagramAccountId: accountId,
        encryptedToken: encryptSecret(accessToken),
        tokenType: 'Bearer',
        scopes: ['instagram_basic', 'instagram_manage_messages'],
        expiresAt,
      });
    }
    dbInstance.commit();

    const connected = igAccounts.map((a) => a.username);
    return { username: connected.join(', @'), connected };
  }

  /** Fallback: the token's granular scopes list the Instagram account IDs the user granted. */
  private async accountsFromGrantedScopes(graph: string, accessToken: string): Promise<{ id: string; username: string }[]> {
    const appToken = encodeURIComponent(`${this.appId}|${this.appSecret}`);
    const dbgResp = await fetch(`${graph}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${appToken}`);
    const dbg = (await dbgResp.json()).data || {};
    console.log(`[instagram] token debug: type=${dbg.type} scopes=${JSON.stringify(dbg.scopes)} granular=${JSON.stringify(dbg.granular_scopes)}`);

    const ids = new Set<string>();
    for (const g of dbg.granular_scopes || []) {
      if (String(g.scope).startsWith('instagram_')) (g.target_ids || []).forEach((id: string) => ids.add(String(id)));
    }
    const accounts: { id: string; username: string }[] = [];
    for (const id of ids) {
      const r = await fetch(`${graph}/${id}?fields=id,username&access_token=${encodeURIComponent(accessToken)}`);
      const d = await r.json();
      console.log(`[instagram] target ${id}: ${r.status} ${JSON.stringify(d)}`);
      if (r.ok && d.username) accounts.push({ id: String(d.id), username: d.username });
    }
    if (accounts.length) return accounts;

    // Last resort: the Instagram accounts of the client's business portfolio the token belongs to.
    const t = `access_token=${encodeURIComponent(accessToken)}`;
    const me = await (await fetch(`${graph}/me?fields=id,name,client_business_id&${t}`)).json();
    console.log(`[instagram] me: ${JSON.stringify(me)}`);
    for (const path of [
      me.client_business_id && `${me.client_business_id}/instagram_accounts`,
      me.client_business_id && `${me.client_business_id}/owned_instagram_accounts`,
      'me/accounts?fields=instagram_business_account{id,username}',
    ].filter(Boolean)) {
      const sep = path.includes('?') ? '&' : '?fields=id,username&';
      const r = await fetch(`${graph}/${path}${sep}${t}`);
      const d = await r.json();
      console.log(`[instagram] ${path}: ${r.status} ${JSON.stringify(d).slice(0, 500)}`);
      for (const item of d.data || []) {
        const ig = item.instagram_business_account || item;
        if (ig?.id && ig.username) accounts.push({ id: String(ig.id), username: ig.username });
      }
      if (accounts.length) break;
    }
    return accounts;
  }

  /**
   * Send text message via Instagram Graph API
   * POST https://graph.facebook.com/{version}/{ig-account-id}/messages
   */
  public async sendTextMessage(
    instagramAccountId: string,
    recipientPlatformUserId: string,
    text: string,
    options?: {
      tag?: 'HUMAN_AGENT';
      isPrivateReply?: boolean;
      commentId?: string;
    }
  ): Promise<MetaSendResult> {
    const stateDb = dbInstance.getState();
    const account = stateDb.instagramAccounts.find((a) => a.id === instagramAccountId);
    if (!account) {
      throw new Error(`Instagram account ${instagramAccountId} not found`);
    }

    const tokenObj = stateDb.instagramTokens.find((t) => t.instagramAccountId === instagramAccountId);
    const token = tokenObj ? decryptSecret(tokenObj.encryptedToken) : '';

    if (!this.isLiveCredentialsConfigured()) throw new Error(NOT_CONFIGURED);
    if (!token) throw new Error(`No access token stored for Instagram account ${instagramAccountId}; reconnect it`);

    {
      // Official Meta Graph API payload
      const payload: any = {
        recipient: { id: recipientPlatformUserId },
        message: { text },
        messaging_type: options?.tag === 'HUMAN_AGENT' ? 'MESSAGE_TAG' : 'RESPONSE',
      };

      if (options?.tag === 'HUMAN_AGENT') {
        payload.tag = 'HUMAN_AGENT';
      }

      const response = await fetch(`https://graph.facebook.com/${this.apiVersion}/${account.instagramBusinessId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Meta API error: ${data.error?.message || JSON.stringify(data)}`);
      }

      return {
        recipientId: recipientPlatformUserId,
        messageId: data.message_id || `mid_${crypto.randomBytes(8).toString('hex')}`,
        status: 'SENT',
        deliveryTimestamp: new Date().toISOString(),
        rawResponse: data,
      };
    }
  }

  /**
   * Verify Instagram Webhook Signature using HMAC SHA256
   */
  public verifyWebhookSignature(rawBody: string | Buffer, signatureHeader?: string): boolean {
    // Never accept unsigned webhooks: without the app secret we cannot verify Meta sent them.
    if (!this.isLiveCredentialsConfigured() || !signatureHeader) return false;

    const signature = signatureHeader.replace('sha256=', '');
    const expectedSignature = crypto
      .createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex');

    return signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'));
  }

  /**
   * Verifies Webhook Hub Subscription (GET /webhooks/instagram)
   */
  public verifyWebhookChallenge(query: any): { isValid: boolean; challenge?: string } {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === this.webhookVerifyToken) {
      return { isValid: true, challenge };
    }
    return { isValid: false };
  }
}

export const instagramProvider = new InstagramProviderService();
