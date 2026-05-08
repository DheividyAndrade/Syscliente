import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { UserPlus, Trash2, Shield, ShieldCheck, Ban, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'AGENT';
  isActive: boolean;
  createdAt: string;
}

interface IgnoredContact {
  id: string;
  phone: string;
  label?: string;
  createdBy: { name: string };
  createdAt: string;
}

export function AdminPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [ignoredContacts, setIgnoredContacts] = useState<IgnoredContact[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'AGENT' as 'ADMIN' | 'AGENT' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newIgnored, setNewIgnored] = useState({ phone: '', label: '' });

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch {
      toast.error('Erro ao carregar usuários');
    }
  };

  const loadIgnored = async () => {
    try {
      const { data } = await api.get('/ignored-contacts');
      setIgnoredContacts(data);
    } catch { /* admin only */ }
  };

  useEffect(() => {
    loadUsers();
    loadIgnored();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/users', form);
      toast.success('Usuário criado!');
      setIsModalOpen(false);
      setForm({ name: '', email: '', password: '', role: 'AGENT' });
      loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar usuário');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este usuário?')) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('Usuário removido');
      loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao remover usuário');
    }
  };

  const handleAddIgnored = async () => {
    if (!newIgnored.phone.trim()) return;
    try {
      await api.post('/ignored-contacts', { phone: newIgnored.phone.trim(), label: newIgnored.label.trim() || undefined });
      toast.success('Contato adicionado a lista de ignorados');
      setNewIgnored({ phone: '', label: '' });
      loadIgnored();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao adicionar');
    }
  };

  const handleRemoveIgnored = async (id: string) => {
    try {
      await api.delete(`/ignored-contacts/${id}`);
      toast.success('Removido da lista de ignorados');
      loadIgnored();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao remover');
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Administração</h2>
            <p className="text-sm text-gray-500">Gerencie os atendentes do sistema</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <UserPlus size={18} />
            Novo Usuário
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">E-mail</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Função</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.role === 'ADMIN' ? (
                      <Badge variant="danger">
                        <Shield size={12} className="mr-1" /> Admin
                      </Badge>
                    ) : (
                      <Badge variant="info">
                        <ShieldCheck size={12} className="mr-1" /> Atendente
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.isActive ? 'success' : 'default'}>
                      {u.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Remover"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Usuário">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN' | 'AGENT' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="AGENT">Atendente</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Criando...' : 'Criar Usuário'}
          </button>
        </form>
      </Modal>

      {/* Ignored Contacts */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Ban size={20} className="text-red-500" />
          <h3 className="text-lg font-semibold text-gray-900">Contatos Ignorados</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Mensagens desses numeros serao descartadas automaticamente e nao criarao conversas.
          <br />
          <strong className="text-amber-600">Dica:</strong> use o botao "Bloquear" no cabecalho do chat para bloquear o contato pelo numero exato do WhatsApp.
        </p>

        {/* Add form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={newIgnored.phone}
              onChange={(e) => setNewIgnored({ ...newIgnored, phone: e.target.value })}
              placeholder="Número (ex: 5582999999999)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddIgnored(); }}
            />
            <input
              type="text"
              value={newIgnored.label}
              onChange={(e) => setNewIgnored({ ...newIgnored, label: e.target.value })}
              placeholder="Motivo (opcional)"
              className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddIgnored(); }}
            />
            <button
              onClick={handleAddIgnored}
              className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <Plus size={16} />
              Adicionar
            </button>
          </div>
        </div>

        {/* Ignored list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {ignoredContacts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhum contato ignorado</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Telefone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Motivo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Adicionado por</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ignoredContacts.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{c.phone}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.label || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{c.createdBy?.name}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemoveIgnored(c.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Remover"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
