import prisma from '../../config/prisma';

export async function getStats(targetMonth?: number | null, targetYear?: number | null) {
  const now = new Date();
  const month = targetMonth || now.getMonth() + 1;
  const year = targetYear || now.getFullYear();

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  const startOfPrevMonth = new Date(year, month - 2, 1);
  const endOfPrevMonth = new Date(year, month - 1, 0, 23, 59, 59);

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const startOfDay = new Date(year, month - 1, isCurrentMonth ? now.getDate() : 1);

  const [
    totalThisMonth,
    resolvedThisMonth,
    openNow,
    inProgressNow,
    totalPrevMonth,
    resolvedPrevMonth,
    totalToday,
    conversationsByStatus,
    conversationsByAgent,
    conversationsByTag,
    recentConversations,
    totalMessages,
    avgResponseTime,
  ] = await Promise.all([
    // Total conversations this month
    prisma.conversation.count({
      where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
    }),
    // Resolved this month
    prisma.conversation.count({
      where: { status: 'CLOSED', updatedAt: { gte: startOfMonth, lte: endOfMonth } },
    }),
    // Open now (only relevant for current month, otherwise 0)
    isCurrentMonth ? prisma.conversation.count({ where: { status: 'OPEN' } }) : Promise.resolve(0),
    // In progress now
    isCurrentMonth ? prisma.conversation.count({ where: { status: 'IN_PROGRESS' } }) : Promise.resolve(0),
    // Total previous month
    prisma.conversation.count({
      where: { createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
    }),
    // Resolved previous month
    prisma.conversation.count({
      where: { status: 'CLOSED', updatedAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
    }),
    // Today (only for current month)
    isCurrentMonth
      ? prisma.conversation.count({ where: { createdAt: { gte: startOfDay } } })
      : Promise.resolve(0),
    // By status (only for this month's conversations)
    prisma.conversation.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
    }),
    // By agent (this month)
    prisma.conversation.groupBy({
      by: ['assignedToId'],
      _count: { id: true },
      where: { assignedToId: { not: null }, status: { in: ['OPEN', 'IN_PROGRESS'] }, createdAt: { gte: startOfMonth, lte: endOfMonth } },
    }),
    // By tag (top 10, this month)
    prisma.conversationTag.groupBy({
      by: ['tagId'],
      _count: { conversationId: true },
      orderBy: { _count: { conversationId: 'desc' } },
      take: 10,
      where: { conversation: { createdAt: { gte: startOfMonth, lte: endOfMonth } } },
    }),
    // Recent conversations (this month)
    prisma.conversation.findMany({
      where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
      orderBy: { lastMessageAt: 'desc' },
      take: 10,
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        status: true,
        lastMessageAt: true,
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    // Total messages
    prisma.message.count(),
    // Average response time (approx by message count per conversation)
    Promise.resolve(0),
  ]);

  // Resolve agent names
  const agentIds = conversationsByAgent.map((a) => a.assignedToId!).filter(Boolean);
  const agents = agentIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, name: true },
      })
    : [];

  const agentMap = new Map(agents.map((a) => [a.id, a.name]));

  // Resolve tag names
  const tagIds = conversationsByTag.map((t) => t.tagId);
  const tags = tagIds.length > 0
    ? await prisma.tag.findMany({
        where: { id: { in: tagIds } },
        select: { id: true, name: true, color: true },
      })
    : [];

  const tagMap = new Map(tags.map((t) => [t.id, { name: t.name, color: t.color }]));

  // Variation vs previous month
  const conversationVariation = totalPrevMonth > 0
    ? Math.round(((totalThisMonth - totalPrevMonth) / totalPrevMonth) * 100)
    : 100;

  const resolutionRate = totalThisMonth > 0
    ? Math.round((resolvedThisMonth / totalThisMonth) * 100)
    : 0;

  return {
    summary: {
      totalThisMonth,
      resolvedThisMonth,
      openNow,
      inProgressNow,
      totalToday,
      totalPrevMonth,
      resolvedPrevMonth,
      conversationVariation,
      resolutionRate,
      totalMessages,
    },
    byStatus: conversationsByStatus.map((s) => ({
      status: s.status,
      count: s._count.id,
    })),
    byAgent: conversationsByAgent.map((a) => ({
      agentId: a.assignedToId,
      agentName: agentMap.get(a.assignedToId!) || 'Nao atribuido',
      count: a._count.id,
    })),
    byTag: conversationsByTag.map((t) => ({
      tagId: t.tagId,
      tagName: tagMap.get(t.tagId)?.name || 'Desconhecido',
      tagColor: tagMap.get(t.tagId)?.color || '#6B7280',
      count: t._count.conversationId,
    })),
    recentConversations,
  };
}
