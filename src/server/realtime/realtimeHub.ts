/**
 * WebSocket Real-time Hub
 * Implements authenticated tenant-scoped real-time event broadcasting
 */

import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { userFromToken, resolveOrgForUser } from '../auth';
import { dbInstance } from '../db/database';

const dbUser = (id?: string) => dbInstance.getState().users.find((u) => u.id === id);

interface ClientConnection {
  ws: WebSocket;
  organizationId: string;
  userId?: string;
}

const activeClients = new Set<ClientConnection>();

export function initRealtimeServer(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    let clientConn: ClientConnection | null = null;

    // Parse query params if provided
    try {
      const url = new URL(req.url || '', 'http://localhost');
      const user = userFromToken(url.searchParams.get('token'));
      const orgId = user ? resolveOrgForUser(user, url.searchParams.get('orgId')) : null;
      if (!user || !orgId) {
        ws.close(4401, 'Unauthorized');
        return;
      }
      const userId = user.id;

      clientConn = { ws, organizationId: orgId, userId };
      activeClients.add(clientConn);

      // Send connection acknowledgement
      ws.send(JSON.stringify({
        event: 'connected',
        data: { organizationId: orgId, userId, timestamp: new Date().toISOString() },
      }));
    } catch (err) {
      console.warn('Realtime client connection parse error', err);
    }

    ws.on('message', (message: string) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (parsed.type === 'subscribe_org' && clientConn) {
          const user = dbUser(clientConn.userId);
          const orgId = user && resolveOrgForUser(user, parsed.organizationId);
          if (orgId) clientConn.organizationId = orgId;
        }
      } catch (e) {
        // Ignore unparseable client messages
      }
    });

    ws.on('close', () => {
      if (clientConn) {
        activeClients.delete(clientConn);
      }
    });

    ws.on('error', (err) => {
      if (clientConn) {
        activeClients.delete(clientConn);
      }
    });
  });

  return wss;
}

export function broadcastToOrg(organizationId: string, event: string, data: any) {
  const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  for (const client of activeClients) {
    if (client.organizationId === organizationId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
      } catch (err) {
        console.warn('Failed to send WebSocket message to client', err);
      }
    }
  }
}
