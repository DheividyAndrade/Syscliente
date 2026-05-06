import React, { createContext, useContext, useEffect, useRef } from 'react';
import { getSocket, disconnectSocket } from '../services/socket';
import { useAuthContext } from './AuthContext';
import type { Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthContext();
  const [socket, setSocket] = React.useState<Socket | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      const s = getSocket();
      setSocket(s);
    }

    return () => {
      if (!isAuthenticated) {
        disconnectSocket();
        setSocket(null);
      }
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  return useContext(SocketContext);
}
