import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

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

// GET /api/articles
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    
    // For now, simple list. We will add advanced filters in Milestone 7.
    let articles;
    if (user.role === Role.EDITOR) {
      articles = await prisma.article.findMany({
        include: { author: { select: { id: true, email: true } }, section: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Writers see their own articles or articles in their sections?
      // "Writers can: view their own articles". Let's return just their own for now, or all published in their sections.
      // Requirements say "view their own articles".
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
      // Depending on rules, maybe they can read others if published, but for now stick to author rules
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
      // Ensure section exists
      const section = await prisma.section.findUnique({ where: { id: data.sectionId } });
      if (!section) return res.status(400).json({ error: 'Section not found' });
    }

    const article = await prisma.article.create({
      data: {
        ...data,
        authorId: user.id
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

    const updated = await prisma.article.update({
      where: { id },
      data
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: (err as any).issues });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
