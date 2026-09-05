import { describe, it, expect, vi } from 'vitest';
import { requireRole } from './auth';
import { Role } from '@prisma/client';

describe('Auth Middleware', () => {
  describe('requireRole', () => {
    it('calls next if role matches', () => {
      const middleware = requireRole(Role.EDITOR);
      const req = { user: { role: Role.EDITOR } } as any;
      const res = {} as any;
      const next = vi.fn();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('returns 403 if role does not match', () => {
      const middleware = requireRole(Role.EDITOR);
      const req = { user: { role: Role.WRITER } } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;
      const next = vi.fn();
      
      middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });
  });
});
