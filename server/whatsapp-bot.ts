import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason,
  WASocket,
  proto,
  WAMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { IStorage } from './storage';

interface WhatsAppBotConfig {
  userId: number;
  storage: IStorage;
  onQRUpdate?: (qr: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export class WhatsAppBot {
  private sock: WASocket | null = null;
  private config: WhatsAppBotConfig;
  private authFolder: string;
  private menuState: Map<string, { waitingForInput: boolean; lastMessageTime: number }> = new Map();

  constructor(config: WhatsAppBotConfig) {
    this.config = config;
    this.authFolder = path.join(process.cwd(), 'whatsapp_sessions', `user_${config.userId}`);
    
    // Crear carpeta de sesiones si no existe
    if (!fs.existsSync(path.join(process.cwd(), 'whatsapp_sessions'))) {
      fs.mkdirSync(path.join(process.cwd(), 'whatsapp_sessions'));
    }
  }

  async start() {
    try {
      console.log(`[WhatsApp Bot] Iniciando bot para usuario ${this.config.userId}`);
      
      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
      
      this.sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['CRM Jay', 'Chrome', '1.0.0'],
        markOnlineOnConnect: false
      });

      // Guardar credenciales cuando se actualicen
      this.sock.ev.on('creds.update', saveCreds);

      // Manejar actualizaciones de conexión
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          console.log(`[WhatsApp Bot] QR generado para usuario ${this.config.userId}`);
          const qrDataUrl = await QRCode.toDataURL(qr);
          
          // Actualizar QR en la base de datos
          await this.updateQRCode(qrDataUrl);
          
          if (this.config.onQRUpdate) {
            this.config.onQRUpdate(qrDataUrl);
          }
        }
        
        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          
          console.log(`[WhatsApp Bot] Conexión cerrada para usuario ${this.config.userId}, reconectar: ${shouldReconnect}`);
          
          if (shouldReconnect) {
            await this.start();
          } else {
            await this.updateConnectionStatus(false);
            if (this.config.onDisconnected) {
              this.config.onDisconnected();
            }
          }
        } else if (connection === 'open') {
          console.log(`[WhatsApp Bot] Conectado exitosamente para usuario ${this.config.userId}`);
          
          const phoneNumber = this.sock?.user?.id?.split(':')[0] || '';
          await this.updateConnectionStatus(true, phoneNumber);
          
          if (this.config.onConnected) {
            this.config.onConnected();
          }
        }
      });

      // Manejar mensajes entrantes
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        for (const msg of messages) {
          await this.handleIncomingMessage(msg);
        }
      });

    } catch (error) {
      console.error(`[WhatsApp Bot] Error al iniciar bot para usuario ${this.config.userId}:`, error);
      throw error;
    }
  }

  async stop() {
    if (this.sock) {
      console.log(`[WhatsApp Bot] Deteniendo bot para usuario ${this.config.userId}`);
      await this.sock.logout();
      this.sock = null;
      await this.updateConnectionStatus(false);
    }
  }

  async sendMessage(phoneNumber: string, message: string) {
    if (!this.sock) {
      throw new Error('Bot no está conectado');
    }

    // Formatear número para WhatsApp
    let jid: string;
    if (phoneNumber.includes('@')) {
      jid = phoneNumber;
    } else {
      // Limpiar el número (eliminar espacios, guiones, paréntesis)
      let cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
      
      // Si el número tiene 10 dígitos y no empieza con código de país, agregar 52 (México)
      if (cleanNumber.length === 10 && !cleanNumber.startsWith('52')) {
        cleanNumber = '52' + cleanNumber;
      }
      // Si empieza con + y tiene 52, quitar el +
      else if (cleanNumber.startsWith('+52')) {
        cleanNumber = cleanNumber.substring(1);
      }
      // Si solo tiene el +, quitarlo
      else if (cleanNumber.startsWith('+')) {
        cleanNumber = cleanNumber.substring(1);
      }
      
      jid = `${cleanNumber}@s.whatsapp.net`;
    }
    
    console.log(`[WhatsApp Bot] Enviando mensaje a ${jid}`);
    await this.sock.sendMessage(jid, { text: message });
    
    // Guardar en historial
    await this.saveConversation(phoneNumber, message, true);
  }

  private async handleIncomingMessage(msg: WAMessage) {
    try {
      // Ignorar mensajes propios
      if (msg.key.fromMe) return;
      
      // Ignorar mensajes sin contenido
      if (!msg.message) return;

      const sender = msg.key.remoteJid || '';
      const phoneNumber = sender.split('@')[0];
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      
      console.log(`[WhatsApp Bot] Mensaje recibido de ${phoneNumber}: ${text}`);

      // Guardar mensaje en historial
      await this.saveConversation(phoneNumber, text, false);

      // Verificar si el usuario está esperando una respuesta de menú
      const userState = this.menuState.get(phoneNumber);
      const currentTime = Date.now();

      // Si es un número (1-9), procesarlo como opción de menú
      if (text.trim().match(/^[1-9]$/)) {
        const optionNumber = parseInt(text.trim());
        await this.processMenuOption(phoneNumber, optionNumber);
        
        // Actualizar estado del usuario
        this.menuState.set(phoneNumber, { waitingForInput: false, lastMessageTime: currentTime });
        return;
      }

      // Si no hay estado o han pasado más de 5 minutos, enviar menú de bienvenida
      if (!userState || (currentTime - userState.lastMessageTime) > 300000) {
        await this.sendWelcomeMenu(phoneNumber);
        this.menuState.set(phoneNumber, { waitingForInput: true, lastMessageTime: currentTime });
      }

    } catch (error) {
      console.error(`[WhatsApp Bot] Error al manejar mensaje:`, error);
    }
  }

  private async sendWelcomeMenu(phoneNumber: string) {
    try {
      // Obtener configuración del menú desde la base de datos
      const config = await this.getWhatsAppConfig();
      const menuOptions = await this.getMenuOptions();

      let menuText = config?.welcomeMessage || '¡Hola! Bienvenido a nuestro CRM. Por favor selecciona una opción:';
      menuText += '\n\n';

      // Agregar opciones
      for (const option of menuOptions) {
        if (option.isActive) {
          menuText += `${option.optionNumber}. ${option.optionText}\n`;
        }
      }

      await this.sendMessage(phoneNumber, menuText);
    } catch (error) {
      console.error(`[WhatsApp Bot] Error al enviar menú de bienvenida:`, error);
    }
  }

  private async processMenuOption(phoneNumber: string, optionNumber: number) {
    try {
      const menuOptions = await this.getMenuOptions();
      const selectedOption = menuOptions.find(opt => opt.optionNumber === optionNumber && opt.isActive);

      if (!selectedOption) {
        await this.sendMessage(phoneNumber, 'Opción no válida. Por favor selecciona una opción del menú.');
        await this.sendWelcomeMenu(phoneNumber);
        return;
      }

      // Procesar según el tipo de acción
      switch (selectedOption.actionType) {
        case 'message':
          if (selectedOption.responseMessage) {
            await this.sendMessage(phoneNumber, selectedOption.responseMessage);
          }
          break;
          
        case 'transfer':
          await this.sendMessage(phoneNumber, 'Un ejecutivo se pondrá en contacto contigo pronto.');
          // Aquí podrías notificar al ejecutivo por Telegram
          console.log(`[WhatsApp Bot] Transferencia solicitada por ${phoneNumber}`);
          break;
          
        case 'info':
          if (selectedOption.responseMessage) {
            await this.sendMessage(phoneNumber, selectedOption.responseMessage);
          }
          // Volver a mostrar el menú después de dar la información
          setTimeout(() => this.sendWelcomeMenu(phoneNumber), 2000);
          break;
      }

    } catch (error) {
      console.error(`[WhatsApp Bot] Error al procesar opción de menú:`, error);
    }
  }

  public isConnected(): boolean {
    return this.sock !== null && this.sock.user !== undefined;
  }

  private async updateQRCode(qrCode: string) {
    try {
      await this.config.storage.updateWhatsAppConfig(this.config.userId, {
        qrCode,
        isConnected: false
      });
      console.log(`[WhatsApp Bot] QR actualizado para usuario ${this.config.userId}`);
    } catch (error) {
      console.error(`[WhatsApp Bot] Error actualizando QR:`, error);
    }
  }

  private async updateConnectionStatus(isConnected: boolean, phoneNumber?: string) {
    try {
      await this.config.storage.updateWhatsAppConfig(this.config.userId, {
        isConnected,
        phoneNumber: phoneNumber || '',
        qrCode: isConnected ? null : undefined
      });
      console.log(`[WhatsApp Bot] Estado de conexión para usuario ${this.config.userId}: ${isConnected ? 'conectado' : 'desconectado'}`);
    } catch (error) {
      console.error(`[WhatsApp Bot] Error actualizando estado de conexión:`, error);
    }
  }

  private async saveConversation(phoneNumber: string, message: string, isFromBot: boolean) {
    try {
      await this.config.storage.saveWhatsAppConversation({
        userId: this.config.userId,
        phoneNumber,
        message,
        isFromBot
      });
      console.log(`[WhatsApp Bot] Guardando mensaje: ${isFromBot ? 'Bot' : phoneNumber} -> ${message}`);
    } catch (error) {
      console.error(`[WhatsApp Bot] Error guardando conversación:`, error);
    }
  }

  private async getWhatsAppConfig() {
    try {
      return await this.config.storage.getWhatsAppConfig(this.config.userId);
    } catch (error) {
      console.error(`[WhatsApp Bot] Error obteniendo configuración:`, error);
      return null;
    }
  }

  private async getMenuOptions() {
    try {
      return await this.config.storage.getWhatsAppMenuOptions(this.config.userId);
    } catch (error) {
      console.error(`[WhatsApp Bot] Error obteniendo opciones de menú:`, error);
      return [];
    }
  }
}

// Singleton para manejar múltiples bots (uno por usuario)
class WhatsAppBotManager {
  private bots: Map<number, WhatsAppBot> = new Map();

  async startBot(userId: number, storage: IStorage, callbacks?: {
    onQRUpdate?: (qr: string) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
  }) {
    // Si ya existe un bot para este usuario, detenerlo primero
    if (this.bots.has(userId)) {
      await this.stopBot(userId);
    }

    const bot = new WhatsAppBot({
      userId,
      storage,
      ...callbacks
    });

    await bot.start();
    this.bots.set(userId, bot);
    
    return bot;
  }

  async stopBot(userId: number) {
    const bot = this.bots.get(userId);
    if (bot) {
      await bot.stop();
      this.bots.delete(userId);
    }
  }

  getBot(userId: number): WhatsAppBot | undefined {
    return this.bots.get(userId);
  }

  async stopAllBots() {
    const entries = Array.from(this.bots.entries());
    for (const [userId, bot] of entries) {
      await bot.stop();
    }
    this.bots.clear();
  }
}

export const whatsappBotManager = new WhatsAppBotManager();
