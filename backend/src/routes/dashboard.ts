import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ArticleStatus, Role } from '@prisma/client';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    // For a writer, they might only see their own stats or section stats.
    // The prompt says "dashboard landing page". Let's assume global for editors, filtered for writers.
    
    const whereAuthor = user.role === Role.WRITER ? { authorId: user.id } : {};

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);

    // Headline Metrics
    const inReview = await prisma.article.count({ where: { ...whereAuthor, status: ArticleStatus.IN_REVIEW } });
    const scheduledThisWeek = await prisma.article.count({
      where: { ...whereAuthor, status: ArticleStatus.SCHEDULED, publishAt: { gte: oneWeekAgo, lte: now } }
    });
    const publishedThisWeek = await prisma.article.count({
      where: { ...whereAuthor, status: ArticleStatus.PUBLISHED, publishedAt: { gte: oneWeekAgo, lte: now } }
    });
    const openDrafts = await prisma.article.count({ where: { ...whereAuthor, status: ArticleStatus.DRAFT } });

    // Status Breakdown
    const statusGroups = await prisma.article.groupBy({
      by: ['status'],
      where: whereAuthor,
      _count: true,
    });
    const statusBreakdown = statusGroups.map(g => ({ name: g.status, value: g._count }));

    // Section Breakdown
    const sectionGroups = await prisma.article.groupBy({
      by: ['sectionId'],
      where: whereAuthor,
      _count: true,
    });
    
    // Fetch section names
    const sections = await prisma.section.findMany({
      where: { id: { in: sectionGroups.map(g => g.sectionId) } },
      select: { id: true, name: true }
    });
    const sectionBreakdown = sectionGroups.map(g => {
      const section = sections.find(s => s.id === g.sectionId);
      return { name: section?.name || 'Unknown', value: g._count };
    });

    // 8-week chart (Published articles per week)
    const publishedArticles = await prisma.article.findMany({
      where: { ...whereAuthor, status: ArticleStatus.PUBLISHED, publishedAt: { gte: eightWeeksAgo } },
      select: { publishedAt: true }
    });

    const weeklyData: Record<string, number> = {};
    for (let i = 0; i < 8; i++) {
      // Calculate start of each week backward
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
      weeklyData[label] = 0;
      
      publishedArticles.forEach(a => {
        if (a.publishedAt && a.publishedAt >= weekStart && a.publishedAt < weekEnd) {
          weeklyData[label] = (weeklyData[label] as number) + 1;
        }
      });
    }

    const eightWeekChart = Object.keys(weeklyData).reverse().map(key => ({
      week: key,
      published: weeklyData[key]
    }));

    res.json({
      metrics: {
        inReview,
        scheduledThisWeek,
        publishedThisWeek,
        openDrafts
      },
      statusBreakdown,
      sectionBreakdown,
      eightWeekChart
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
