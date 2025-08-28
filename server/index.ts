import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { obfuscateHeaders, serverMasking, botDetection, errorObfuscation, dynamicRateLimit } from "./middleware/security";
import "./telegramBot"; // Inicializar bot de Telegram

// Extender el tipo Request para incluir bankFromSubdomain
declare global {
  namespace Express {
    interface Request {
      bankFromSubdomain?: string;
    }
  }
}

// Cargar variables de entorno
dotenv.config();

// Set NODE_ENV to production if not set and we're in a deployment environment
if (!process.env.NODE_ENV && process.env.REPLIT_DEPLOYMENT) {
  process.env.NODE_ENV = 'production';
}

const app = express();

// Aplicar middleware de seguridad y ofuscación
app.use(obfuscateHeaders);
app.use(serverMasking);
app.use(botDetection);
app.use(dynamicRateLimit);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Configuración del entorno
const APP_TYPE = process.env.APP_TYPE || 'admin';
console.log(`Ejecutando en modo: ${APP_TYPE}`);

// Middleware para manejar subdominios de bancos
app.use((req, res, next) => {
  const host = req.headers.host || '';
  const hostParts = host.split('.');
  
  // Verificar si es un subdominio de banco (formato: banco.dominio.com)
  if (hostParts.length >= 3) {
    const subdomain = hostParts[0].toLowerCase();
    const baseDomain = hostParts.slice(1).join('.');
    
    // Lista de bancos válidos
    const validBanks = ['liverpool', 'citibanamex', 'banbajio', 'bbva', 'banorte', 'bancoppel', 'hsbc', 'amex', 'santander', 'scotiabank', 'invex', 'banregio', 'spin', 'platacard', 'bancoazteca', 'bienestar'];
    
    if (validBanks.includes(subdomain)) {
      // Agregar información del banco al request
      req.bankFromSubdomain = subdomain.toUpperCase();
      console.log(`[Subdomain] Detectado banco desde subdominio: ${req.bankFromSubdomain} en ${host}`);
    }
  }
  
  next();
});

// Configurar CORS para permitir diferentes dominios y subdominios
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.ADMIN_DOMAIN || 'https://panel.aclaracionbancaria.pro',
    process.env.CLIENT_DOMAIN || 'https://aclaracionbancaria.pro'
  ];

  const origin = req.headers.origin;
  
  // Permitir origen exacto o subdominios de dominios personalizados
  let allowOrigin = false;
  if (origin && allowedOrigins.includes(origin)) {
    allowOrigin = true;
  } else if (origin) {
    try {
      // Verificar si es un subdominio válido (banco.dominio.com)
      const originUrl = new URL(origin);
      const hostParts = originUrl.hostname.split('.');
      if (hostParts.length >= 3) {
        const subdomain = hostParts[0].toLowerCase();
        const validBanks = ['liverpool', 'citibanamex', 'banbajio', 'bbva', 'banorte', 'bancoppel', 'hsbc', 'amex', 'santander', 'scotiabank', 'invex', 'banregio', 'spin', 'platacard', 'bancoazteca', 'bienestar'];
        if (validBanks.includes(subdomain)) {
          allowOrigin = true;
        }
      }
    } catch (error) {
      // Invalid URL, skip CORS check
      console.log(`[CORS] Invalid origin URL: ${origin}`);
    }
  } else {
    // Allow requests without origin (like direct server requests for health checks)
    allowOrigin = true;
  }

  if (allowOrigin && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (allowOrigin && !origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Manejo global de errores con ofuscación
  app.use(errorObfuscation);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000');
  
  // Enhanced server startup with better error handling for deployments
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    log(`Health check available at: http://0.0.0.0:${port}/health`);
    log(`Server ready for deployment connections`);
  });

  // Handle server startup errors
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use`);
      process.exit(1);
    } else {
      console.error('Server error:', error);
      process.exit(1);
    }
  });

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
})().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});