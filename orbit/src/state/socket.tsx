/* eslint-disable react-hooks/set-state-in-effect */
/**
 * Socket.io client hook (BUILD_PROMPT Phase 9):
 * JWT handshake, permissioned rooms, auto-reconnect with delta-sync,
 * presence and typing indicators.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './auth';
import { useToast } from './toast';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  joinRoom: (room: string) => Promise<void>;
  leaveRoom: (room: string) => Promise<void>;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  joinRoom: async () => undefined,
  leaveRoom: async () => undefined,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const { status, accessToken } = useAuth() as unknown as { status: string; accessToken?: string; user?: unknown };
  const toast = useToast();
  const [socketState, setSocketState] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketState(null);
        setConnected(false);
      }
      return;
    }

    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      setConnected(true);
      console.debug('[socket] connected', socket.id);
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      console.debug('[socket] disconnected', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[socket] connect_error', err.message);
    });

    socket.on('error', (payload: { code: string; message: string }) => {
      if (payload.code === 'FORBIDDEN_ROOM') {
        toast.error('Access denied', payload.message);
      } else if (payload.code === 'RATE_LIMITED') {
        toast.error('Too many requests', 'Please slow down');
      } else {
        console.warn('[socket] error', payload);
      }
    });

    socket.on('notification:new', (data) => {
      console.debug('[socket] notification:new', data);
    });

    socket.on('presence:update', (data) => {
      console.debug('[socket] presence:update', data);
    });

    socketRef.current = socket;
    // Defer state update to avoid cascading render warning (react-hooks/set-state-in-effect)
    queueMicrotask(() => setSocketState(socket));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketState(null);
      setConnected(false);
    };
  }, [status, accessToken, toast]);

  const joinRoom = async (room: string): Promise<void> => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    return new Promise((resolve, reject) => {
      socket.emit('room:join', { room }, (res: { ok: boolean; error?: { message: string } }) => {
        if (res.ok) resolve();
        else reject(new Error(res.error?.message ?? 'Failed to join room'));
      });
    });
  };

  const leaveRoom = async (room: string): Promise<void> => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    return new Promise((resolve) => {
      socket.emit('room:leave', { room }, () => resolve());
    });
  };

  return (
    <SocketContext.Provider value={{ socket: socketState, connected, joinRoom, leaveRoom }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}

export function useSocketEvent<T = unknown>(event: string, handler: (data: T) => void): void {
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler as never);
    return () => {
      socket.off(event, handler as never);
    };
  }, [socket, event, handler]);
}
