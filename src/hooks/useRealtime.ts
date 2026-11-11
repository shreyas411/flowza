import { useEffect, useRef, useState, useCallback } from 'react';
import { getApiTenant } from '../lib/api';

export interface RealtimeEvent {
  event: string;
  data: any;
  timestamp: string;
}

export function useRealtime(onEvent?: (event: RealtimeEvent) => void, enabled = true) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const { orgId, token } = getApiTenant();
    if (!enabled || !token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?orgId=${encodeURIComponent(orgId)}&token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const parsed: RealtimeEvent = JSON.parse(event.data);
          if (onEvent) {
            onEvent(parsed);
          }
        } catch (e) {
          // ignore
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (err) {
      console.warn('WebSocket connection error:', err);
    }
  }, [onEvent, enabled]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected };
}
