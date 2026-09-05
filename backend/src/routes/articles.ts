import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { ArticleStatus, Role } from '@prisma/client';
import { performTransition } from '../services/articleStateMachine';

const router = Router();

const createArticleSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  sectionId: z.string().uuid(),
});

const updateArticleSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
});

const scheduleSchema = z.object({
  publishAt: z.string().datetime(),
});

// GET /api/articles
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let articles;
    if (user.role === Role.EDITOR) {
      articles = await prisma.article.findMany({
        include: { author: { select: { id: true, email: true } }, section: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      articles = await prisma.article.findMany({
        where: { authorId: user.id },
        include: { author: { select: { id: true, email: true } }, section: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/articles/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const article = await prisma.article.findUnique({
      where: { id },
      include: { author: { select: { id: true, email: true } }, section: { select: { id: true, name: true } } },
    });

    if (!article) return res.status(404).json({ error: 'Not found' });

    if (req.user!.role === Role.WRITER && article.authorId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(article);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/articles
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const data = createArticleSchema.parse(req.body);

    if (user.role === Role.WRITER) {
      const assignment = await prisma.sectionWriterAssignment.findUnique({
        where: { sectionId_writerId: { sectionId: data.sectionId, writerId: user.id } }
      });
      if (!assignment) {
        return res.status(403).json({ error: 'You are not assigned to this section' });
      }
    } else if (user.role === Role.EDITOR) {
      const section = await prisma.section.findUnique({ where: { id: data.sectionId } });
      if (!section) return res.status(400).json({ error: 'Section not found' });
    }

    const article = await prisma.article.create({
      data: {
        ...data,
        authorId: user.id,
        status: ArticleStatus.DRAFT,
      }
    });
    
    // Initial history record
    await prisma.articleStatusHistory.create({
      data: {
        articleId: article.id,
        newStatus: ArticleStatus.DRAFT,
        actorId: user.id
      }
    });

    res.status(201).json(article);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: (err as any).issues });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/articles/:id
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = req.user!;
    const data = updateArticleSchema.parse(req.body);

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    if (user.role === Role.WRITER && existing.authorId !== user.id) {
      return res.status(403).json({ error: 'Forbidden: Can only edit your own articles' });
    }

    if (existing.status === ArticleStatus.PUBLISHED) {
      return res.status(400).json({ error: 'Cannot directly edit a published article. Use revisions.' });
    }

    let nextStatus = existing.status;
    if (Object.keys(data).length > 0 && (existing.status === ArticleStatus.APPROVED || existing.status === ArticleStatus.SCHEDULED)) {
      nextStatus = ArticleStatus.IN_REVIEW;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.article.update({
        where: { id },
        data: {
          ...data,
          status: nextStatus,
          publishAt: nextStatus === ArticleStatus.IN_REVIEW ? null : existing.publishAt
        }
      });
      
      if (nextStatus !== existing.status) {
        await tx.articleStatusHistory.create({
          data: {
            articleId: id,
            oldStatus: existing.status,
            newStatus: nextStatus,
            actorId: user.id
          }
        });
      }
      return u;
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: (err as any).issues });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/articles/:id/submit
router.post('/:id/submit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = req.user!;
    
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) return res.status(404).json({ error: 'Not found' });

    if (user.role === Role.WRITER && article.authorId !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await performTransition(article, ArticleStatus.IN_REVIEW, user);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/articles/:id/approve
router.post('/:id/approve', authenticate, requireRole(Role.EDITOR), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) return res.status(404).json({ error: 'Not found' });

    const updated = await performTransition(article, ArticleStatus.APPROVED, req.user!);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/articles/:id/schedule
router.post('/:id/schedule', authenticate, requireRole(Role.EDITOR), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { publishAt } = scheduleSchema.parse(req.body);
    
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) return res.status(404).json({ error: 'Not found' });

    const updated = await performTransition(article, ArticleStatus.SCHEDULED, req.user!, { publishAt: new Date(publishAt) });
    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: (err as any).issues });
    res.status(400).json({ error: err.message });
  }
});

// POST /api/articles/:id/publish
router.post('/:id/publish', authenticate, requireRole(Role.EDITOR), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) return res.status(404).json({ error: 'Not found' });

    const updated = await performTransition(article, ArticleStatus.PUBLISHED, req.user!);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/articles/:id/unpublish
router.post('/:id/unpublish', authenticate, requireRole(Role.EDITOR), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) return res.status(404).json({ error: 'Not found' });

    const updated = await performTransition(article, ArticleStatus.APPROVED, req.user!);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ================= MILESTONE 6: Revisions & History =================

const commentSchema = z.object({
  content: z.string().min(1),
});

// GET /api/articles/:id/history
router.get('/:id/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    
    // Writers can only view if assigned (or author)
    const article = await prisma.article.findUnique({
      where: { id },
      include: { section: { include: { writers: true } } }
    });
    if (!article) return res.status(404).json({ error: 'Not found' });

    if (req.user!.role === Role.WRITER && article.authorId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const history = await prisma.articleStatusHistory.findMany({
      where: { articleId: id },
      include: { actor: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const comments = await prisma.articleComment.findMany({
      where: { articleId: id },
      include: { author: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const revisions = await prisma.articleRevision.findMany({
      where: { articleId: id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      history,
      comments,
      revisions
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/articles/:id/comments
router.post('/:id/comments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { content } = commentSchema.parse(req.body);
    
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) return res.status(404).json({ error: 'Not found' });

    if (req.user!.role === Role.WRITER && article.authorId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const comment = await prisma.articleComment.create({
      data: {
        articleId: id,
        authorId: req.user!.id,
        content
      }
    });
    res.status(201).json(comment);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: (err as any).issues });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/articles/:id/revisions
router.post('/:id/revisions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = req.user!;
    
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) return res.status(404).json({ error: 'Not found' });

    if (article.status !== ArticleStatus.PUBLISHED) {
      return res.status(400).json({ error: 'Revisions can only be created for published articles' });
    }

    if (user.role === Role.WRITER && article.authorId !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const revision = await prisma.articleRevision.create({
      data: {
        articleId: id,
        title: article.title,
        body: article.body,
        status: ArticleStatus.DRAFT,
      }
    });

    res.status(201).json(revision);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Minimal endpoint to publish a revision and replace the article content
router.post('/:id/revisions/:revisionId/publish', authenticate, requireRole(Role.EDITOR), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const revisionId = req.params.revisionId as string;
    
    const revision = await prisma.articleRevision.findUnique({ where: { id: revisionId } });
    if (!revision || revision.articleId !== id) return res.status(404).json({ error: 'Revision not found' });

    if (revision.status === ArticleStatus.PUBLISHED) {
      return res.status(400).json({ error: 'Already published' });
    }

    // In a full implementation, the revision would have its own state machine flow (Draft -> Review -> Approved -> Publish).
    // For brevity, we allow the editor to publish it directly here, which applies it to the main article.
    const updated = await prisma.$transaction(async (tx) => {
      await tx.articleRevision.update({
        where: { id: revisionId },
        data: { status: ArticleStatus.PUBLISHED, publishedAt: new Date() }
      });

      const updatedArticle = await tx.article.update({
        where: { id },
        data: {
          title: revision.title,
          body: revision.body,
        }
      });

      await tx.articleStatusHistory.create({
        data: {
          articleId: id,
          oldStatus: ArticleStatus.PUBLISHED,
          newStatus: ArticleStatus.PUBLISHED, // Indicate content update via revision
          actorId: req.user!.id,
        }
      });

      return updatedArticle;
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
