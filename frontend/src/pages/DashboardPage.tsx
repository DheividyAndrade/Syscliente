import React, { useEffect, useState } from 'react';
import api from '../services/api';
import {
  MessageSquare,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Hash,
  Calendar,
  Download,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardStats {
  summary: {
    totalThisMonth: number;
    resolvedThisMonth: number;
    openNow: number;
    inProgressNow: number;
    totalToday: number;
    totalPrevMonth: number;
    resolvedPrevMonth: number;
    conversationVariation: number;
    resolutionRate: number;
    totalMessages: number;
  };
  byStatus: Array<{ status: string; count: number }>;
  byAgent: Array<{ agentId: string; agentName: string; count: number }>;
  byTag: Array<{ tagId: string; tagName: string; tagColor: string; count: number }>;
  recentConversations: Array<{
    id: string;
    customerName: string;
    customerPhone: string;
    status: string;
    lastMessageAt: string;
    assignedTo?: { id: string; name: string } | null;
  }>;
}

const statusLabels: Record<string, string> = {
  OPEN: 'Abertas',
  IN_PROGRESS: 'Em atendimento',
  CLOSED: 'Finalizadas',
};

const statusColors: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  CLOSED: 'bg-green-100 text-green-800',
};

export function DashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/dashboard/stats?month=${month}&year=${year}`);
        setStats(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [month, year]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else { setMonth(month - 1); }
  };

  const nextMonth = () => {
    const isCurrent = month === now.getMonth() + 1 && year === now.getFullYear();
    if (isCurrent) return;
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else { setMonth(month + 1); }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Erro ao carregar dados
      </div>
    );
  }

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/dashboard/export?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erro ao baixar');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-syscliente-${year}-${String(month).padStart(2, '0')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Relatorio baixado!');
    } catch {
      toast.error('Erro ao baixar relatorio');
    }
  };

  const { summary } = stats;
  const variationColor = summary.conversationVariation >= 0 ? 'text-green-600' : 'text-red-600';
  const VariationIcon = summary.conversationVariation >= 0 ? TrendingUp : TrendingDown;

  const monthNames = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const isCurrent = month === now.getMonth() + 1 && year === now.getFullYear();

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Dashboard</h2>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1 hover:bg-gray-200 rounded transition-colors" title="Mes anterior">
              <ChevronLeft size={20} className="text-gray-500" />
            </button>
            <span className="text-sm font-medium text-gray-900 min-w-[160px] text-center">
              {monthNames[month - 1]} / {year}
              {isCurrent && <span className="ml-1.5 text-xs text-green-600 font-normal">(atual)</span>}
            </span>
            <button
              onClick={nextMonth}
              disabled={isCurrent}
              className={`p-1 rounded transition-colors ${isCurrent ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-200'}`}
              title={isCurrent ? 'Mes atual' : 'Proximo mes'}
            >
              <ChevronRight size={20} className="text-gray-500" />
            </button>
          </div>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download size={16} />
            Baixar Relatorio (Excel)
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card
            icon={<MessageSquare size={20} />}
            label="Conversas (mes)"
            value={summary.totalThisMonth}
            footer={
              <span className={`text-xs ${variationColor} flex items-center gap-1`}>
                <VariationIcon size={12} />
                {summary.conversationVariation}% vs mes anterior
              </span>
            }
            color="blue"
          />
          <Card
            icon={<CheckCircle size={20} />}
            label="Resolvidas (mes)"
            value={summary.resolvedThisMonth}
            footer={<span className="text-xs text-gray-400">Taxa: {summary.resolutionRate}%</span>}
            color="green"
          />
          <Card
            icon={<AlertCircle size={20} />}
            label="Em aberto"
            value={summary.openNow + summary.inProgressNow}
            footer={<span className="text-xs text-gray-400">Hoje: +{summary.totalToday}</span>}
            color="yellow"
          />
          <Card
            icon={<Hash size={20} />}
            label="Mensagens"
            value={summary.totalMessages}
            color="purple"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* By Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Por Status</h3>
            <div className="space-y-3">
              {stats.byStatus.map((s) => {
                const max = Math.max(...stats.byStatus.map((x) => x.count), 1);
                const pct = Math.round((s.count / max) * 100);
                return (
                  <div key={s.status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{statusLabels[s.status] || s.status}</span>
                      <span className="font-medium text-gray-900">{s.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.status === 'OPEN' ? 'bg-yellow-500' : s.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-green-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By Agent */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Por Atendente</h3>
            {stats.byAgent.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhum atendimento</p>
            ) : (
              <div className="space-y-3">
                {stats.byAgent.map((a) => {
                  const max = Math.max(...stats.byAgent.map((x) => x.count), 1);
                  const pct = Math.round((a.count / max) * 100);
                  return (
                    <div key={a.agentId || 'unassigned'}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{a.agentName}</span>
                        <span className="font-medium text-gray-900">{a.count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Conversations */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Ultimas Conversas</h3>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar size={12} />
              Atualizado agora
            </span>
          </div>
          <div className="space-y-1">
            {stats.recentConversations.map((conv) => (
              <div key={conv.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-semibold">
                    {conv.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{conv.customerName}</p>
                    <p className="text-xs text-gray-400">{conv.customerPhone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {conv.assignedTo && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Users size={12} />
                      {conv.assignedTo.name}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[conv.status] || 'bg-gray-100 text-gray-600'}`}>
                    {statusLabels[conv.status] || conv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  footer,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  footer?: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const bgColors: Record<string, string> = {
    blue: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase">{label}</span>
        <span className={`p-2 rounded-lg ${bgColors[color]}`}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}
