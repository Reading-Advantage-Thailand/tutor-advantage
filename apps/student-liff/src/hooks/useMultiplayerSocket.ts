import { useState, useCallback, useRef, useEffect } from 'react';

interface UseMultiplayerSocketOptions {
  maxRetries?: number;
  reconnectDelay?: number;
  reconnectWindow?: number;
}

interface UseMultiplayerSocketReturn {
  socket: WebSocket | null;
  isConnected: boolean;
  connect: (url: string) => void;
  disconnect: () => void;
  send: (message: string) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
}

export function useMultiplayerSocket(
  options: UseMultiplayerSocketOptions = {}
): UseMultiplayerSocketReturn {
  const {
    maxRetries = 3,
    reconnectDelay = 1000,
    reconnectWindow = 60000,
  } = options;

  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventHandlersRef = useRef<Map<string, ((...args: unknown[]) => void)[]>>(new Map());
  const retryCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeRef = useRef<number | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    const handlers = eventHandlersRef.current.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
  }, []);

  const connect = useCallback(
    (url: string) => {
      if (socket?.readyState === WebSocket.OPEN) {
        return;
      }

      currentUrlRef.current = url;
      connectTimeRef.current = Date.now();
      retryCountRef.current = 0;

      try {
        const ws = new WebSocket(url);

        ws.onopen = () => {
          setIsConnected(true);
          retryCountRef.current = 0;
          emit('open');
        };

        ws.onclose = () => {
          setIsConnected(false);
          setSocket(null);
          emit('close');

          // Attempt reconnection if within window
          const elapsed = connectTimeRef.current
            ? Date.now() - connectTimeRef.current
            : 0;

          if (elapsed < reconnectWindow && retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            const delay = reconnectDelay * Math.pow(2, retryCountRef.current - 1);
            reconnectTimerRef.current = setTimeout(() => {
              if (currentUrlRef.current) {
                connect(currentUrlRef.current);
              }
            }, delay);
          }
        };

        ws.onerror = (error) => {
          emit('error', error);
        };

        ws.onmessage = (event) => {
          emit('message', event.data);
        };

        setSocket(ws);
      } catch (error) {
        emit('error', error);
      }
    },
    [socket, reconnectWindow, maxRetries, reconnectDelay, emit]
  );

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    retryCountRef.current = maxRetries; // Prevent reconnection
    connectTimeRef.current = null;

    if (socket) {
      socket.close();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket, clearReconnectTimer, maxRetries]);

  const send = useCallback(
    (message: string) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    },
    [socket]
  );

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    if (!eventHandlersRef.current.has(event)) {
      eventHandlersRef.current.set(event, []);
    }
    eventHandlersRef.current.get(event)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = eventHandlersRef.current.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimer();
      if (socket) {
        socket.close();
      }
    };
  }, [socket, clearReconnectTimer]);

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    send,
    on,
  };
}
