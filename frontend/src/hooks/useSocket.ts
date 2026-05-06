import { useCallback } from 'react';
import { useSocketContext } from '../contexts/SocketContext';

type EventHandler = (...args: any[]) => void;

export function useSocket() {
  const { socket } = useSocketContext();

  const joinConversation = useCallback(
    (conversationId: string) => {
      socket?.emit('join:conversation', conversationId);
    },
    [socket]
  );

  const leaveConversation = useCallback(
    (conversationId: string) => {
      socket?.emit('leave:conversation', conversationId);
    },
    [socket]
  );

  const on = useCallback(
    (event: string, handler: EventHandler) => {
      socket?.on(event, handler);
      return () => {
        socket?.off(event, handler);
      };
    },
    [socket]
  );

  return { socket, joinConversation, leaveConversation, on };
}
