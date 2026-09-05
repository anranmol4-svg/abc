import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ArticleStatus, Role } from '@prisma/client';

const router = Router();

// GET /api/alerts
router.get('/', authenticate, requireRole(Role.EDITOR), async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    
    // Find all overdue articles
    const overdueArticles = await prisma.article.findMany({
      where: {
        status: ArticleStatus.SCHEDULED,
        publishAt: { lt: now }
      },
    });

    // Create alerts for overdue articles that don't have one yet
    for (const article of overdueArticles) {
      const existingAlert = await prisma.articleAlert.findFirst({
        where: { articleId: article.id }
      });

      if (!existingAlert) {
        await prisma.articleAlert.create({
          data: { articleId: article.id }
        });
      }
    }

    // Now return all non-dismissed alerts
    const alerts = await prisma.articleAlert.findMany({
      where: { isDismissed: false },
      include: {
        article: {
          select: { id: true, title: true, publishAt: true, section: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      alerts,
      count: alerts.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/alerts/:id/dismiss
router.post('/:id/dismiss', authenticate, requireRole(Role.EDITOR), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    
    const alert = await prisma.articleAlert.update({
      where: { id },
      data: { isDismissed: true }
    });

    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error or not found' });
  }
});

export default router;
