import React, { useEffect, useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../hooks/useAuth';

interface Conversation {
  id: string;
  customerName: string;
  customerPhone: string;
  status: string;
  unreadCount: number;
  lastMessageAt: string;
}

export function MainLayout() {
  const { isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/conversations?limit=50');
      setConversations(data.conversations || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated, loadConversations]);

  const handleDeleteConversation = async (id: string) => {
    try {
      await api.delete(`/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      toast.success('Conversa deletada');
    } catch {
      toast.error('Erro ao deletar');
    }
  };

  // Socket.IO real-time updates
  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = getSocket();

    const handleNewMessage = (data: any) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === data.conversationId
            ? { ...c, lastMessageAt: new Date().toISOString(), unreadCount: c.unreadCount + 1 }
            : c
        )
      );
    };

    const handleConversationUpdated = (data: Conversation) => {
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === data.id);
        if (exists) {
          return prev.map((c) => (c.id === data.id ? { ...data, unreadCount: data.unreadCount ?? c.unreadCount } : c));
        }
        return [data, ...prev];
      });
    };

    socket.on('new_message', handleNewMessage);
    socket.on('conversation_updated', handleConversationUpdated);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('conversation_updated', handleConversationUpdated);
    };
  }, [isAuthenticated]);

  return (
    <div className="flex h-full bg-gray-50">
      <Sidebar conversations={conversations} onDeleteConversation={handleDeleteConversation} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: '14px',
            borderRadius: '8px',
          },
        }}
      />
    </div>
  );
}
