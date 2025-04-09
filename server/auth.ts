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
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 1 día
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
          return done(null, false, { message: "Usuario inactivo" });
        }
        
        console.log(`[Auth] Login exitoso para: ${username}, role: ${user.role}, isActive: ${user.isActive}`);

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
      const { username, password, role = UserRole.USER } = req.body;
      
      // Validar datos
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      // Verificar si el usuario ya existe
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Crear nuevo usuario con contraseña hasheada
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role,
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
    passport.authenticate("local", (err: Error, user: Express.User | false | null, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }
      
      // Verificar límite de dispositivos
      if (user.deviceCount >= user.maxDevices && user.role !== UserRole.ADMIN) {
        console.log(`[Auth] Usuario ${user.username} - Límite de dispositivos excedido: ${user.deviceCount}/${user.maxDevices}`);
        return res.status(403).json({ 
          message: "Has alcanzado el límite de dispositivos conectados. Cierra sesión en otro dispositivo para continuar.",
          error: "DEVICE_LIMIT_REACHED",
          deviceCount: user.deviceCount,
          maxDevices: user.maxDevices
        });
      }
      
      req.login(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        
        // Incrementar contador de dispositivos y actualizar fecha de último login
        try {
          // Los admins no están sujetos al límite de dispositivos
          if (user.role !== UserRole.ADMIN) {
            await storage.incrementUserDeviceCount(user.username);
            console.log(`[Auth] Usuario ${user.username} - Incrementado contador de dispositivos a ${user.deviceCount + 1}`);
          }
          
          await storage.updateUserLastLogin(user.id);
        } catch (error) {
          console.error("Error actualizando datos de usuario:", error);
        }
        
        return res.json({ ...user, password: undefined });
      });
    })(req, res, next);
  });

  // Ruta para logout - Reduce el contador de dispositivos al cerrar sesión
  app.post("/api/logout", async (req, res, next) => {
    // Decrementar el contador de dispositivos si es un usuario no admin
    if (req.isAuthenticated() && req.user.role !== UserRole.ADMIN) {
      try {
        // Obtenemos el usuario actual para decrementar su contador de dispositivos
        const user = req.user;
        console.log(`[Auth] Reduciendo contador de dispositivos para ${user.username}`);
        
        // Implementar método para decrementar el contador (necesita crearse en storage.ts)
        // NO disminuimos por debajo de 0 por seguridad
        if (user.deviceCount > 0) {
          // Decrementar el contador
          const updatedUser = await storage.decrementUserDeviceCount(user.username);
          console.log(`[Auth] Contador de dispositivos actualizado a ${updatedUser.deviceCount}`);
        }
      } catch (error) {
        console.error("Error decrementando contador de dispositivos:", error);
      }
    }
    
    req.logout((err) => {
      if (err) return next(err);
      res.json({ success: true });
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
}