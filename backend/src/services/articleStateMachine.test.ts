import { describe, it, expect, vi } from 'vitest';
import { canTransition, performTransition } from './articleStateMachine';
import { ArticleStatus, Role } from '@prisma/client';

// Mock prisma transaction
vi.mock('../db', () => ({
  prisma: {
    $transaction: vi.fn(async (callback) => {
      // Mock the transaction client
      const tx = {
        article: { update: vi.fn().mockResolvedValue({ id: '1', status: 'NEW_STATUS' }) },
        articleStatusHistory: { create: vi.fn() },
        articleAlert: { deleteMany: vi.fn() }
      };
      return await callback(tx);
    })
  }
}));

describe('Article State Machine', () => {
  describe('canTransition', () => {
    it('allows DRAFT to IN_REVIEW', () => {
      expect(canTransition(ArticleStatus.DRAFT, ArticleStatus.IN_REVIEW)).toBe(true);
    });

    it('rejects DRAFT to PUBLISHED', () => {
      expect(canTransition(ArticleStatus.DRAFT, ArticleStatus.PUBLISHED)).toBe(false);
    });

    it('allows APPROVED to SCHEDULED', () => {
      expect(canTransition(ArticleStatus.APPROVED, ArticleStatus.SCHEDULED)).toBe(true);
    });
  });

  describe('performTransition', () => {
    const mockWriter = { id: 'w1', email: 'w@w.com', role: Role.WRITER, createdAt: new Date(), updatedAt: new Date(), password: 'pass' };
    const mockEditor = { id: 'e1', email: 'e@e.com', role: Role.EDITOR, createdAt: new Date(), updatedAt: new Date(), password: 'pass' };
    const mockArticle = { id: 'a1', title: 'Test', body: 'Body', authorId: 'w1', sectionId: 's1', status: ArticleStatus.DRAFT, createdAt: new Date(), updatedAt: new Date(), publishAt: null, publishedAt: null };

    it('throws error if transition is completely invalid', async () => {
      await expect(
        performTransition(mockArticle, ArticleStatus.PUBLISHED, mockEditor)
      ).rejects.toThrow(/Cannot transition article/);
    });

    it('allows writer to submit for review', async () => {
      const res = await performTransition(mockArticle, ArticleStatus.IN_REVIEW, mockWriter);
      expect(res).toBeDefined();
    });

    it('rejects writer trying to approve', async () => {
      const inReviewArticle = { ...mockArticle, status: ArticleStatus.IN_REVIEW };
      await expect(
        performTransition(inReviewArticle, ArticleStatus.APPROVED, mockWriter)
      ).rejects.toThrow(/Only editors can approve/);
    });

    it('rejects editor approving their own article', async () => {
      const inReviewArticle = { ...mockArticle, status: ArticleStatus.IN_REVIEW, authorId: mockEditor.id };
      await expect(
        performTransition(inReviewArticle, ArticleStatus.APPROVED, mockEditor)
      ).rejects.toThrow(/An editor cannot approve their own/);
    });

    it('allows editor to approve another writers article', async () => {
      const inReviewArticle = { ...mockArticle, status: ArticleStatus.IN_REVIEW };
      const res = await performTransition(inReviewArticle, ArticleStatus.APPROVED, mockEditor);
      expect(res).toBeDefined();
    });
  });
});
