import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useWhatsAppStatus } from '../../hooks/useWhatsAppStatus';
import { WhatsAppStatusIndicator } from '../ui/WhatsAppStatus';
import { Badge } from '../ui/Badge';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  conversations?: Array<{
    id: string;
    customerName: string;
    customerPhone: string;
    status: string;
    unreadCount: number;
    lastMessageAt: string;
    assignedTo?: { id: string; name: string } | null;
  }>;
  onDeleteConversation?: (id: string) => void;
}

export function Sidebar({ conversations = [], onDeleteConversation }: SidebarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { status } = useWhatsAppStatus();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return <Badge variant="warning">Aberta</Badge>;
      case 'IN_PROGRESS': return <Badge variant="info">Em atendimento</Badge>;
      case 'CLOSED': return <Badge variant="default">Finalizada</Badge>;
      default: return null;
    }
  };

  return (
    <aside className="w-80 h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Syscliente" className="w-7 h-7 rounded" />
          <h1 className="text-xl font-bold text-gray-900">Syscliente</h1>
        </div>
        <p className="text-xs text-gray-500 mt-1">Help Desk WhatsApp</p>
      </div>

      {/* Nav Links */}
      <nav className="px-3 py-2 border-b border-gray-200 space-y-1">
        <WhatsAppStatusIndicator
          connectionState={status.connectionState}
          onClick={() => navigate('/whatsapp')}
        />
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <MessageSquare size={18} />
          Conversas
        </button>
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings size={18} />
            Administração
          </button>
        )}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <BarChart3 size={18} />
          Dashboard
        </button>
      </nav>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
            Conversas
          </h2>
          {conversations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Nenhuma conversa ainda
            </p>
          ) : (
            conversations.map((conv) => (
              <div key={conv.id} className="relative group">
                <button
                  onClick={() => navigate(`/conversations/${conv.id}`)}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-lg mb-1 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {conv.customerName}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="bg-primary-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1.5">
                      {statusBadge(conv.status)}
                      {conv.assignedTo && (
                        <span className="text-[10px] text-gray-400 truncate max-w-[80px]" title={conv.assignedTo.name}>
                          {conv.assignedTo.name}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(conv.lastMessageAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </button>

                {/* Delete button - visible on hover */}
                {deletingId !== conv.id ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingId(conv.id); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Deletar conversa"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white shadow-md rounded-lg px-2 py-1 z-10" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { onDeleteConversation?.(conv.id); setDeletingId(null); }}
                      className="text-xs text-red-600 font-medium hover:underline px-1"
                    >
                      Deletar
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="text-xs text-gray-400 hover:underline px-1"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-gray-200 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-sm flex-1">
            <p className="font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.role === 'ADMIN' ? 'Administrador' : 'Atendente'}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 w-full py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  );
}
