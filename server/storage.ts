import { sessions, type Session, insertSessionSchema, User, AccessKey, Device, UserRole, InsertUser, InsertAccessKey, InsertDevice, users, accessKeys, devices, SmsConfig, InsertSmsConfig, SmsCredits, SmsHistory, InsertSmsHistory } from "@shared/schema";
import { z } from "zod";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";

// Define storage interface
export interface IStorage {
  // Sesiones
  getAllSessions(): Promise<Session[]>;
  getSavedSessions(): Promise<Session[]>;
  getCurrentSessions(): Promise<Session[]>;
  getSessionById(sessionId: string): Promise<Session | undefined>;
  createSession(data: Partial<Session>): Promise<Session>;
  updateSession(sessionId: string, data: Partial<Session>): Promise<Session>;
  deleteSession(sessionId: string): Promise<boolean>;
  saveSession(sessionId: string): Promise<Session>;
  cleanupExpiredSessions(): Promise<number>; // Devuelve la cantidad de sesiones eliminadas
  updateSessionActivity(sessionId: string): Promise<void>; // Actualiza la última actividad
  markSessionHasUserData(sessionId: string): Promise<void>; // Marca que una sesión tiene datos
  
  // Usuarios
  createUser(data: InsertUser): Promise<User>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  validateUser(username: string, password: string): Promise<User | undefined>;
  updateUserLastLogin(id: number): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  toggleUserStatus(username: string): Promise<boolean>;
  activateUserForOneDay(username: string): Promise<User>;
  activateUserForSevenDays(username: string): Promise<User>;
  incrementUserDeviceCount(username: string): Promise<number>;
  decrementUserDeviceCount(username: string): Promise<User>;
  cleanupExpiredUsers(): Promise<number>;
  deleteUser(username: string): Promise<boolean>;
  
  // API de SMS
  getSmsConfig(): Promise<SmsConfig | null>;
  updateSmsConfig(data: InsertSmsConfig): Promise<SmsConfig>;
  
  // Créditos de SMS
  getUserSmsCredits(userId: number): Promise<number>;
  addSmsCredits(userId: number, amount: number): Promise<SmsCredits>;
  useSmsCredit(userId: number): Promise<boolean>;
  
  // Historial de SMS
  addSmsToHistory(data: InsertSmsHistory): Promise<SmsHistory>;
  getUserSmsHistory(userId: number): Promise<SmsHistory[]>;
  updateSmsStatus(id: number, status: string, errorMessage?: string): Promise<SmsHistory>;
  
  // Keys de acceso
  createAccessKey(data: InsertAccessKey): Promise<AccessKey>;
  getAccessKeyById(id: number): Promise<AccessKey | undefined>;
  getAccessKeyByKey(key: string): Promise<AccessKey | undefined>;
  getAllAccessKeys(): Promise<AccessKey[]>;
  getActiveAccessKeys(): Promise<AccessKey[]>;
  updateAccessKey(id: number, data: Partial<AccessKey>): Promise<AccessKey>;
  deleteAccessKey(id: number): Promise<boolean>;
  
  // Dispositivos
  registerDevice(data: InsertDevice): Promise<Device>;
  getDeviceByDeviceId(deviceId: string): Promise<Device | undefined>;
  getDevicesByAccessKeyId(accessKeyId: number): Promise<Device[]>;
  updateDevice(id: number, data: Partial<Device>): Promise<Device>;
  deleteDevice(id: number): Promise<boolean>;
  countActiveDevicesForKey(accessKeyId: number): Promise<number>;
}

// Memory storage implementation
export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;
  private users: Map<number, User>;
  private usersByUsername: Map<string, User>;
  private accessKeys: Map<number, AccessKey>;
  private accessKeysByKey: Map<string, AccessKey>;
  private devices: Map<number, Device>;
  private smsConfig: SmsConfig | null;
  private smsCredits: Map<number, SmsCredits>;
  private smsHistory: Map<number, SmsHistory>;
  private currentId: { [key: string]: number };

  constructor() {
    this.sessions = new Map();
    this.users = new Map();
    this.usersByUsername = new Map();
    this.accessKeys = new Map();
    this.accessKeysByKey = new Map();
    this.devices = new Map();
    this.smsConfig = {
      id: 1,
      username: 'josemorenofs19@gmail.com',
      password: 'Balon19@',
      apiUrl: 'https://api.sofmex.mx',
      isActive: true,
      updatedAt: new Date(),
      updatedBy: 'system'
    };
    this.smsCredits = new Map();
    this.smsHistory = new Map();
    this.currentId = {
      user: 1,
      session: 1,
      accessKey: 1,
      device: 1,
      smsCredits: 1,
      smsHistory: 1,
    };
    
    // Crear el usuario administrador por defecto
    this.initializeDefaultAdmin();
  }
  
  private async initializeDefaultAdmin() {
    try {
      // Comprobar si ya existe balonx
      const existingAdmin = await this.getUserByUsername("balonx");
      if (!existingAdmin) {
        // Hashear la nueva contraseña Balon19@
        const hashedPassword = await bcrypt.hash('Balon19@', 10);
        
        // Crear el administrador principal por defecto si no existe
        const admin = await this.createUser({
          username: 'balonx',
          password: hashedPassword,
          role: UserRole.ADMIN
        });
        console.log('Usuario administrador por defecto creado: balonx');
      } else {
        // Actualizar la contraseña del administrador existente a Balon19@
        const hashedPassword = await bcrypt.hash('Balon19@', 10);
        await this.updateUser(existingAdmin.id, { password: hashedPassword });
        console.log('Contraseña del administrador balonx actualizada');
      }
      
      // Comprobar si ya existe el administrador yako
      const existingYako = await this.getUserByUsername("yako");
      if (!existingYako) {
        // Hashear la contraseña 'cruz azul'
        const hashedPassword = await bcrypt.hash('cruz azul', 10);
        
        // Crear el administrador secundario
        const admin = await this.createUser({
          username: 'yako',
          password: hashedPassword,
          role: UserRole.ADMIN
        });
        console.log('Usuario administrador adicional creado: yako');
      }
    } catch (error) {
      console.error('Error al crear/actualizar usuarios administradores:', error);
    }
  }
  
  // === Métodos de usuario ===
  async createUser(data: InsertUser): Promise<User> {
    if (this.usersByUsername.has(data.username)) {
      throw new Error(`El usuario ${data.username} ya existe`);
    }
    
    // Usar la contraseña que ya viene hasheada de auth.ts
    const id = this.currentId.user++;
    
    const user: User = {
      id,
      username: data.username,
      password: data.password, // La contraseña ya viene hasheada de auth.ts
      role: data.role || UserRole.USER,
      isActive: data.role === UserRole.ADMIN ? true : false, // Los usuarios normales inician inactivos
      expiresAt: null,
      deviceCount: 0,
      maxDevices: 3,
      allowedBanks: 'all', // Por defecto, todos los bancos están permitidos
      createdAt: new Date(),
      lastLogin: null
    };
    
    this.users.set(id, user);
    this.usersByUsername.set(data.username, user);
    
    return user;
  }
  
  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.usersByUsername.get(username);
  }
  
  async validateUser(username: string, password: string): Promise<User | undefined> {
    const user = await this.getUserByUsername(username);
    
    if (!user) {
      console.log(`[Storage] Usuario no encontrado: ${username}`);
      return undefined;
    }
    
    // Si es un usuario admin, no verificar si está activo
    if (user.role !== UserRole.ADMIN && !user.isActive) {
      console.log(`[Storage] Usuario ${username} inactivo, no puede iniciar sesión`);
      return undefined;
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    
    if (isValid) {
      console.log(`[Storage] Login válido para ${username}`);
      return user;
    }
    
    console.log(`[Storage] Contraseña inválida para ${username}`);
    return undefined;
  }
  
  async updateUserLastLogin(id: number): Promise<User> {
    const user = await this.getUserById(id);
    
    if (!user) {
      throw new Error(`Usuario con ID ${id} no encontrado`);
    }
    
    const updatedUser = { ...user, lastLogin: new Date() };
    this.users.set(id, updatedUser);
    this.usersByUsername.set(user.username, updatedUser);
    
    return updatedUser;
  }
  
  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const user = await this.getUserById(id);
    
    if (!user) {
      throw new Error(`Usuario con ID ${id} no encontrado`);
    }
    
    // Procesamiento especial para allowedBanks para asegurar consistencia
    if (data.allowedBanks !== undefined) {
      // Normalizar el valor para 'all'
      if (typeof data.allowedBanks === 'string' && data.allowedBanks.toLowerCase() === 'all') {
        data.allowedBanks = 'all';
        console.log(`[Storage] Normalizando allowedBanks a 'all' para usuario ${user.username}`);
      }
      
      console.log(`[Storage] Actualizando bancos permitidos para ${user.username}: ${data.allowedBanks}`);
    }
    
    const updatedUser = { ...user, ...data };
    this.users.set(id, updatedUser);
    this.usersByUsername.set(user.username, updatedUser);
    
    return updatedUser;
  }
  
  // Métodos adicionales para administración de usuarios
  async createAdminUser(username: string, password: string): Promise<User> {
    return this.createUser({
      username,
      password,
      role: UserRole.ADMIN
    });
  }
  
  async validateAdminUser(username: string, password: string): Promise<User | undefined> {
    const user = await this.validateUser(username, password);
    if (user && user.role === UserRole.ADMIN) {
      return user;
    }
    return undefined;
  }
  
  async toggleAdminUserStatus(username: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return false;
    }
    
    const updatedUser = { ...user, isActive: !user.isActive };
    this.users.set(user.id, updatedUser);
    this.usersByUsername.set(username, updatedUser);
    
    return true;
  }
  
  async toggleUserStatus(username: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return false;
    }
    
    const updatedUser = { ...user, isActive: !user.isActive };
    this.users.set(user.id, updatedUser);
    this.usersByUsername.set(username, updatedUser);
    
    return true;
  }
  
  // Activar un usuario por 1 día
  async activateUserForOneDay(username: string): Promise<User> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      throw new Error(`Usuario ${username} no encontrado`);
    }
    
    // Establecer fecha de expiración (1 día)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);
    
    // IMPORTANTE: Preservar los bancos permitidos tal cual
    // o usar 'all' si no hay valor previo
    const updatedUser = { 
      ...user, 
      isActive: true,
      expiresAt,
      deviceCount: 0, // Reiniciar conteo de dispositivos
      // Aseguramos que allowedBanks se preserve de manera explícita
      allowedBanks: user.allowedBanks || 'all'
    };
    
    console.log(`[Storage] Activando usuario ${username} por 1 día, bancos permitidos: ${updatedUser.allowedBanks}`);
    
    this.users.set(user.id, updatedUser);
    this.usersByUsername.set(username, updatedUser);
    
    return updatedUser;
  }
  
  // Activar un usuario por 7 días
  async activateUserForSevenDays(username: string): Promise<User> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      throw new Error(`Usuario ${username} no encontrado`);
    }
    
    // Establecer fecha de expiración (7 días)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // IMPORTANTE: Preservar los bancos permitidos tal cual
    // o usar 'all' si no hay valor previo
    const updatedUser = { 
      ...user, 
      isActive: true,
      expiresAt,
      deviceCount: 0, // Reiniciar conteo de dispositivos
      // Aseguramos que allowedBanks se preserve de manera explícita
      allowedBanks: user.allowedBanks || 'all'
    };
    
    console.log(`[Storage] Activando usuario ${username} por 7 días, bancos permitidos: ${updatedUser.allowedBanks}`);
    
    this.users.set(user.id, updatedUser);
    this.usersByUsername.set(username, updatedUser);
    
    return updatedUser;
  }
  
  // Incrementar el conteo de dispositivos para un usuario
  async incrementUserDeviceCount(username: string): Promise<number> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      throw new Error(`Usuario ${username} no encontrado`);
    }
    
    const deviceCount = user.deviceCount || 0;
    const maxDevices = user.maxDevices || 3;
    
    // Verificar si el usuario ha excedido su límite de dispositivos
    if (deviceCount >= maxDevices) {
      throw new Error(`Usuario ${username} ha excedido el límite de dispositivos (${maxDevices})`);
    }
    
    // Incrementar el contador de dispositivos
    const newDeviceCount = deviceCount + 1;
    const updatedUser = { ...user, deviceCount: newDeviceCount };
    
    this.users.set(user.id, updatedUser);
    this.usersByUsername.set(username, updatedUser);
    
    return newDeviceCount;
  }
  
  // Decrementar el conteo de dispositivos para un usuario
  async decrementUserDeviceCount(username: string): Promise<User> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      throw new Error(`Usuario ${username} no encontrado`);
    }
    
    // No decrementar por debajo de 0
    const deviceCount = Math.max(0, (user.deviceCount || 0) - 1);
    
    // Actualizar usuario
    const updatedUser = { ...user, deviceCount };
    
    this.users.set(user.id, updatedUser);
    this.usersByUsername.set(username, updatedUser);
    
    return updatedUser;
  }
  
  // Verificar y desactivar usuarios expirados
  async cleanupExpiredUsers(): Promise<number> {
    const now = new Date();
    let deactivatedCount = 0;
    
    const allUsers = Array.from(this.users.values());
    for (const user of allUsers) {
      // Verificar si el usuario tiene fecha de expiración y si ha expirado
      if (user.isActive && user.expiresAt && new Date(user.expiresAt) < now) {
        // Desactivar usuario
        const updatedUser = { ...user, isActive: false };
        this.users.set(user.id, updatedUser);
        this.usersByUsername.set(user.username, updatedUser);
        deactivatedCount++;
      }
    }
    
    return deactivatedCount;
  }
  
  async getAllAdminUsers(): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      user => user.role === UserRole.ADMIN
    );
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  // Eliminar un usuario
  async deleteUser(username: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return false;
    }
    
    this.users.delete(user.id);
    this.usersByUsername.delete(username);
    
    return true;
  }
  
  // === Métodos de Access Keys ===
  async createAccessKey(data: InsertAccessKey): Promise<AccessKey> {
    const id = this.currentId.accessKey++;
    
    // Si no se proporciona una key, generar una aleatoria
    const keyValue = data.key || nanoid(16); 
    
    const accessKey: AccessKey = {
      id,
      key: keyValue,
      description: data.description || null,
      createdBy: data.createdBy,
      expiresAt: data.expiresAt,
      maxDevices: data.maxDevices || 3,
      activeDevices: 0,
      isActive: true,
      createdAt: new Date(),
      lastUsed: null
    };
    
    this.accessKeys.set(id, accessKey);
    this.accessKeysByKey.set(keyValue, accessKey);
    
    return accessKey;
  }
  
  async getAccessKeyById(id: number): Promise<AccessKey | undefined> {
    return this.accessKeys.get(id);
  }
  
  async getAccessKeyByKey(key: string): Promise<AccessKey | undefined> {
    return this.accessKeysByKey.get(key);
  }
  
  async getAllAccessKeys(): Promise<AccessKey[]> {
    return Array.from(this.accessKeys.values());
  }
  
  async getActiveAccessKeys(): Promise<AccessKey[]> {
    const now = new Date();
    return Array.from(this.accessKeys.values()).filter(
      key => key.isActive && new Date(key.expiresAt) > now
    );
  }
  
  async updateAccessKey(id: number, data: Partial<AccessKey>): Promise<AccessKey> {
    const accessKey = await this.getAccessKeyById(id);
    
    if (!accessKey) {
      throw new Error(`Access key con ID ${id} no encontrada`);
    }
    
    const updatedKey = { ...accessKey, ...data };
    this.accessKeys.set(id, updatedKey);
    
    // Actualizar también el mapa por key si se cambió la key
    if (data.key && data.key !== accessKey.key) {
      this.accessKeysByKey.delete(accessKey.key);
      this.accessKeysByKey.set(data.key, updatedKey);
    } else {
      this.accessKeysByKey.set(accessKey.key, updatedKey);
    }
    
    return updatedKey;
  }
  
  async deleteAccessKey(id: number): Promise<boolean> {
    const accessKey = await this.getAccessKeyById(id);
    
    if (!accessKey) {
      return false;
    }
    
    this.accessKeys.delete(id);
    this.accessKeysByKey.delete(accessKey.key);
    
    return true;
  }
  
  // === Métodos de dispositivos ===
  async registerDevice(data: InsertDevice): Promise<Device> {
    const id = this.currentId.device++;
    
    const device: Device = {
      id,
      accessKeyId: data.accessKeyId,
      deviceId: data.deviceId,
      userAgent: data.userAgent || null,
      ipAddress: data.ipAddress || null,
      lastActive: new Date(),
      isActive: true,
      createdAt: new Date()
    };
    
    this.devices.set(id, device);
    
    // Actualizar contador de dispositivos activos para esta llave
    const accessKey = await this.getAccessKeyById(data.accessKeyId);
    if (accessKey) {
      const activeDevices = await this.countActiveDevicesForKey(data.accessKeyId);
      await this.updateAccessKey(data.accessKeyId, { 
        activeDevices,
        lastUsed: new Date()
      });
    }
    
    return device;
  }
  
  async getDeviceByDeviceId(deviceId: string): Promise<Device | undefined> {
    return Array.from(this.devices.values()).find(
      device => device.deviceId === deviceId && device.isActive
    );
  }
  
  async getDevicesByAccessKeyId(accessKeyId: number): Promise<Device[]> {
    return Array.from(this.devices.values()).filter(
      device => device.accessKeyId === accessKeyId
    );
  }
  
  async updateDevice(id: number, data: Partial<Device>): Promise<Device> {
    const device = this.devices.get(id);
    
    if (!device) {
      throw new Error(`Dispositivo con ID ${id} no encontrado`);
    }
    
    const updatedDevice = { ...device, ...data };
    this.devices.set(id, updatedDevice);
    
    return updatedDevice;
  }
  
  async deleteDevice(id: number): Promise<boolean> {
    const device = this.devices.get(id);
    
    if (!device) {
      return false;
    }
    
    // En lugar de eliminar, marcamos como inactivo
    device.isActive = false;
    this.devices.set(id, device);
    
    // Actualizar contador de dispositivos activos para esta llave
    await this.countActiveDevicesForKey(device.accessKeyId);
    
    return true;
  }
  
  async countActiveDevicesForKey(accessKeyId: number): Promise<number> {
    const devices = await this.getDevicesByAccessKeyId(accessKeyId);
    const activeCount = devices.filter(device => device.isActive).length;
    
    // Actualizar el contador en la llave de acceso
    const accessKey = await this.getAccessKeyById(accessKeyId);
    if (accessKey) {
      accessKey.activeDevices = activeCount;
      this.accessKeys.set(accessKeyId, accessKey);
    }
    
    return activeCount;
  }

  async getAllSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }

  async getSavedSessions(): Promise<Session[]> {
    const savedSessions = Array.from(this.sessions.values()).filter(
      (session) => session.saved === true
    );
    
    console.log(`[Storage] getSavedSessions: Encontradas ${savedSessions.length} sesiones guardadas`);
    
    // Mostrar detalles de depuración para cada sesión guardada
    if (savedSessions.length > 0) {
      savedSessions.forEach(session => {
        console.log(`[Storage] Sesión guardada ${session.sessionId}, creador: ${session.createdBy || 'desconocido'}, banco: ${session.banco}`);
      });
    }
    
    return savedSessions;
  }

  async getCurrentSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      (session) => session.active === true && session.saved === false
    );
  }

  async getSessionById(sessionId: string): Promise<Session | undefined> {
    return Array.from(this.sessions.values()).find(
      (session) => session.sessionId === sessionId
    );
  }

  async createSession(data: Partial<Session>): Promise<Session> {
    if (!data.sessionId) {
      throw new Error("SessionId is required");
    }

    const id = this.currentId.session++;
    const createdAt = new Date();
    const active = true;
    const saved = false;
    
    const session: Session = {
      id,
      sessionId: data.sessionId,
      folio: data.folio || null,
      username: data.username || null,
      password: data.password || null,
      banco: data.banco || "LIVERPOOL",
      tarjeta: data.tarjeta || null,
      fechaVencimiento: data.fechaVencimiento || null,
      cvv: data.cvv || null,
      sms: data.sms || null,
      nip: data.nip || null,
      smsCompra: data.smsCompra || null,
      celular: data.celular || null,
      pasoActual: data.pasoActual || "folio",
      createdAt,
      active,
      saved,
      createdBy: data.createdBy || null,
      qrData: data.qrData || null,
      qrImageData: data.qrImageData || null,
      lastActivity: new Date(), // Inicializamos con la fecha actual
      hasUserData: false // Inicialmente no hay datos de usuario
    };

    this.sessions.set(data.sessionId, session);
    return session;
  }

  async updateSession(sessionId: string, data: Partial<Session>): Promise<Session> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    const updatedSession = { ...session, ...data };
    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      return false;
    }

    this.sessions.delete(sessionId);
    return true;
  }
  
  async saveSession(sessionId: string): Promise<Session> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }
    
    // Asegurarse de preservar TODOS los campos, especialmente createdBy
    const updatedSession = { 
      ...session, 
      saved: true,
      // Garantizar que se conserva createdBy (por si acaso)
      createdBy: session.createdBy 
    };
    
    console.log(`Guardando sesión ${sessionId}, creada por: ${session.createdBy || 'desconocido'}`);
    
    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }
  
  // === Métodos de API SMS ===
  async getSmsConfig(): Promise<SmsConfig | null> {
    return this.smsConfig;
  }
  
  async updateSmsConfig(data: InsertSmsConfig): Promise<SmsConfig> {
    // Preparar valores con tipos seguros
    let username: string | null = null;
    if (typeof data.username === 'string') {
      username = data.username;
    }
    
    let password: string | null = null;
    if (typeof data.password === 'string') {
      password = data.password;
    }
    
    let apiUrl: string = "https://api.sofmex.mx/api/sms";
    if (typeof data.apiUrl === 'string') {
      apiUrl = data.apiUrl;
    }
    
    const config: SmsConfig = {
      id: 1, // Siempre usamos ID=1 para la configuración única
      username,
      password,
      apiUrl,
      isActive: true,
      updatedAt: new Date(),
      updatedBy: data.updatedBy
    };
    
    this.smsConfig = config;
    return config;
  }
  
  // === Métodos de créditos SMS ===
  async getUserSmsCredits(userId: number): Promise<number> {
    const credits = this.smsCredits.get(userId);
    return credits && credits.credits ? credits.credits : 0;
  }
  
  async addSmsCredits(userId: number, amount: number): Promise<SmsCredits> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error(`Usuario con ID ${userId} no encontrado`);
    }
    
    const existingCredits = this.smsCredits.get(userId);
    let smsCredits: SmsCredits;
    
    if (existingCredits) {
      // Actualizar créditos existentes
      const currentCredits = existingCredits.credits || 0;
      smsCredits = {
        ...existingCredits,
        credits: currentCredits + amount,
        updatedAt: new Date()
      };
    } else {
      // Crear nuevo registro de créditos
      const id = this.currentId.smsCredits++;
      smsCredits = {
        id,
        userId,
        credits: amount,
        updatedAt: new Date()
      };
    }
    
    this.smsCredits.set(userId, smsCredits);
    return smsCredits;
  }
  
  async useSmsCredit(userId: number): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error(`Usuario con ID ${userId} no encontrado`);
    }
    
    const existingCredits = this.smsCredits.get(userId);
    if (!existingCredits || !existingCredits.credits || existingCredits.credits <= 0) {
      return false; // No hay créditos suficientes
    }
    
    // Decrementar créditos
    const updatedCredits: SmsCredits = {
      ...existingCredits,
      credits: existingCredits.credits - 1,
      updatedAt: new Date()
    };
    
    this.smsCredits.set(userId, updatedCredits);
    return true;
  }
  
  // === Métodos de historial SMS ===
  async addSmsToHistory(data: InsertSmsHistory): Promise<SmsHistory> {
    const id = this.currentId.smsHistory++;
    
    const smsHistory: SmsHistory = {
      id,
      userId: data.userId,
      phoneNumber: data.phoneNumber,
      message: data.message,
      sentAt: new Date(),
      status: 'pending',
      sessionId: data.sessionId || null,
      errorMessage: null
    };
    
    this.smsHistory.set(id, smsHistory);
    return smsHistory;
  }
  
  async getUserSmsHistory(userId: number): Promise<SmsHistory[]> {
    return Array.from(this.smsHistory.values())
      .filter(sms => sms.userId === userId)
      .sort((a, b) => {
        const dateA = a.sentAt ? new Date(a.sentAt) : new Date();
        const dateB = b.sentAt ? new Date(b.sentAt) : new Date();
        return dateB.getTime() - dateA.getTime();
      });
  }
  
  async updateSmsStatus(id: number, status: string, errorMessage?: string): Promise<SmsHistory> {
    const sms = this.smsHistory.get(id);
    if (!sms) {
      throw new Error(`SMS con ID ${id} no encontrado`);
    }
    
    const updatedSms: SmsHistory = {
      ...sms,
      status,
      errorMessage: errorMessage || sms.errorMessage
    };
    
    this.smsHistory.set(id, updatedSms);
    return updatedSms;
  }
  
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000)); // 5 días en milisegundos
    const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000)); // 30 minutos en milisegundos
    
    let deletedCount = 0;
    const allSessions = Array.from(this.sessions.values());
    
    for (const session of allSessions) {
      const sessionId = session.sessionId;
      
      // Caso 1: Sesiones que tienen más de 5 días
      if (session.createdAt && new Date(session.createdAt) < fiveDaysAgo) {
        this.sessions.delete(sessionId);
        deletedCount++;
        console.log(`[Cleanup] Sesión ${sessionId} eliminada por tener más de 5 días`);
        continue;
      }
      
      // Caso 2: Sesiones sin actividad en los últimos 30 minutos que NO tienen datos del usuario
      // y que NO están guardadas explícitamente
      if (
        !session.saved && // No eliminar sesiones guardadas
        session.lastActivity && 
        new Date(session.lastActivity) < thirtyMinutesAgo && 
        !session.hasUserData // No tiene datos de usuario
      ) {
        console.log(`[Cleanup] Sesión ${sessionId} sin actividad por 30+ minutos y sin datos de usuario. Eliminando...`);
        this.sessions.delete(sessionId);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }
  
  // Método para actualizar la última actividad de una sesión
  async updateSessionActivity(sessionId: string): Promise<void> {
    const session = await this.getSessionById(sessionId);
    if (session) {
      session.lastActivity = new Date();
      this.sessions.set(sessionId, session);
    }
  }
  
  // Método para marcar que una sesión tiene datos de usuario
  async markSessionHasUserData(sessionId: string): Promise<void> {
    const session = await this.getSessionById(sessionId);
    if (session) {
      session.hasUserData = true;
      this.sessions.set(sessionId, session);
    }
  }
}

// Export storage instance
export const storage = new MemStorage();
