import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { MessageBubble } from '../components/chat/MessageBubble';
import { MessageInput } from '../components/chat/MessageInput';
import { Badge } from '../components/ui/Badge';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import toast from 'react-hot-toast';
import { RefreshCw, UserPlus, ArrowRightLeft, User, CheckCircle, RotateCcw, History, Tag, Plus, X } from 'lucide-react';

interface Message {
  id: string;
  conversationId: string;
  senderType: 'CLIENT' | 'AGENT' | 'SYSTEM';
  senderId?: string;
  content: string;
  contentType: string;
  mediaUrl?: string;
  status: string;
  externalId?: string;
  createdAt: string;
  sender?: { id: string; name: string } | null;
}

interface Conversation {
  id: string;
  customerName: string;
  customerPhone: string;
  ticketTitle?: string;
  status: string;
  priority: string;
  unreadCount: number;
  assignedToId?: string;
  assignedTo?: { id: string; name: string } | null;
  tags: Array<{ id: string; name: string; color: string }>;
  messages: Message[];
}

export function ChatView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { joinConversation, leaveConversation, socket } = useSocket();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [allTags, setAllTags] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [ticketTitle, setTicketTitle] = useState('');
  const [history, setHistory] = useState<Array<{
    ticketTitle?: string;
    id: string;
    status: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    assignedTo?: { id: string; name: string } | null;
  }> | null>(null);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get(`/conversations/${id}`);
      setConversation(data);
      const msgs = data.messages || [];
      setMessages(msgs);
      msgs.forEach((m: Message) => seenIds.current.add(m.id));
    } catch {
      toast.error('Erro ao carregar conversa');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadConversation();
    joinConversation(id!);
    return () => {
      leaveConversation(id!);
    };
  }, [id, joinConversation, leaveConversation, loadConversation]);

  // Listen for new messages via Socket.IO
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (data: { conversationId: string; message: Message }) => {
      if (data.conversationId !== id) return;
      // Skip own messages (already added by handleSend)
      if (data.message.senderType === 'AGENT' && data.message.senderId === user?.id) return;
      if (seenIds.current.has(data.message.id)) return;
      seenIds.current.add(data.message.id);
      setMessages((prev) => [...prev, data.message]);
      if (data.message.senderType === 'CLIENT') {
        api.patch(`/conversations/${id}/status`, { status: 'IN_PROGRESS' }).catch(() => {});
      }
    };
    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [id, socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchAgents = async () => {
    try {
      const { data } = await api.get('/users');
      setAgents(data.filter((u: any) => u.role === 'AGENT' && u.isActive));
    } catch { /* ignore */ }
  };

  const handleAssign = async (agentId: string) => {
    if (!id) return;
    try {
      await api.patch(`/conversations/${id}/assign`, { agentId });
      toast.success('Atendente atribuido!');
      setShowTransfer(false);
      loadConversation();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao atribuir');
    }
  };

  const handleTransfer = async (agentId: string) => {
    if (!id) return;
    try {
      await api.put(`/conversations/${id}/transfer`, { agentId });
      toast.success('Conversa transferida!');
      setShowTransfer(false);
      loadConversation();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao transferir');
    }
  };

  const handleTakeOver = async () => {
    if (!id || !user) return;
    try {
      await api.patch(`/conversations/${id}/assign`, { agentId: user.id });
      toast.success('Voce assumiu o atendimento!');
      loadConversation();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao assumir');
    }
  };

  const handleClose = async () => {
    // Show the prompt modal instead of closing directly
    setTicketTitle('');
    setShowClosePrompt(true);
  };

  const handleConfirmClose = async () => {
    if (!id) return;
    try {
      await api.patch(`/conversations/${id}/status`, { status: 'CLOSED', ticketTitle: ticketTitle.trim() });
      toast.success('Conversa finalizada!');
      setShowClosePrompt(false);
      loadConversation();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao finalizar');
    }
  };

  const handleReopen = async () => {
    if (!id) return;
    try {
      await api.patch(`/conversations/${id}/status`, { status: 'OPEN' });
      toast.success('Conversa reaberta!');
      loadConversation();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao reabrir');
    }
  };

  const handleHistory = async () => {
    if (!conversation) return;
    setShowHistory(true);
    try {
      const { data } = await api.get(`/conversations/history/${encodeURIComponent(conversation.customerPhone)}`);
      setHistory(data);
    } catch {
      setHistory([]);
    }
  };

  const handleToggleTag = async (tagId: string) => {
    if (!id || !conversation) return;
    const currentIds = conversation.tags.map((t) => t.id);
    const newIds = currentIds.includes(tagId)
      ? currentIds.filter((tid) => tid !== tagId)
      : [...currentIds, tagId];
    try {
      await api.patch(`/conversations/${id}/tags`, { tagIds: newIds });
      loadConversation();
    } catch {
      toast.error('Erro ao atualizar tags');
    }
  };

  const handleOpenTags = async () => {
    setShowTags(true);
    try {
      const { data } = await api.get('/tags');
      setAllTags(data);
    } catch { /* ignore */ }
  };

  const handleSend = async (content: string) => {
    if (!id || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/conversations/${id}/messages`, { content });
      // Track ID to prevent socket duplicate
      seenIds.current.add(data.id);
      setMessages((prev) => [...prev, data]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao enviar mensagem');
      throw err;
    } finally {
      setSending(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return <Badge variant="warning">Aberta</Badge>;
      case 'IN_PROGRESS': return <Badge variant="info">Em atendimento</Badge>;
      case 'CLOSED': return <Badge variant="default">Finalizada</Badge>;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Conversa não encontrada
      </div>
    );
  }

  const isClosed = conversation.status === 'CLOSED';
  const isAssignedToMe = conversation.assignedTo?.id === user?.id;
  const isAssignedToOther = !!(conversation.assignedToId && !isAssignedToMe);
  const inputDisabled = isClosed || isAssignedToOther;

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div>
          <button
            onClick={handleHistory}
            className="flex items-center gap-1.5 hover:underline text-left"
            title="Ver historico do cliente"
          >
            <h2 className="text-base font-semibold text-gray-900">{conversation.customerName}</h2>
            <History size={14} className="text-gray-400" />
          </button>
          <p className="text-xs text-gray-500">{conversation.customerPhone}</p>
        </div>
        <div className="flex items-center gap-3">
          {conversation.tags?.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium cursor-pointer hover:opacity-80"
              style={{ backgroundColor: tag.color + '20', color: tag.color }}
              onClick={handleOpenTags}
            >
              {tag.name}
            </span>
          ))}
          {(!conversation.tags || conversation.tags.length === 0) && !isClosed && (
            <button
              onClick={handleOpenTags}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <Tag size={12} />
              Tags
            </button>
          )}
          {statusBadge(conversation.status)}

          {/* Assignment controls */}
          {!conversation.assignedToId && !isClosed && (
            <button
              onClick={() => { fetchAgents(); setShowTransfer(true); }}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <UserPlus size={14} />
              Atender
            </button>
          )}

          {conversation.assignedTo && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs">
                <User size={14} className={isAssignedToMe ? 'text-green-600' : 'text-gray-400'} />
                <span className={isAssignedToMe ? 'text-green-700 font-medium' : 'text-gray-600'}>
                  {isAssignedToMe ? 'Você' : conversation.assignedTo.name}
                </span>
              </span>
              <button
                onClick={() => { fetchAgents(); setShowTransfer(true); }}
                className="text-xs text-gray-400 hover:text-primary-600 transition-colors"
                title={isAssignedToOther ? 'Assumir atendimento' : 'Transferir'}
              >
                <ArrowRightLeft size={14} />
              </button>
            </div>
          )}

          {/* Close / Reopen */}
          {!isClosed && isAssignedToMe && (
            <button
              onClick={handleClose}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle size={14} />
              Finalizar
            </button>
          )}
          {isClosed && (
            <button
              onClick={handleReopen}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RotateCcw size={14} />
              Reabrir
            </button>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => setShowTransfer(false)}>
          <div className="bg-white rounded-xl shadow-xl p-4 w-72 z-50" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {conversation.assignedToId ? 'Transferir atendimento' : 'Atribuir atendente'}
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {/* Take over option if assigned to other */}
              {isAssignedToOther && (
                <button
                  onClick={() => handleTakeOver()}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-green-50 text-green-700 font-medium transition-colors"
                >
                  Assumir eu mesmo
                </button>
              )}
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => conversation.assignedToId ? handleTransfer(agent.id) : handleAssign(agent.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-semibold">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <span>{agent.name}</span>
                  {agent.id === conversation.assignedTo?.id && (
                    <span className="text-xs text-gray-400 ml-auto">atual</span>
                  )}
                </button>
              ))}
              {agents.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Nenhum atendente disponivel</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => { setShowHistory(false); setHistory(null); }}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-[500px] max-h-[500px] overflow-y-auto z-50" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Historico de {conversation?.customerName}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{conversation?.customerPhone}</span>
              </div>
            </div>

            {history === null ? (
              <div className="flex justify-center py-8">
                <RefreshCw size={20} className="animate-spin text-gray-400" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum ticket anterior</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => {
                  const isCurrent = h.id === id;
                  return (
                    <div
                      key={h.id}
                      className={`p-3 rounded-lg border ${isCurrent ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          h.status === 'OPEN' ? 'bg-yellow-100 text-yellow-800'
                          : h.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                        }`}>
                          {h.status === 'OPEN' ? 'Aberta'
                           : h.status === 'IN_PROGRESS' ? 'Em atendimento'
                           : 'Finalizada'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(h.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{h.messageCount} mensagens</span>
                        <div className="flex items-center gap-2">
                          {h.assignedTo && (
                            <span>{h.assignedTo.name}</span>
                          )}
                          {isCurrent && (
                            <span className="text-primary-600 font-medium">Atual</span>
                          )}
                        </div>
                      </div>
                      {h.ticketTitle && (
                        <div className="mt-1.5 text-xs text-gray-500 italic">
                          "{h.ticketTitle}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Close Prompt Modal */}
      {showClosePrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowClosePrompt(false)}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-80 z-50" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Finalizar Ticket</h3>
            <p className="text-xs text-gray-500 mb-3">
              Descreva o motivo/problema deste ticket para o relatorio.
            </p>
            <input
              type="text"
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              placeholder='Ex: "Erro ao acessar o portal"'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none mb-3"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmClose(); }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowClosePrompt(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmClose}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tags Dropdown */}
      {showTags && (
        <div className="absolute inset-0 z-40 flex items-start justify-center pt-16 bg-black/20" onClick={() => setShowTags(false)}>
          <div className="bg-white rounded-xl shadow-xl p-4 w-64 z-50" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Tags</h3>
              <button onClick={() => setShowTags(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-1">
              {allTags.map((tag) => {
                const isActive = conversation?.tags.some((t) => t.id === tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => { handleToggleTag(tag.id); setShowTags(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                    {isActive && <CheckCircle size={14} className="ml-auto text-primary-500" />}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Tags ajudam a categorizar tickets no relatorio
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-[#efeae2] relative">
        {isAssignedToOther && !isClosed && (
          <div className="absolute top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-xs text-yellow-700 text-center z-10">
            {conversation.assignedTo?.name} esta atendendo esta conversa
          </div>
        )}
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Nenhuma mensagem ainda
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            content={msg.content}
            senderType={msg.senderType}
            senderName={msg.sender?.name || (msg.senderType === 'CLIENT' ? conversation.customerName : undefined)}
            timestamp={msg.createdAt}
            status={msg.status}
            contentType={msg.contentType}
            mediaUrl={msg.mediaUrl}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        disabled={inputDisabled}
        placeholder={
          isClosed ? 'Conversa finalizada'
          : isAssignedToOther ? 'Outro agente esta atendendo'
          : 'Digite sua mensagem...'
        }
      />
    </div>
  );
}
