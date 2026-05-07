import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Download, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface Chamado {
  id: string;
  customerName: string;
  customerPhone: string;
  status: string;
  statusLabel: string;
  priorityLabel: string;
  ticketTitle: string;
  solution: string;
  assignedTo?: { id: string; name: string } | null;
  tags: Array<{ id: string; name: string; color: string }>;
  messageCount: number;
  responseTimeMinutes: number | null;
  responseTimeDisplay: string;
  createdAt: string;
  closedAt: string | null;
}

const monthNames = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function ChamadosPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadChamados = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/conversations/detailed?month=${month}&year=${year}`);
      setChamados(data);
    } catch {
      toast.error('Erro ao carregar chamados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChamados();
  }, [month, year]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else { setMonth(month - 1); }
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else { setMonth(month + 1); }
  };

  const handleDownload = () => {
    const header = ['Cliente;Telefone;Status;Problema;Solucao;Atendente;Tags;Mensagens;Tempo Resposta;Data Abertura'];
    const rows = filtered.map((c) =>
      `"${c.customerName}";"${c.customerPhone}";"${c.statusLabel}";"${c.ticketTitle || '-'}";"${c.solution || '-'}";"${c.assignedTo?.name || '-'}";"${c.tags.map((t) => t.name).join(', ') || '-'}";"${c.messageCount}";"${c.responseTimeDisplay}";"${new Date(c.createdAt).toLocaleDateString('pt-BR')}"`
    );
    const csv = '\uFEFF' + header.concat(rows).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chamados-${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Download iniciado!');
  };

  const filtered = chamados.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.customerName.toLowerCase().includes(s) ||
      c.customerPhone.includes(s) ||
      (c.ticketTitle || '').toLowerCase().includes(s) ||
      (c.solution || '').toLowerCase().includes(s) ||
      (c.assignedTo?.name || '').toLowerCase().includes(s)
    );
  });

  const stats = {
    total: chamados.length,
    resolved: chamados.filter((c) => c.status === 'CLOSED').length,
    avgResponse: chamados.filter((c) => c.responseTimeMinutes != null).length > 0
      ? Math.round(
          chamados
            .filter((c) => c.responseTimeMinutes != null)
            .reduce((a, c) => a + (c.responseTimeMinutes || 0), 0) /
            chamados.filter((c) => c.responseTimeMinutes != null).length
        )
      : 0,
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Chamados</h2>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download size={16} />
            Baixar CSV
          </button>
        </div>

        {/* Month nav + stats */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1 hover:bg-gray-200 rounded">
              <ChevronLeft size={18} className="text-gray-500" />
            </button>
            <span className="text-sm font-medium text-gray-900 min-w-[140px] text-center">
              {monthNames[month - 1]} / {year}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-gray-200 rounded">
              <ChevronRight size={18} className="text-gray-500" />
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span><strong className="text-gray-900">{stats.total}</strong> chamados</span>
            <span><strong className="text-green-600">{stats.resolved}</strong> resolvidos</span>
            <span><strong className="text-blue-600">{stats.avgResponse}min</strong> temp. medio</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, telefone, problema, solucao ou atendente..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Telefone</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tempo Resp.</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Problema</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Solucao</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Atendente</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-400">
                        {search ? 'Nenhum chamado encontrado' : 'Nenhum chamado neste mes'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{c.customerName}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.customerPhone}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${c.responseTimeMinutes != null && c.responseTimeMinutes < 5 ? 'text-green-600' : c.responseTimeMinutes != null && c.responseTimeMinutes > 30 ? 'text-red-600' : 'text-gray-600'}`}>
                            {c.responseTimeDisplay}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={c.ticketTitle || ''}>
                          {c.ticketTitle || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={c.solution || ''}>
                          {c.solution || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {c.assignedTo?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            c.status === 'OPEN' ? 'bg-yellow-100 text-yellow-800'
                            : c.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                          }`}>
                            {c.statusLabel}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
