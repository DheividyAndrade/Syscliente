import Excel from 'exceljs';
import prisma from '../../config/prisma';

export async function generateMonthlyReport(month: number, year: number): Promise<Buffer> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  // Fetch all conversations in the month
  const conversations = await prisma.conversation.findMany({
    where: {
      createdAt: { gte: start, lte: end },
    },
    include: {
      assignedTo: { select: { name: true } },
      tags: { include: { tag: true } },
      messages: {
        select: { senderType: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const workbook = new Excel.Workbook();
  workbook.creator = 'Syscliente';

  // ─── Sheet 1: Resumo ───
  const resumoSheet = workbook.addWorksheet('Resumo', {
    properties: { tabColor: { argb: '3B82F6' } },
  });

  // Title
  resumoSheet.mergeCells('A1:D1');
  const titleCell = resumoSheet.getCell('A1');
  titleCell.value = `Relatorio Syscliente - ${getMonthName(month)}/${year}`;
  titleCell.font = { size: 16, bold: true, color: { argb: '1E40AF' } };
  titleCell.alignment = { horizontal: 'center' };
  resumoSheet.getRow(1).height = 30;

  // Summary
  const opened = conversations.filter((c) => c.status !== 'CLOSED' || c.updatedAt > c.createdAt).length;
  const closed = conversations.filter((c) => c.status === 'CLOSED').length;
  const openNow = conversations.filter((c) => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length;
  const totalMessages = conversations.reduce((acc, c) => acc + c.messages.length, 0);
  const responses = conversations.filter((c) => c.messages.some((m) => m.senderType === 'AGENT')).length;
  const withoutResponse = conversations.filter((c) => !c.messages.some((m) => m.senderType === 'AGENT')).length;

  const summaryData = [
    ['Metrica', 'Valor'],
    ['Total de Tickets', conversations.length],
    ['Tickets Resolvidos', closed],
    ['Tickets em Aberto', openNow],
    ['Taxa de Resolucao', conversations.length > 0 ? `${Math.round((closed / conversations.length) * 100)}%` : '0%'],
    ['Total de Mensagens', totalMessages],
    ['Tickets com Resposta', responses],
    ['Tickets sem Resposta', withoutResponse],
  ];

  let rowIdx = 3;
  for (const [label, value] of summaryData) {
    resumoSheet.getCell(`A${rowIdx}`).value = label;
    resumoSheet.getCell(`A${rowIdx}`).font = { bold: true, size: 11 };
    resumoSheet.getCell(`B${rowIdx}`).value = value;
    resumoSheet.getCell(`B${rowIdx}`).font = { size: 11 };
    if (rowIdx === 3) {
      resumoSheet.getRow(rowIdx).font = { bold: true, size: 11 };
      resumoSheet.getRow(rowIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };
    }
    rowIdx++;
  }

  resumoSheet.getColumn('A').width = 28;
  resumoSheet.getColumn('B').width = 20;

  // ─── Sheet 2: Tickets ───
  const ticketsSheet = workbook.addWorksheet('Tickets', {
    properties: { tabColor: { argb: '10B981' } },
  });

  const ticketHeaders = ['ID', 'Cliente', 'Telefone', 'Status', 'Atendente', 'Titulo', 'Solucao', 'Tags', 'Mensagens', 'Data Abertura', 'Ultima Mensagem'];
  const headerRow = ticketsSheet.addRow(ticketHeaders);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '3B82F6' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 22;

  for (const conv of conversations) {
    const statusMap: Record<string, string> = {
      OPEN: 'Aberta',
      IN_PROGRESS: 'Em atendimento',
      CLOSED: 'Finalizada',
    };
    const row = ticketsSheet.addRow([
      conv.id.substring(0, 8),
      conv.customerName,
      conv.customerPhone,
      statusMap[conv.status] || conv.status,
      conv.assignedTo?.name || 'Nao atribuido',
      conv.ticketTitle || '-',
      conv.solution || '-',
      conv.tags.map((ct) => ct.tag.name).join(', ') || '-',
      conv.messages.length,
      conv.createdAt.toLocaleDateString('pt-BR'),
      conv.lastMessageAt.toLocaleDateString('pt-BR'),
    ]);

    // Color by status
    if (conv.status === 'CLOSED') {
      row.getCell(4).font = { color: { argb: '059669' } };
    } else if (conv.status === 'IN_PROGRESS') {
      row.getCell(4).font = { color: { argb: '2563EB' } };
    }
  }

  ticketsSheet.getColumn(1).width = 10;
  ticketsSheet.getColumn(2).width = 22;
  ticketsSheet.getColumn(3).width = 18;
  ticketsSheet.getColumn(4).width = 16;
  ticketsSheet.getColumn(5).width = 18;
  ticketsSheet.getColumn(6).width = 24;
  ticketsSheet.getColumn(7).width = 28;
  ticketsSheet.getColumn(8).width = 22;
  ticketsSheet.getColumn(9).width = 12;
  ticketsSheet.getColumn(10).width = 16;
  ticketsSheet.getColumn(11).width = 16;

  // ─── Sheet 3: Atendentes ───
  const agentSheet = workbook.addWorksheet('Atendentes', {
    properties: { tabColor: { argb: 'F59E0B' } },
  });

  const agentStats = new Map<string, { name: string; tickets: number; messages: number; resolved: number }>();
  for (const conv of conversations) {
    const agentName = conv.assignedTo?.name || 'Nao atribuido';
    if (!agentStats.has(agentName)) {
      agentStats.set(agentName, { name: agentName, tickets: 0, messages: 0, resolved: 0 });
    }
    const stat = agentStats.get(agentName)!;
    stat.tickets++;
    stat.messages += conv.messages.length;
    if (conv.status === 'CLOSED') stat.resolved++;
  }

  const agentHeaders = ['Atendente', 'Tickets', 'Mensagens', 'Resolvidos', 'Taxa Resolucao'];
  const agentHeaderRow = agentSheet.addRow(agentHeaders);
  agentHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  agentHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D97706' } };
  agentHeaderRow.height = 22;

  for (const [, stat] of Array.from(agentStats.entries()).sort((a, b) => b[1].tickets - a[1].tickets)) {
    agentSheet.addRow([
      stat.name,
      stat.tickets,
      stat.messages,
      stat.resolved,
      stat.tickets > 0 ? `${Math.round((stat.resolved / stat.tickets) * 100)}%` : '0%',
    ]);
  }

  agentSheet.getColumn(1).width = 20;
  agentSheet.getColumn(2).width = 12;
  agentSheet.getColumn(3).width = 14;
  agentSheet.getColumn(4).width = 14;
  agentSheet.getColumn(5).width = 16;

  return workbook.xlsx.writeBuffer() as unknown as Buffer;
}

function getMonthName(month: number): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return months[month - 1] || '';
}
