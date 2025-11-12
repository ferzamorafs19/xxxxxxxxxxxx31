import { db } from '../db';
import { linkUsageWeekly, type InsertLinkUsageWeekly } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

const WEEKLY_LINK_LIMIT = 150;

function getWeekStartDate(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export class LinkQuotaService {
  async checkQuota(userId: number): Promise<{ 
    allowed: boolean; 
    remaining: number; 
    limit: number;
    weekStart: Date;
  }> {
    const weekStart = getWeekStartDate();
    
    const usage = await db.query.linkUsageWeekly.findFirst({
      where: and(
        eq(linkUsageWeekly.userId, userId),
        eq(linkUsageWeekly.weekStartDate, weekStart)
      )
    });

    const currentCount = usage?.linkCount || 0;
    const remaining = Math.max(0, WEEKLY_LINK_LIMIT - currentCount);
    
    return {
      allowed: currentCount < WEEKLY_LINK_LIMIT,
      remaining,
      limit: WEEKLY_LINK_LIMIT,
      weekStart
    };
  }

  async incrementUsage(userId: number): Promise<void> {
    const weekStart = getWeekStartDate();
    
    const existing = await db.query.linkUsageWeekly.findFirst({
      where: and(
        eq(linkUsageWeekly.userId, userId),
        eq(linkUsageWeekly.weekStartDate, weekStart)
      )
    });

    if (existing) {
      await db.update(linkUsageWeekly)
        .set({
          linkCount: existing.linkCount + 1,
          lastGeneratedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(linkUsageWeekly.id, existing.id));
    } else {
      await db.insert(linkUsageWeekly).values({
        userId,
        weekStartDate: weekStart,
        linkCount: 1,
        lastGeneratedAt: new Date()
      });
    }
  }

  async getCurrentUsage(userId: number): Promise<{
    count: number;
    limit: number;
    remaining: number;
    weekStart: Date;
    lastGenerated: Date | null;
  }> {
    const weekStart = getWeekStartDate();
    
    const usage = await db.query.linkUsageWeekly.findFirst({
      where: and(
        eq(linkUsageWeekly.userId, userId),
        eq(linkUsageWeekly.weekStartDate, weekStart)
      )
    });

    const count = usage?.linkCount || 0;
    
    return {
      count,
      limit: WEEKLY_LINK_LIMIT,
      remaining: Math.max(0, WEEKLY_LINK_LIMIT - count),
      weekStart,
      lastGenerated: usage?.lastGeneratedAt || null
    };
  }

  async resetWeeklyUsage(userId: number): Promise<void> {
    const weekStart = getWeekStartDate();
    
    await db.update(linkUsageWeekly)
      .set({
        linkCount: 0,
        updatedAt: new Date()
      })
      .where(and(
        eq(linkUsageWeekly.userId, userId),
        eq(linkUsageWeekly.weekStartDate, weekStart)
      ));
  }
}

export const linkQuotaService = new LinkQuotaService();
