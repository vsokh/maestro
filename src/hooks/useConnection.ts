import { useState, useRef, useEffect, useCallback } from 'react';
import { connectWebSocket } from '../api.ts';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'synced' | 'error' | 'template-picker';

interface UseConnectionOptions {
  onMessage: (msg: any) => void;
  onReconnect?: () => void;
}

export function useConnection({ onMessage, onReconnect }: UseConnectionOptions) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  // Keep callbacks in refs so the WS effect doesn't re-run when they change
  const onMessageRef = useRef(onMessage);
  const onReconnectRef = useRef(onReconnect);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onReconnectRef.current = onReconnect; }, [onReconnect]);

  // WebSocket effect for real-time updates
  useEffect(() => {
    if (!connected) return;

    const setupWs = () => {
      const ws = connectWebSocket((msg) => {
        onMessageRef.current(msg);
      }, () => {
        // On WebSocket close — attempt reconnect after 3 seconds
        setTimeout(() => {
          if (wsRef.current === ws) {
            wsRef.current = setupWs();
          }
        }, 3000);
      });
      return ws;
    };

    wsRef.current = setupWs();

    return () => {
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) ws.close();
    };
  }, [connected]);

  const closeWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  return { connected, setConnected, status, setStatus, wsRef, closeWebSocket };
}
