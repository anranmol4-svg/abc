import { Article, ArticleStatus, User, Role } from '@prisma/client';
import { prisma } from '../db';

export const VALID_TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  DRAFT: [ArticleStatus.IN_REVIEW],
  IN_REVIEW: [ArticleStatus.DRAFT, ArticleStatus.APPROVED],
  APPROVED: [ArticleStatus.IN_REVIEW, ArticleStatus.SCHEDULED, ArticleStatus.PUBLISHED],
  SCHEDULED: [ArticleStatus.IN_REVIEW, ArticleStatus.APPROVED, ArticleStatus.PUBLISHED],
  PUBLISHED: [ArticleStatus.APPROVED],
};

export const canTransition = (from: ArticleStatus, to: ArticleStatus): boolean => {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
};

export const performTransition = async (
  article: Article,
  targetStatus: ArticleStatus,
  actor: User,
  extraData?: { publishAt?: Date }
) => {
  if (!canTransition(article.status, targetStatus)) {
    throw new Error(`Cannot transition article from ${article.status} to ${targetStatus}`);
  }

  // Role checks
  if (targetStatus === ArticleStatus.APPROVED) {
    if (actor.role !== Role.EDITOR) {
      throw new Error('Only editors can approve articles');
    }
    if (article.authorId === actor.id) {
      throw new Error('An editor cannot approve their own article');
    }
  }

  if (targetStatus === ArticleStatus.SCHEDULED || targetStatus === ArticleStatus.PUBLISHED) {
    if (actor.role !== Role.EDITOR) {
      throw new Error('Only editors can schedule or publish articles');
    }
  }
  
  if (targetStatus === ArticleStatus.APPROVED && (article.status === ArticleStatus.SCHEDULED || article.status === ArticleStatus.PUBLISHED)) {
    // Unpublish
    if (actor.role !== Role.EDITOR) {
      throw new Error('Only editors can unpublish articles');
    }
  }

  // Apply transition
  const updatedData: any = {
    status: targetStatus,
  };

  if (targetStatus === ArticleStatus.SCHEDULED) {
    if (!extraData?.publishAt) throw new Error('publishAt is required when scheduling');
    updatedData.publishAt = extraData.publishAt;
  }

  if (targetStatus === ArticleStatus.PUBLISHED) {
    updatedData.publishedAt = new Date();
  }

  // If unpublishing, clear publish dates?
  if (targetStatus === ArticleStatus.APPROVED && (article.status === ArticleStatus.SCHEDULED || article.status === ArticleStatus.PUBLISHED)) {
    updatedData.publishAt = null;
    // We might keep publishedAt for historical reasons, but typically we clear it or mark as unpublished. 
    // The instructions say "unpublish back to Approved".
  }

  // Run transaction to also record history (Milestone 6, but we'll prepare it)
  const updatedArticle = await prisma.$transaction(async (tx) => {
    const updated = await tx.article.update({
      where: { id: article.id },
      data: updatedData,
    });

    await tx.articleStatusHistory.create({
      data: {
        articleId: article.id,
        oldStatus: article.status,
        newStatus: targetStatus,
        actorId: actor.id,
      }
    });

    if (targetStatus === ArticleStatus.SCHEDULED) {
      // Reset any previous alerts so it can trigger again if overdue
      await tx.articleAlert.deleteMany({
        where: { articleId: article.id }
      });
    }

    return updated;
  });

  return updatedArticle;
};
