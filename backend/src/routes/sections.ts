import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

// Zod schemas
const createSectionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const updateSectionSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

const assignWriterSchema = z.object({
  writerId: z.string().uuid(),
});

// GET /api/sections - List sections
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const includeArchived = req.query.includeArchived === 'true';

    let sections;

    if (user.role === Role.EDITOR) {
      // Editors see all sections
      sections = await prisma.section.findMany({
        where: includeArchived ? {} : { isArchived: false },
        include: {
          owner: { select: { id: true, email: true } },
          _count: { select: { articles: true, writers: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      // Writers see only sections they are assigned to, and only active ones
      const assignments = await prisma.sectionWriterAssignment.findMany({
        where: {
          writerId: user.id,
          section: includeArchived ? {} : { isArchived: false }
        },
        include: {
          section: {
            include: {
              owner: { select: { id: true, email: true } },
              _count: { select: { articles: true, writers: true } }
            }
          }
        },
        orderBy: { section: { createdAt: 'desc' } }
      });
      sections = assignments.map(a => a.section);
    }

    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sections/:id - Get section details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const section = await prisma.section.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, email: true } },
        writers: {
          include: { writer: { select: { id: true, email: true } } }
        }
      }
    });

    if (!section) return res.status(404).json({ error: 'Not found' });

    // Writers can only view if assigned
    if (req.user!.role === Role.WRITER) {
      const isAssigned = section.writers.some(w => w.writerId === req.user!.id);
      if (!isAssigned) return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(section);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sections - Create section
router.post('/', authenticate, requireRole(Role.EDITOR), async (req: AuthRequest, res: Response) => {
  try {
    const data = createSectionSchema.parse(req.body);
    const section = await prisma.section.create({
      data: {
        ...data, description: data.description || null,
        ownerId: req.user!.id
      }
    });
    res.status(201).json(section);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: (err as any).issues });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/sections/:id - Edit section
router.patch('/:id', authenticate, requireRole(Role.EDITOR), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = updateSectionSchema.parse(req.body);
    
    const section = await prisma.section.update({
      where: { id },
      data: { ...data, description: data.description || null }
    });
    res.json(section);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: (err as any).issues });
    // Prisma error for not found would be caught here, for brevity we return 500 or 404 based on code
    res.status(500).json({ error: 'Internal server error or not found' });
  }
});

// POST /api/sections/:id/archive
router.post('/:id/archive', authenticate, requireRole(Role.EDITOR), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const section = await prisma.section.update({
      where: { id },
      data: { isArchived: true }
    });
    res.json(section);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error or not found' });
  }
});

// POST /api/sections/:id/restore
router.post('/:id/restore', authenticate, requireRole(Role.EDITOR), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const section = await prisma.section.update({
      where: { id },
      data: { isArchived: false }
    });
    res.json(section);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error or not found' });
  }
});

// POST /api/sections/:id/writers - Assign writer
router.post('/:id/writers', authenticate, requireRole(Role.EDITOR), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { writerId } = assignWriterSchema.parse(req.body);

    // Verify writer exists and is a writer
    const writer = await prisma.user.findUnique({ where: { id: writerId } });
    if (!writer || writer.role !== Role.WRITER) {
      return res.status(400).json({ error: 'Invalid writer ID' });
    }

    const assignment = await prisma.sectionWriterAssignment.create({
      data: {
        sectionId: id,
        writerId: writerId
      }
    });
    res.status(201).json(assignment);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: (err as any).issues });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Writer already assigned to this section' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/sections/:id/writers/:writerId - Remove writer
router.delete('/:id/writers/:writerId', authenticate, requireRole(Role.EDITOR), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string; const writerId = req.params.writerId as string;
    
    // Using deleteMany to handle compound uniqueness or just ensuring we match both
    const result = await prisma.sectionWriterAssignment.deleteMany({
      where: {
        sectionId: id,
        writerId: writerId
      }
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ message: 'Writer removed from section successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
