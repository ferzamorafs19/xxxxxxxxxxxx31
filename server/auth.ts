import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import { UserRole } from "@shared/schema";
import { nanoid } from "nanoid";
import MemoryStore from "memorystore";
import bcrypt from "bcrypt";

// Use an interface instead of the direct User type to avoid circular references
export interface UserWithAuth {
  id: number;
  username: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  expiresAt: Date | null;
  deviceCount: number;
  maxDevices: number;
  allowedBanks: string; // 'all' o lista separada por comas
  createdAt: Date | null;
  lastLogin: Date | null;
}

declare global {
  namespace Express {
    // Define the User interface for express session
    interface User extends UserWithAuth {}
  }
}

// Crear almacenamiento para sesiones
const MemoryStoreSession = MemoryStore(session);
const sessionStore = new MemoryStoreSession({
  checkPeriod: 86400000 // Prune expired entries every 24h
});

// Función para hashear contraseñas
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

// Función para comparar contraseñas (hash almacenado vs contraseña proporcionada)
export async function comparePasswords(supplied: string, stored: string) {
  return bcrypt.compare(supplied, stored);
}

export function setupAuth(app: Express) {
  // Configurar sesiones y passport
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || nanoid(),
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    name: 'banksystem.sid', // Nombre específico para evitar conflictos
    rolling: true, // Renueva la cookie en cada interacción para reiniciar el tiempo de inactividad
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Cookies seguras solo en producción
      maxAge: 40 * 60 * 1000, // 40 minutos de inactividad máxima
      sameSite: 'lax', // Menos restrictivo que 'strict', más seguro que 'none'
      httpOnly: true, // Mayor seguridad
      path: '/'
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configurar estrategia local (username + password)
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false);
        }
        
        // Verificar si la contraseña coincide
        const passwordMatches = await comparePasswords(password, user.password);
        if (!passwordMatches) {
          return done(null, false);
        }

        // Verificar si el usuario está activo (solo para usuarios no admin)
        if (user.role !== UserRole.ADMIN && !user.isActive) {
          console.log(`[Auth] Usuario inactivo: ${username}, no puede iniciar sesión`);
          return done(null, false, { message: "Usuario inactivo. Contacta con el administrador en Telegram: @BalonxSistema" });
        }
        
        // Verificar si la cuenta ha vencido (expiresAt en el pasado)
        if (user.role !== UserRole.ADMIN && user.expiresAt && new Date(user.expiresAt) < new Date()) {
          console.log(`[Auth] Usuario con cuenta vencida: ${username}, expiresAt: ${user.expiresAt}`);
          
          // Desactivar automáticamente el usuario si está vencido
          await storage.updateUser(user.id, { isActive: false });
          
          return done(null, false, { 
            message: "Tu cuenta ha vencido. Por favor contacta al administrador en Telegram: @BalonxSistema para renovar tu suscripción." 
          });
        }
        
        // Verificar si la cuenta está por vencer pronto (en menos de 24 horas)
        let expirationWarning = null;
        if (user.role !== UserRole.ADMIN && user.expiresAt) {
          const expiresAt = new Date(user.expiresAt);
          const now = new Date();
          const hoursRemaining = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
          
          if (hoursRemaining < 24) {
            expirationWarning = `Tu cuenta vence en menos de 24 horas. Contacta al administrador en Telegram: @BalonxSistema para renovar.`;
            console.log(`[Auth] Usuario con cuenta por vencer pronto: ${username}, horas restantes: ${hoursRemaining.toFixed(1)}`);
          }
        }
        
        console.log(`[Auth] Login exitoso para: ${username}, role: ${user.role}, isActive: ${user.isActive}`);
        
        // Actualizar la fecha del último inicio de sesión
        await storage.updateUserLastLogin(user.id);

        return done(null, user as Express.User);
      } catch (error) {
        return done(error);
      }
    })
  );

  // Serialización y deserialización de usuario
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user as Express.User);
    } catch (error) {
      done(error);
    }
  });

  // Ruta para registro de usuarios
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, role = UserRole.USER, allowedBanks = 'all' } = req.body;
      
      // Validar datos
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      // Verificar si el usuario ya existe
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Normalizar el allowedBanks si es 'all' (sin importar mayúsculas/minúsculas)
      const normalizedAllowedBanks = 
        typeof allowedBanks === 'string' && allowedBanks.toLowerCase() === 'all' 
          ? 'all' 
          : allowedBanks;
      
      console.log(`[Auth] Creando usuario ${username} con bancos permitidos: ${normalizedAllowedBanks}`);
      
      // Crear nuevo usuario con contraseña hasheada
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role,
        allowedBanks: normalizedAllowedBanks,
      });
      
      // Iniciar sesión automáticamente
      req.login(user as Express.User, (err) => {
        if (err) return next(err);
        return res.status(201).json({ ...user, password: undefined });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Ruta para login
  app.post("/api/login", (req, res, next) => {
    // Regenerar ID de sesión antes de iniciar sesión
    req.session.regenerate((regenerateErr) => {
      if (regenerateErr) {
        console.error("[Auth] Error regenerando sesión antes del login:", regenerateErr);
        // Continuar a pesar del error
      }
      
      passport.authenticate("local", (err: Error, user: Express.User | false | null, info: any) => {
        if (err) {
          console.error("[Auth] Error en autenticación:", err);
          return next(err);
        }
        
        if (!user) {
          console.log("[Auth] Intento de login fallido (credenciales inválidas)");
          return res.status(401).json({ message: "Credenciales inválidas" });
        }
        
        console.log(`[Auth] Usuario autenticado: ${user.username}, role: ${user.role}`);
        
        // Se ha eliminado la verificación del límite de dispositivos
        
        req.login(user, async (loginErr) => {
          if (loginErr) {
            console.error(`[Auth] Error en login para ${user.username}:`, loginErr);
            return next(loginErr);
          }
          
          // Actualizar fecha de último login (se ha eliminado el incremento del contador de dispositivos)
          try {
            await storage.updateUserLastLogin(user.id);
            console.log(`[Auth] Login completado con éxito para: ${user.username}`);
          } catch (error) {
            console.error(`[Auth] Error actualizando datos de usuario ${user.username}:`, error);
          }
          
          return res.json({ ...user, password: undefined });
        });
      })(req, res, next);
    });
  });

  // Ruta para logout - Reduce el contador de dispositivos al cerrar sesión
  app.post("/api/logout", async (req, res, next) => {
    // Solo procesar si hay sesión activa
    if (!req.isAuthenticated()) {
      return res.json({ success: true, message: "No había sesión activa" });
    }
    
    // Capturar datos del usuario antes de cerrar sesión
    const user = req.user;
    const username = user.username;
    const isAdmin = user.role === UserRole.ADMIN;
    
    console.log(`[Auth] Solicitud de cierre de sesión para: ${username}`);
    
    // Decrementar el contador de dispositivos si es un usuario no admin
    if (!isAdmin) {
      try {
        console.log(`[Auth] Reduciendo contador de dispositivos para ${username}`);
        
        // NO disminuimos por debajo de 0 por seguridad
        if (user.deviceCount > 0) {
          // Decrementar el contador
          const updatedUser = await storage.decrementUserDeviceCount(username);
          console.log(`[Auth] Contador de dispositivos actualizado a ${updatedUser.deviceCount}`);
        }
      } catch (error) {
        console.error(`[Auth] Error decrementando contador de dispositivos para ${username}:`, error);
      }
    }
    
    // Cerrar sesión
    req.logout((err) => {
      if (err) {
        console.error(`[Auth] Error al cerrar sesión para ${username}:`, err);
        return next(err);
      }
      
      // Regenerar ID de sesión para mayor seguridad
      req.session.regenerate((regenerateErr) => {
        if (regenerateErr) {
          console.error(`[Auth] Error al regenerar sesión para ${username}:`, regenerateErr);
          // Continuar aunque falle la regeneración
        }
        
        console.log(`[Auth] Sesión cerrada correctamente para: ${username}`);
        res.json({ success: true });
      });
    });
  });

  // Ruta para obtener información del usuario actual
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    const user = req.user as Express.User;
    res.json({ ...user, password: undefined });
  });

  // Ruta para obtener todos los usuarios (solo para administradores)
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const user = req.user as Express.User;
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }
    
    try {
      const users = await storage.getAllAdminUsers();
      res.json(users.map((u) => ({ ...u, password: undefined })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Ruta para obtener usuarios regulares (solo visible para el usuario "balonx")
  app.get("/api/users/regular", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const user = req.user as Express.User;
    // Solo permitir al usuario "balonx" acceder a esta ruta
    if (user.username !== "balonx") {
      return res.status(403).json({ message: "No autorizado" });
    }
    
    try {
      // Obtener todos los usuarios (excluyendo administradores)
      const allUsers = await storage.getAllUsers();
      const regularUsers = allUsers.filter(u => u.role === UserRole.USER);
      res.json(regularUsers.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        active: u.isActive,
        lastLogin: u.lastLogin
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Ruta para cambiar el estado de un usuario administrador (activar/desactivar)
  app.put("/api/users/:username/toggle-status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const currentUser = req.user as Express.User;
    if (currentUser.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "No autorizado" });
    }
    
    try {
      const { username } = req.params;
      const success = await storage.toggleAdminUserStatus(username);
      
      if (!success) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Ruta para cambiar el estado de un usuario regular (activar/desactivar)
  // Solo accesible para el usuario "balonx"
  app.post("/api/users/regular/:username/toggle-status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const currentUser = req.user as Express.User;
    if (currentUser.username !== "balonx") {
      return res.status(403).json({ message: "No autorizado" });
    }
    
    try {
      const { username } = req.params;
      const success = await storage.toggleUserStatus(username);
      
      if (!success) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Ruta para activar un usuario por 1 día
  app.post("/api/users/regular/:username/activate-one-day", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const currentUser = req.user as Express.User;
    if (currentUser.username !== "balonx") {
      return res.status(403).json({ message: "No autorizado" });
    }
    
    try {
      const { username } = req.params;
      const { allowedBanks } = req.body; // Obtener bancos permitidos del cuerpo de la solicitud
      
      console.log(`[Auth] Activando usuario ${username} por 1 día, bancos permitidos: ${allowedBanks || 'valor no proporcionado (se conservará el actual)'}`);
      
      // Pasar el parámetro allowedBanks al método de storage si se proporciona
      const user = await storage.activateUserForOneDay(username, allowedBanks);
      
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      const expiresAt = user.expiresAt;
      res.json({ 
        success: true, 
        username: user.username,
        isActive: user.isActive,
        expiresAt,
        allowedBanks: user.allowedBanks, // Devolver el valor actualizado
        message: "Usuario activado por 1 día"
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Ruta para activar un usuario por 7 días
  app.post("/api/users/regular/:username/activate-seven-days", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const currentUser = req.user as Express.User;
    if (currentUser.username !== "balonx") {
      return res.status(403).json({ message: "No autorizado" });
    }
    
    try {
      const { username } = req.params;
      const { allowedBanks } = req.body; // Obtener bancos permitidos del cuerpo de la solicitud
      
      console.log(`[Auth] Activando usuario ${username} por 7 días, bancos permitidos: ${allowedBanks || 'valor no proporcionado (se conservará el actual)'}`);
      
      // Pasar el parámetro allowedBanks al método de storage si se proporciona
      const user = await storage.activateUserForSevenDays(username, allowedBanks);
      
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      const expiresAt = user.expiresAt;
      res.json({ 
        success: true, 
        username: user.username,
        isActive: user.isActive,
        expiresAt,
        allowedBanks: user.allowedBanks, // Devolver el valor actualizado
        message: "Usuario activado por 7 días"
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Ruta para obtener información de expiración del usuario actual
  app.get("/api/user/subscription", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      const user = req.user;
      
      if (user.role === UserRole.ADMIN) {
        return res.json({
          isActive: true,
          isPaid: true,
          isAdmin: true,
          expiresAt: null,
          daysRemaining: null,
          hoursRemaining: null,
          message: "Los administradores no tienen fecha de expiración"
        });
      }
      
      const now = new Date();
      let daysRemaining = null;
      let hoursRemaining = null;
      let message = "";
      
      if (user.expiresAt) {
        const expiresAt = new Date(user.expiresAt);
        const timeRemainingMs = expiresAt.getTime() - now.getTime();
        
        if (timeRemainingMs <= 0) {
          // Ya expiró
          message = "Tu suscripción ha expirado. Contacta al administrador en Telegram: @BalonxSistema para renovar.";
          // Desactivar automáticamente
          await storage.updateUser(user.id, { isActive: false });
        } else {
          // Calcular días y horas restantes
          daysRemaining = Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24));
          hoursRemaining = Math.floor((timeRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          
          if (daysRemaining === 0 && hoursRemaining < 24) {
            message = `Tu suscripción vence en ${hoursRemaining} horas. Contacta al administrador en Telegram: @BalonxSistema para renovar.`;
          } else {
            message = `Tu suscripción vence en ${daysRemaining} días y ${hoursRemaining} horas.`;
          }
        }
      } else if (!user.isActive) {
        message = "Tu cuenta está inactiva. Contacta al administrador en Telegram: @BalonxSistema para activarla.";
      } else {
        message = "Tu cuenta está activa sin fecha de expiración establecida.";
      }
      
      res.json({
        isActive: user.isActive,
        isPaid: user.isActive && (!user.expiresAt || new Date(user.expiresAt) > now),
        isAdmin: false,
        expiresAt: user.expiresAt,
        daysRemaining,
        hoursRemaining,
        message
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}