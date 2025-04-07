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

        // Verificar si el usuario está activo
        if (!user.isActive) {
          return done(null, false);
        }

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
      
      req.login(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        
        // Actualizar fecha de último login
        try {
          await storage.updateUserLastLogin(user.id);
        } catch (error) {
          console.error("Error updating last login:", error);
        }
        
        return res.json({ ...user, password: undefined });
      });
    })(req, res, next);
  });

  // Ruta para logout
  app.post("/api/logout", (req, res, next) => {
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

  // Ruta para cambiar el estado de un usuario (activar/desactivar)
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
}