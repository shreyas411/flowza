# InstaFlow CRM - Production Instagram Multi-Tenant CRM SaaS

A lightweight, production-grade, multi-tenant Instagram CRM SaaS application built for modern businesses, e-commerce stores, and marketing agencies.

## Key Modules & Features

1. **Multi-Tenancy & Workspace Isolation**:
   - Organization types: `BUSINESS` and `AGENCY` (managing multi-client Instagram accounts).
   - Strict tenant isolation: every database record references `organizationId`.
   - Role-Based Access Control (RBAC): `OWNER`, `ADMIN`, `AGENT`, `VIEWER`.
   - Account-level agency isolation: agents can be restricted to specific Instagram accounts.

2. **Official Meta Instagram Platform Integration (Graph API v21.0)**:
   - Instagram API with Instagram Login OAuth flow.
   - Permissions: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`, `instagram_business_content_publish`.
   - AES-256-GCM envelope encryption for stored access tokens.
   - 60-day long-lived token lifecycle tracking.
   - Webhook ingress at `GET /webhooks/instagram` (hub challenge verification) and `POST /webhooks/instagram` (HMAC SHA-256 raw-body signature validation).
   - Built-in Meta Sandbox & Event Simulator for instantaneous development testing without needing live Meta app review.

3. **Unified 3-Column Instagram Inbox**:
   - Filter views: All, Unread, Assigned to Me, Unassigned, AI Handled, Human Handled, Resolved.
   - Account filter dropdown.
   - Live incoming messages, delivery & read receipts.
   - Internal team notes with distinct yellow background (strictly never sent to Instagram).
   - Real-time event broadcasting over WebSocket (`/ws`).

4. **Meta Policy Engine & Outbound Message Guardrails**:
   - **24-Hour Standard Messaging Window**: Outbound messages are validated against customer's last interaction timestamp.
   - **Human Agent Exception Tag**: Allows qualifying human agents to respond up to 7 days; automated AI messaging is strictly blocked by policy after 24h.
   - Outbound state machine: `PENDING` -> `SENDING` -> `SENT` -> `DELIVERED` -> `READ` / `FAILED`.

5. **AI Assistant & Knowledge Grounding**:
   - Operational modes: `DISABLED`, `SUGGESTION`, `AUTOMATIC`, `HYBRID`.
   - Native integration with Gemini 2.5 Flash (`@google/genai`) and OpenAI API models.
   - Grounded knowledge retrieval from uploaded FAQs, shipping policies, and product details.
   - Prompt injection defense: untrusted customer input cannot override system safety boundaries.
   - Automatic Human Handoff when customer asks for an agent or expresses refund complaints.

6. **Customer CRM**:
   - Contact records with voluntary email, phone, and custom fields.
   - Lead qualification pipeline: `NEW`, `QUALIFIED`, `FOLLOW_UP`, `CONVERTED`, `LOST`.
   - Tag management and customer conversation history.

7. **Automations & Rules Engine**:
   - Event triggers: `KEYWORD_DETECTED`, `HUMAN_REQUESTED`, `INCOMING_MESSAGE`.
   - Actions: `ADD_TAG`, `CHANGE_LEAD_STATUS`, `ESCALATE_HUMAN`, `ENABLE_AI`.

8. **Analytics & Subscriptions**:
   - Response times, resolution velocity, AI automation rate, lead conversion funnels.
   - Subscriptions: `STARTER`, `GROWTH`, `PRO`, `AGENCY` with database-configurable limits.

---

## Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React icons, Inter typography.
- **Backend**: Node.js, Express, WebSocket server (`ws`), Meta Instagram Graph API Provider.
- **Database Schema**: PostgreSQL with pgvector schema defined in `prisma/schema.prisma`.
- **Runtime Environment**: Full-stack Node.js Express server mounting Vite middlewares in development on port 3000.
- **Containers**: Dockerfile & docker-compose.yml with PostgreSQL (pgvector) and Redis.

---

## Meta Developer Portal Setup Guide

1. Go to [developers.facebook.com](https://developers.facebook.com) and create a **Business** app type.
2. Under **Add Products**, add **Instagram Platform**.
3. In **Instagram Platform > Basic Display & Login Settings**, add:
   - **Valid OAuth Redirect URIs**: `http://localhost:3000/api/v1/integrations/instagram/callback`
4. In **Webhooks > Instagram**:
   - **Callback URL**: `http://localhost:3000/webhooks/instagram`
   - **Verify Token**: Configured in `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`
   - **Subscription Fields**: `messages`, `messaging_postbacks`, `message_reactions`, `message_reads`.
5. For App Review, submit `instagram_business_manage_messages` and `instagram_business_manage_comments`.
