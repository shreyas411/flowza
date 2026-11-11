/**
 * Instagram Webhook Ingestion & Processing
 * Implements:
 * - Meta hub challenge verification (GET /webhooks/instagram)
 * - HMAC SHA-256 signature verification (POST /webhooks/instagram)
 * - Idempotent event processing & deduplication
 * - Contact & Conversation creation or resolution
 * - Automation rules evaluation
 * - AI auto-responder dispatch
 * - Realtime WebSocket broadcast
 */

import crypto from 'crypto';
import { dbInstance, Contact, Conversation, Message } from '../db/database';
import { instagramProvider } from '../instagram/instagramProvider';
import { aiAssistantService } from '../services/aiService';
import { broadcastToOrg } from '../realtime/realtimeHub';

export async function processInstagramWebhookPayload(rawPayload: any, rawBodyStr: string, signatureHeader?: string): Promise<{
  processed: number;
  duplicate: number;
  errors: string[];
}> {
  // 1. Verify signature
  const isSigValid = instagramProvider.verifyWebhookSignature(rawBodyStr, signatureHeader);
  if (!isSigValid) {
    throw new Error('Invalid Meta Webhook Signature');
  }

  const results = { processed: 0, duplicate: 0, errors: [] as string[] };
  const stateDb = dbInstance.getState();

  // Meta Instagram Webhook structure has { object: 'instagram', entry: [ ... ] }
  const entries = rawPayload.entry || [];

  for (const entry of entries) {
    const instagramBusinessId = entry.id; // Target Instagram Account ID

    // Resolve Account & Organization
    const account = stateDb.instagramAccounts.find((a) => a.instagramBusinessId === instagramBusinessId);
    if (!account) {
      console.warn(`Incoming webhook for unknown Instagram business account ID: ${instagramBusinessId}`);
      results.errors.push(`Account ${instagramBusinessId} not found`);
      continue;
    }

    const organizationId = account.organizationId;

    // Check for messaging events
    const messagingEvents = entry.messaging || [];
    for (const event of messagingEvents) {
      const senderPlatformUserId = event.sender?.id;
      const messageObj = event.message;

      // Handle delivery / read confirmations
      if (event.delivery || event.read) {
        const mids = event.delivery?.mids || [];
        for (const mid of mids) {
          const existingMsg = stateDb.messages.find((m) => m.platformMessageId === mid);
          if (existingMsg) {
            existingMsg.status = event.read ? 'READ' : 'DELIVERED';
            broadcastToOrg(organizationId, 'message:updated', existingMsg);
          }
        }
        results.processed++;
        continue;
      }

      if (!messageObj) continue;

      const platformMessageId = messageObj.mid || `mid_${crypto.randomBytes(8).toString('hex')}`;

      // Deduplication check
      const alreadyProcessed = stateDb.messages.some((m) => m.platformMessageId === platformMessageId);
      if (alreadyProcessed) {
        results.duplicate++;
        continue;
      }

      const text = messageObj.text || (messageObj.attachments ? '[Attachment]' : '');
      const nowIso = new Date().toISOString();

      // Resolve or Create Contact
      let contact = stateDb.contacts.find(
        (c) => c.organizationId === organizationId && c.platformUserId === senderPlatformUserId
      );

      if (!contact) {
        const senderUsername = `ig_user_${senderPlatformUserId.slice(-4)}`;
        contact = {
          id: `cnt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          organizationId,
          platform: 'INSTAGRAM',
          platformUserId: senderPlatformUserId,
          username: senderUsername,
          displayName: senderUsername,
          profilePictureUrl: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 1000)}?w=150`,
          leadStatus: 'NEW',
          customFields: {},
          tags: ['Inbound'],
          createdAt: nowIso,
          lastInteractionAt: nowIso,
        };
        stateDb.contacts.push(contact);
        broadcastToOrg(organizationId, 'contact:updated', contact);
      } else {
        contact.lastInteractionAt = nowIso;
      }

      // Resolve or Create Conversation
      let conversation = stateDb.conversations.find(
        (c) => c.organizationId === organizationId && c.contactId === contact!.id && c.instagramAccountId === account.id
      );

      if (!conversation) {
        conversation = {
          id: `conv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          organizationId,
          instagramAccountId: account.id,
          contactId: contact.id,
          platformThreadId: `t_ig_${senderPlatformUserId}`,
          status: 'OPEN',
          isAiHandled: true,
          isAiPaused: false,
          unreadCount: 1,
          lastMessageSnippet: text.slice(0, 100),
          lastMessageAt: nowIso,
          lastCustomerMessageAt: nowIso,
          humanAgentEligibleUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          tags: ['New Message'],
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        stateDb.conversations.push(conversation);
      } else {
        conversation.unreadCount += 1;
        conversation.lastMessageSnippet = text.slice(0, 100);
        conversation.lastMessageAt = nowIso;
        conversation.lastCustomerMessageAt = nowIso;
        conversation.status = conversation.status === 'RESOLVED' ? 'OPEN' : conversation.status;
        conversation.humanAgentEligibleUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        conversation.updatedAt = nowIso;
      }

      // Persist Incoming Message
      const incomingMessage: Message = {
        id: `msg_in_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        organizationId,
        conversationId: conversation.id,
        platformMessageId,
        senderType: 'CUSTOMER',
        senderName: contact.displayName || contact.username,
        text,
        status: 'DELIVERED',
        isPrivateReply: false,
        isInternalNote: false,
        policyCheckPassed: true,
        createdAt: nowIso,
      };

      stateDb.messages.push(incomingMessage);

      // Evaluate Automation Rules
      evaluateAutomationRules(organizationId, conversation, text);

      dbInstance.commit();
      results.processed++;

      // Realtime publication
      broadcastToOrg(organizationId, 'message:new', incomingMessage);
      broadcastToOrg(organizationId, 'conversation:updated', conversation);

      // Asynchronously trigger AI response engine
      setTimeout(async () => {
        try {
          await aiAssistantService.handleIncomingMessageAI(organizationId, conversation!.id, text);
        } catch (err) {
          console.error('Error in background AI message handler', err);
        }
      }, 300);
    }
  }

  return results;
}

/**
 * Evaluates automation rules for an incoming message
 */
function evaluateAutomationRules(organizationId: string, conversation: Conversation, messageText: string) {
  const stateDb = dbInstance.getState();
  const rules = stateDb.automationRules.filter((r) => r.organizationId === organizationId && r.isActive);
  const lowerText = messageText.toLowerCase();

  for (const rule of rules) {
    let triggered = false;

    if (rule.triggerType === 'KEYWORD_DETECTED' && rule.keywordMatch) {
      const keywords = rule.keywordMatch.toLowerCase().split(',').map((k) => k.trim());
      triggered = keywords.some((k) => lowerText.includes(k));
    } else if (rule.triggerType === 'HUMAN_REQUESTED') {
      triggered = lowerText.includes('human') || lowerText.includes('agent') || lowerText.includes('representative');
    } else if (rule.triggerType === 'INCOMING_MESSAGE') {
      triggered = true;
    }

    if (triggered) {
      // Execute Action
      if (rule.actionType === 'ADD_TAG' && rule.actionPayload?.tag) {
        if (!conversation.tags.includes(rule.actionPayload.tag)) {
          conversation.tags.push(rule.actionPayload.tag);
        }
      } else if (rule.actionType === 'ESCALATE_HUMAN') {
        conversation.isAiPaused = true;
        conversation.isAiHandled = false;
        if (!conversation.tags.includes('Escalated')) conversation.tags.push('Escalated');
      } else if (rule.actionType === 'CHANGE_LEAD_STATUS' && rule.actionPayload?.leadStatus) {
        const contact = stateDb.contacts.find((c) => c.id === conversation.contactId);
        if (contact) {
          contact.leadStatus = rule.actionPayload.leadStatus;
          if (rule.actionPayload.addTag && !contact.tags.includes(rule.actionPayload.addTag)) {
            contact.tags.push(rule.actionPayload.addTag);
          }
        }
      }

      stateDb.automationExecutions.push({
        id: `exec_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        organizationId,
        ruleId: rule.id,
        ruleName: rule.name,
        conversationId: conversation.id,
        status: 'SUCCESS',
        resultSummary: `Rule "${rule.name}" triggered on message snippet "${messageText.slice(0, 30)}..."`,
        createdAt: new Date().toISOString(),
      });
    }
  }
}
