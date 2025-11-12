import { db } from '../db';
import { linkTokens, bankSubdomains, LinkStatus, type InsertLinkToken, siteConfig } from '../../shared/schema';
import { eq, and, lt, or } from 'drizzle-orm';
import crypto from 'crypto';
import { bitlyService } from './bitly';
import { linkQuotaService } from './linkQuota';

export class LinkTokenService {
  generateToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  async getBankSubdomain(bankCode: string): Promise<string | null> {
    const subdomain = await db.query.bankSubdomains.findFirst({
      where: and(
        eq(bankSubdomains.bankCode, bankCode),
        eq(bankSubdomains.isActive, true)
      )
    });

    return subdomain?.subdomain || null;
  }

  async createLink(data: {
    userId: number;
    bankCode: string;
    sessionId?: string;
    metadata?: any;
  }): Promise<{ 
    id: number;
    token: string; 
    originalUrl: string; 
    shortUrl: string | null;
    expiresAt: Date;
  }> {
    const quota = await linkQuotaService.checkQuota(data.userId);
    
    if (!quota.allowed) {
      throw new Error(`Has alcanzado el límite semanal de ${quota.limit} links. Límite se renueva el próximo lunes.`);
    }

    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Obtener el dominio base de la configuración
    const config = await db.query.siteConfig.findFirst();
    const baseUrl = config?.baseUrl || 'https://folioaclaraciones.com';

    // Generar URL con banco en el path: dominio.com/bankCode/client/token
    const originalUrl = `${baseUrl}/${data.bankCode}/client/${token}`;

    let shortUrl: string | null = null;
    let bitlyLinkId: string | null = null;

    try {
      const bitlyResponse = await bitlyService.shorten({
        longUrl: originalUrl,
        title: `Link ${data.bankCode} - ${new Date().toLocaleDateString()}`
      });
      
      shortUrl = bitlyResponse.link;
      bitlyLinkId = bitlyResponse.id;
    } catch (error) {
      console.error('Error al acortar link con Bitly:', error);
    }

    const [inserted] = await db.insert(linkTokens).values({
      userId: data.userId,
      sessionId: data.sessionId || null,
      bankCode: data.bankCode,
      token,
      originalUrl,
      shortUrl,
      bitlyLinkId,
      status: LinkStatus.ACTIVE,
      expiresAt,
      metadata: data.metadata || {}
    }).returning();

    try {
      await linkQuotaService.incrementUsage(data.userId);
    } catch (error) {
      console.error('[Links] Error incrementando cuota, pero link creado:', error);
    }

    return {
      id: inserted.id,
      token,
      originalUrl,
      shortUrl,
      expiresAt
    };
  }

  async validateAndConsumeToken(token: string, metadata?: any): Promise<{ 
    valid: boolean; 
    linkId?: number;
    bankCode?: string;
    sessionId?: string;
    createdBy?: string;
    reason?: 'not_found' | 'already_used' | 'expired' | 'cancelled';
    error?: string;
  }> {
    const link = await db.query.linkTokens.findFirst({
      where: eq(linkTokens.token, token)
    });

    if (!link) {
      return { valid: false, reason: 'not_found', error: 'Token no encontrado' };
    }

    if (link.status === LinkStatus.CONSUMED) {
      return { valid: false, reason: 'already_used', error: 'Este link ya fue usado' };
    }

    if (link.status === LinkStatus.CANCELLED) {
      return { valid: false, reason: 'cancelled', error: 'Este link fue cancelado' };
    }

    const now = new Date();
    const expiresAt = new Date(link.expiresAt);
    
    if (now > expiresAt) {
      await db.update(linkTokens)
        .set({ status: LinkStatus.EXPIRED, updatedAt: new Date() })
        .where(eq(linkTokens.id, link.id));
      
      return { valid: false, reason: 'expired', error: 'Este link ha expirado' };
    }

    await db.update(linkTokens)
      .set({ 
        status: LinkStatus.CONSUMED, 
        usedAt: now,
        metadata: metadata ? { ...(link.metadata as any || {}), ...metadata } : link.metadata,
        updatedAt: now 
      })
      .where(eq(linkTokens.id, link.id));

    return {
      valid: true,
      linkId: link.id,
      bankCode: link.bankCode,
      sessionId: link.sessionId || undefined,
      createdBy: (link.metadata as any)?.createdBy || 'system'
    };
  }

  async updateTokenSession(token: string, sessionId: string): Promise<void> {
    await db.update(linkTokens)
      .set({ 
        sessionId,
        updatedAt: new Date()
      })
      .where(eq(linkTokens.token, token));
  }

  async extendLink(linkId: number, additionalMinutes: number): Promise<void> {
    const link = await db.query.linkTokens.findFirst({
      where: eq(linkTokens.id, linkId)
    });

    if (!link) {
      throw new Error('Link no encontrado');
    }

    if (link.status !== LinkStatus.ACTIVE) {
      throw new Error('Solo se pueden extender links activos');
    }

    const newExpiresAt = new Date(link.expiresAt);
    newExpiresAt.setMinutes(newExpiresAt.getMinutes() + additionalMinutes);

    await db.update(linkTokens)
      .set({
        expiresAt: newExpiresAt,
        extendedUntil: newExpiresAt,
        updatedAt: new Date()
      })
      .where(eq(linkTokens.id, linkId));
  }

  async cancelLink(linkId: number): Promise<void> {
    await db.update(linkTokens)
      .set({
        status: LinkStatus.CANCELLED,
        updatedAt: new Date()
      })
      .where(eq(linkTokens.id, linkId));
  }

  async getLinkHistory(userId: number, limit: number = 50): Promise<any[]> {
    const links = await db.query.linkTokens.findMany({
      where: eq(linkTokens.userId, userId),
      orderBy: (linkTokens, { desc }) => [desc(linkTokens.createdAt)],
      limit
    });

    return links.map(link => {
      const now = new Date();
      const expiresAt = new Date(link.expiresAt);
      const timeRemaining = Math.max(0, expiresAt.getTime() - now.getTime());
      
      return {
        ...link,
        timeRemainingMs: timeRemaining,
        timeRemainingFormatted: this.formatTimeRemaining(timeRemaining),
        isExpired: timeRemaining === 0 || link.status === LinkStatus.EXPIRED
      };
    });
  }

  formatTimeRemaining(ms: number): string {
    if (ms <= 0) return 'Expirado';
    
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${remainingMinutes}m`;
  }

  async expireOldLinks(): Promise<number> {
    const result = await db.update(linkTokens)
      .set({ 
        status: LinkStatus.EXPIRED,
        updatedAt: new Date()
      })
      .where(and(
        eq(linkTokens.status, LinkStatus.ACTIVE),
        lt(linkTokens.expiresAt, new Date())
      ))
      .returning();

    return result.length;
  }
}

export const linkTokenService = new LinkTokenService();
