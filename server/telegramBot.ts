import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import { storage } from './storage';
import { User, VerificationCode } from '@shared/schema';
import { getMXNBalance } from './bitsoService';

// Token del bot y chat ID del administrador desde variables de entorno
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!TELEGRAM_TOKEN || !ADMIN_CHAT_ID) {
  throw new Error('TELEGRAM_TOKEN y ADMIN_CHAT_ID deben estar configurados en las variables de entorno');
}

// Variable global para controlar instancia única del bot
let botInstance: TelegramBot | null = null;
let isShuttingDown = false;

// Función para detener el bot de forma segura
async function stopBot() {
  if (botInstance && !isShuttingDown) {
    isShuttingDown = true;
    try {
      console.log('🛑 Deteniendo bot de Telegram...');
      await botInstance.stopPolling();
      botInstance.removeAllListeners();
      botInstance = null;
      console.log('✅ Bot detenido correctamente');
    } catch (error) {
      console.log('⚠️ Error al detener bot (continuando)');
    } finally {
      isShuttingDown = false;
    }
  }
}

// Función para limpiar instancias previas del bot
async function cleanupPreviousBotInstances() {
  try {
    // Detener instancia actual si existe
    await stopBot();
    
    // Eliminar webhook y cancelar polling previo
    await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook?drop_pending_updates=true`);
    console.log('🧹 Limpieza de webhooks previos completada');
    
    // Esperar más tiempo para asegurar que polling anterior termine
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (error) {
    console.log('⚠️ Error al limpiar configuraciones previas (continuando)');
  }
}

// Crear instancia del bot con polling
let bot: TelegramBot;

// Limpiar instancias previas antes de iniciar
await cleanupPreviousBotInstances();

try {
  bot = new TelegramBot(TELEGRAM_TOKEN, { 
    polling: {
      interval: 1000,
      autoStart: true,
      params: {
        timeout: 10
      }
    }
  });
  botInstance = bot;
  console.log('🤖 Bot de Telegram iniciado correctamente (modo polling limpio)');
} catch (error) {
  console.error('❌ Error iniciando bot de Telegram:', error);
  throw error;
}

// Handlers para shutdown graceful
process.on('SIGINT', async () => {
  console.log('\n🔄 SIGINT recibido, cerrando bot...');
  await stopBot();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 SIGTERM recibido, cerrando bot...');
  await stopBot();
  process.exit(0);
});

// Sistema de estados de conversación para el flujo de pagos
interface PaymentSession {
  chatId: string;
  state: 'awaiting_screenshot' | 'awaiting_amount';
  screenshotFileId?: string;
  amount?: string;
  userId?: number;
  expectedAmount?: string;
}

const paymentSessions = new Map<string, PaymentSession>();

// Sistema de estados para crear códigos de descuento
interface DiscountSession {
  chatId: string;
  state: 'awaiting_amount';
}

const discountSessions = new Map<string, DiscountSession>();

// Mensaje de bienvenida
const WELCOME_MESSAGE = `
🎉 *¡Bienvenido a nuestro panel!*

Gracias por utilizar nuestro sistema de aclaraciones bancarias.

📝 *Para poder registrarte:*
1. Ingresa a: Balonx.pro/balonx
2. Presiona en "Registrarte"
3. Ingresa un usuario, una contraseña y tu Chat ID

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

// Función para generar código de referencia único para pagos (8 caracteres alfanuméricos)
export function generatePaymentReferenceCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin caracteres confusos (I, 1, O, 0)
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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
    if (ADMIN_CHAT_ID) {
      await bot.sendMessage(ADMIN_CHAT_ID, adminMessage, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true 
      });
    }

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

// Función para enviar OTP de ejecutivo a la oficina
export async function sendExecutiveOtp(officeChatId: string, executiveUsername: string, executiveDisplayName: string, otpCode: string): Promise<void> {
  try {
    const message = `👔 *Login de Ejecutivo - Código OTP*

El ejecutivo *${executiveDisplayName}* (${executiveUsername}) está intentando iniciar sesión.

Código OTP:
\`${otpCode}\`

⏰ Este código expira en 5 minutos.
🔒 Comparte este código solo con tu ejecutivo.`;

    await bot.sendMessage(officeChatId, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });

    console.log(`✅ OTP de ejecutivo enviado a oficina (ChatID: ${officeChatId}): ${otpCode}`);

  } catch (error: any) {
    console.error('❌ Error enviando OTP de ejecutivo:', error);
    throw error;
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
  telegramChatId: string | null;
  expiresAt?: Date | null;
  allowedBanks?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userData.telegramChatId) {
      return { success: false, error: "No se encontró Chat ID del usuario" };
    }

    // Determinar duración (1 día o 7 días)
    const duration = userData.expiresAt ? 
      (new Date(userData.expiresAt).getTime() - Date.now() > 2 * 24 * 60 * 60 * 1000 ? '7 días' : '1 día') 
      : 'permanente';

    // Determinar bancos
    const banksText = userData.allowedBanks === 'all' 
      ? 'todos los bancos' 
      : `los bancos seleccionados (${userData.allowedBanks?.split(',').join(', ')})`;

    // Mensaje de bienvenida cuando el administrador activa la cuenta
    const message = `🎉 *¡Tu cuenta ha sido activada!*

¡Bienvenido *${userData.username}*!

✅ Tu cuenta fue activada para ${banksText} por ${duration}.

🔐 Ya puedes ingresar a tu panel y utilizar todos los servicios disponibles.

📱 *Acceso*: Balonx.pro/balonx
📞 *Soporte*: @BalonxSistema

¡Gracias por usar nuestros servicios!`;

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

    if (ADMIN_CHAT_ID) {
      await bot.sendMessage(ADMIN_CHAT_ID, message, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true 
      });
    }

    console.log(`✅ Notificación de sesión enviada: ${sessionData.sessionId}`);
  } catch (error: any) {
    console.error('❌ Error enviando notificación de sesión:', error);
  }
}

// Manejar comandos del bot
const setupBotCommands = () => {
  if (!bot) return;
  
  // Comando /pago para verificar pagos
  bot.onText(/\/pago/, async (msg) => {
    const chatId = msg.chat.id.toString();
    console.log(`💰 Comando /pago recibido de chat ID: ${chatId}`);
    
    try {
      // Buscar usuario por chat ID
      const users = await storage.getAllUsers();
      const user = users.find(u => u.telegramChatId === chatId);
      
      if (!user) {
        await bot.sendMessage(chatId, `❌ No se encontró un usuario asociado a este Chat ID.

Por favor, registra tu cuenta primero en Balonx.pro/balonx`, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true 
        });
        return;
      }

      // Obtener el precio que debe pagar el usuario según tipo de cuenta
      const systemConfig = await storage.getSystemConfig();
      const isOffice = user.accountType === 'office';
      const basePrice = isOffice ? '6000' : (systemConfig?.subscriptionPrice || '3000');
      const expectedAmount = user.customPrice || basePrice;
      
      // Verificar si ya existe un pago reciente en Bitso
      const { verifyPayment } = await import('./bitsoService');
      const existingPayment = await verifyPayment(expectedAmount);
      
      if (existingPayment) {
        await bot.sendMessage(chatId, `✅ *¡Pago Confirmado!*

Tu depósito de *$${existingPayment.amount} MXN* ya fue verificado exitosamente.

Tu cuenta está activa. Si necesitas renovar, contacta con @BalonxSistema`, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true 
        });
        return;
      }

      // Obtener cuenta de depósito
      const BITSO_RECEIVING_ACCOUNT = process.env.BITSO_RECEIVING_ACCOUNT || '';
      
      // Crear sesión de pago
      paymentSessions.set(chatId, {
        chatId,
        state: 'awaiting_screenshot',
        userId: user.id,
        expectedAmount
      });

      const accountTypeInfo = isOffice 
        ? `\n\n🏢 *Cuenta de Oficina:*
• Gestiona hasta 8 ejecutivos
• Cada ejecutivo con acceso independiente
• Visibilidad completa de todas las sesiones` 
        : '';

      const message = `💳 *Instrucciones de Pago*

Hola *${user.username}*,

Para activar o renovar tu cuenta por 7 días:${accountTypeInfo}

💰 *Monto a depositar:* $${expectedAmount} MXN

📱 *Instrucciones:*
1️⃣ Abre tu app bancaria
2️⃣ Deposita exactamente *$${expectedAmount} MXN*
3️⃣ Usa la siguiente cuenta receptora:
   \`${BITSO_RECEIVING_ACCOUNT}\`

⏱️ *Verificación Automática:*
• Envía tu captura de pantalla del pago
• El sistema verificará tu pago con Bitso cada 2 minutos
• Recibirás confirmación automática (puede tomar hasta 30 min)
• Si no se verifica, el admin revisará manualmente

📸 *Siguiente paso:*
Envía la captura de pantalla de tu transferencia

Para cancelar este proceso, envía /cancelar`;

      await bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true 
      });

    } catch (error: any) {
      console.error('❌ Error en comando /pago:', error);
      await bot.sendMessage(chatId, '❌ Ocurrió un error al procesar tu solicitud. Intenta nuevamente.', { 
        parse_mode: 'Markdown' 
      });
    }
  });

  // Comando /cancelar para cancelar proceso de pago
  bot.onText(/\/cancelar/, async (msg) => {
    const chatId = msg.chat.id.toString();
    
    if (paymentSessions.has(chatId)) {
      paymentSessions.delete(chatId);
      await bot.sendMessage(chatId, '❌ Proceso de pago cancelado.', { 
        parse_mode: 'Markdown' 
      });
    } else if (discountSessions.has(chatId)) {
      discountSessions.delete(chatId);
      await bot.sendMessage(chatId, '❌ Creación de código de descuento cancelada.', { 
        parse_mode: 'Markdown' 
      });
    } else {
      await bot.sendMessage(chatId, 'ℹ️ No hay ningún proceso activo.', { 
        parse_mode: 'Markdown' 
      });
    }
  });

  // Comando /descuento para crear códigos de descuento (solo admin)
  bot.onText(/\/descuento/, async (msg) => {
    const chatId = msg.chat.id.toString();
    console.log(`💰 Comando /descuento recibido de chat ID: ${chatId}`);
    
    try {
      // Verificar que sea el administrador
      if (chatId !== ADMIN_CHAT_ID) {
        await bot.sendMessage(chatId, '❌ Este comando es solo para administradores.', { 
          parse_mode: 'Markdown' 
        });
        return;
      }

      // Crear sesión de descuento
      discountSessions.set(chatId, {
        chatId,
        state: 'awaiting_amount'
      });

      const message = `🎫 *Crear Código de Descuento*

¿Qué descuento deseas crear?

Por ejemplo: *500* (para $500 MXN de descuento)

El sistema generará un código único de un solo uso.

Para cancelar, envía /cancelar`;

      await bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true 
      });

    } catch (error: any) {
      console.error('❌ Error en comando /descuento:', error);
      await bot.sendMessage(chatId, '❌ Ocurrió un error al procesar tu solicitud. Intenta nuevamente.', { 
        parse_mode: 'Markdown' 
      });
    }
  });
  
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const userName = msg.from?.first_name || 'Usuario';
    console.log(`👋 Comando /start recibido de chat ID: ${chatId}`);
    
    try {
      // Verificar si ya existe un usuario con este Chat ID
      const users = await storage.getAllUsers();
      const existingUser = users.find(user => user.telegramChatId === chatId);
      
      if (existingUser) {
        // Usuario ya configurado
        const message = `👋 *¡Hola de nuevo, ${existingUser.username}!*

Tu Chat ID ya está configurado correctamente: \`${chatId}\`

✅ *Estado de tu cuenta:*
• Usuario: ${existingUser.username}
• Estado: ${existingUser.isActive ? '🟢 Activo' : '🔴 Inactivo'}
• Expira: ${existingUser.expiresAt ? new Date(existingUser.expiresAt).toLocaleDateString('es-ES') : 'Sin fecha'}

💡 *Comandos disponibles:*
• /help - Ver ayuda completa
• /id - Ver tu Chat ID

📞 *Soporte*: @BalonxSistema`;

        await bot.sendMessage(chatId, message, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true 
        });
        return;
      }

      // Buscar usuarios sin Chat ID configurado para asociación automática
      const usersWithoutChatId = users.filter(user => !user.telegramChatId && user.role === 'user');
      
      // Función para asociar Chat ID con confirmación
      const associateUserChatId = async (user: any, method: string) => {
        try {
          await storage.updateUser(user.id, { telegramChatId: chatId });
          
          const message = `🎉 *¡Chat ID Asociado Automáticamente!*

Hola *${userName}*, hemos asociado automáticamente tu Chat ID con la cuenta: *${user.username}*

Tu Chat ID: \`${chatId}\`
Método: ${method}

✅ *Configuración completada:*
• Ya puedes recibir códigos 2FA aquí
• Recibirás notificaciones importantes
• Estado: ${user.isActive ? '🟢 Activo' : '🔴 Inactivo'}

💡 *Comandos disponibles:*
• /help - Ver ayuda completa
• /id - Ver tu Chat ID

📞 *Soporte*: @BalonxSistema

¡Tu cuenta está lista para usar!`;

          await bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true 
          });

          // Notificar al administrador
          const adminMessage = `🔗 *Chat ID Asociado Automáticamente*

Usuario: *${user.username}*
Chat ID: \`${chatId}\`
Nombre Telegram: ${userName}
Método: ${method}

✅ Asociación completada exitosamente`;

          await bot.sendMessage(ADMIN_CHAT_ID, adminMessage, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true 
          });

          console.log(`✅ Chat ID ${chatId} asociado automáticamente al usuario ${user.username} (${method})`);
          return true;
        } catch (error) {
          console.error('❌ Error asociando Chat ID automáticamente:', error);
          return false;
        }
      };

      // Prioridad 1: Buscar coincidencia exacta por nombre de usuario
      const exactMatch = usersWithoutChatId.find(user => 
        user.username.toLowerCase() === userName.toLowerCase()
      );
      if (exactMatch) {
        const success = await associateUserChatId(exactMatch, "Coincidencia exacta de nombre");
        if (success) return;
      }

      // Prioridad 2: Buscar coincidencia parcial por nombre de usuario
      const partialMatch = usersWithoutChatId.find(user => 
        user.username.toLowerCase().includes(userName.toLowerCase()) ||
        userName.toLowerCase().includes(user.username.toLowerCase())
      );
      if (partialMatch) {
        const success = await associateUserChatId(partialMatch, "Coincidencia parcial de nombre");
        if (success) return;
      }

      // Prioridad 3: Si hay solo un usuario sin Chat ID, asociar automáticamente
      if (usersWithoutChatId.length === 1) {
        const success = await associateUserChatId(usersWithoutChatId[0], "Único usuario disponible");
        if (success) return;
      }

      // Mensaje por defecto si no hay asociación automática posible
      const welcomeMessage = `🎉 *¡Hola ${userName}!*

Tu Chat ID es: \`${chatId}\`

🔐 *Para registrarte en nuestro panel:*
1. Ve al panel de registro
2. Completa tu información
3. **Usa este Chat ID:** \`${chatId}\`
4. Una vez registrado, recibirás códigos 2FA aquí

${usersWithoutChatId.length > 1 ? 
  `⚠️ *Nota:* Hay ${usersWithoutChatId.length} usuarios sin Chat ID configurado. La asociación automática no es posible.` : 
  ''}

💡 *Comandos disponibles:*
• /help - Ver ayuda completa
• /id - Ver tu Chat ID nuevamente

📞 *Soporte*: @BalonxSistema

¡Gracias por utilizar nuestro sistema!`;

      await bot.sendMessage(chatId, welcomeMessage, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true 
      });

    } catch (error) {
      console.error('❌ Error en comando /start:', error);
      
      // Mensaje de fallback
      const fallbackMessage = `🎉 *¡Hola ${userName}!*

Tu Chat ID es: \`${chatId}\`

Para registrarte, usa este Chat ID en el panel de registro.

📞 *Soporte*: @BalonxSistema`;

      await bot.sendMessage(chatId, fallbackMessage, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true 
      });
    }
  });

  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const helpMessage = `🆘 *Ayuda del Bot*

*Comandos disponibles:*
• /start - Mensaje de bienvenida
• /pago - Verificar tu pago (enviar captura y monto)
• /help - Mostrar esta ayuda
• /id - Mostrar tu Chat ID
• /cancelar - Cancelar proceso de pago

*Funciones:*
• Recibir códigos de verificación 2FA
• Verificación de pagos con captura
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

  // Manejar errores del polling con más detalles
  bot.on('polling_error', (error: any) => {
    if (error.code === 'ETELEGRAM' || error.code === 'EFATAL') {
      // Error crítico - detener y reiniciar bot después de 10 segundos
      console.error('❌ Error crítico de polling:', error.message || error.code);
      console.error('   Detalle:', JSON.stringify(error, null, 2));
    } else {
      // Error recuperable - solo log
      console.log('⚠️ Error de polling (continuando):', error.code, error.message);
    }
  });

  console.log('🎯 Bot de Telegram configurado con comandos: /start, /pago, /help, /id, /cancelar');
};

// Configurar botones de comandos del bot
const setupBotMenu = async () => {
  try {
    await bot.setMyCommands([
      { command: 'start', description: 'Iniciar el bot y ver información' },
      { command: 'pago', description: 'Verificar pago (enviar captura y monto)' },
      { command: 'help', description: 'Ver ayuda y comandos disponibles' },
      { command: 'id', description: 'Ver tu Chat ID' },
      { command: 'cancelar', description: 'Cancelar proceso de pago' }
    ]);
    console.log('✅ Menú de comandos del bot configurado');
  } catch (error) {
    console.error('❌ Error configurando menú de comandos:', error);
  }
};

// Configurar comandos y menú del bot después de la inicialización
setTimeout(setupBotCommands, 1000);
setTimeout(setupBotMenu, 1500);

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

/**
 * Envía instrucciones de pago a un usuario
 */
export async function sendPaymentInstructions(user: any, context: 'registration' | 'renewal' = 'registration'): Promise<void> {
  try {
    if (!user.telegramChatId) {
      console.log(`[Bot] Usuario ${user.username} no tiene Chat ID configurado`);
      return;
    }

    // Obtener el precio que debe pagar el usuario según tipo de cuenta
    const systemConfig = await storage.getSystemConfig();
    const isOffice = user.accountType === 'office';
    const basePrice = isOffice ? '6000' : (systemConfig?.subscriptionPrice || '3000');
    const expectedAmount = user.customPrice || basePrice;
    
    // Obtener cuenta de depósito
    const BITSO_RECEIVING_ACCOUNT = process.env.BITSO_RECEIVING_ACCOUNT || '';
    
    // Verificar que la cuenta de depósito esté configurada
    if (!BITSO_RECEIVING_ACCOUNT) {
      const fallbackMessage = `⚠️ Error de configuración del sistema. Por favor contacta con @BalonxSistema para completar tu ${context === 'registration' ? 'registro' : 'renovación'}.`;
      await bot.sendMessage(user.telegramChatId, fallbackMessage, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true 
      });
      console.error(`[Bot] BITSO_RECEIVING_ACCOUNT no configurado para usuario ${user.username}`);
      return;
    }
    
    // Crear sesión de pago
    paymentSessions.set(user.telegramChatId, {
      chatId: user.telegramChatId,
      state: 'awaiting_screenshot',
      userId: user.id,
      expectedAmount
    });

    const contextMessage = context === 'registration' 
      ? `¡Bienvenido al sistema! Para activar tu cuenta por 7 días:`
      : `🚨 *Realiza tu pago*\n\nTu suscripción vence pronto. Para renovar tu cuenta por 7 días:`;
    
    const accountTypeInfo = isOffice 
      ? `\n\n🏢 *Cuenta de Oficina:*
• Gestiona hasta 8 ejecutivos
• Cada ejecutivo con acceso independiente
• Visibilidad completa de todas las sesiones` 
      : '';

    const message = `💳 *Instrucciones de Pago*

Hola *${user.username?.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}*,

${contextMessage}${accountTypeInfo}

💰 *Monto a depositar:* $${expectedAmount} MXN

📱 *Instrucciones:*
1️⃣ Abre tu app bancaria
2️⃣ Deposita exactamente *$${expectedAmount} MXN*
3️⃣ Usa la siguiente cuenta receptora:
   \`${BITSO_RECEIVING_ACCOUNT}\`

⏱️ *Verificación Automática:*
• Envía tu captura de pantalla del pago
• El sistema verificará tu pago con Bitso cada 2 minutos
• Recibirás confirmación automática (puede tomar hasta 30 min)
• Si no se verifica, el admin revisará manualmente

📸 *Siguiente paso:*
Envía la captura de pantalla de tu transferencia

Para cancelar este proceso, envía /cancelar`;

    await bot.sendMessage(user.telegramChatId, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });

    console.log(`[Bot] Instrucciones de pago enviadas a ${user.username} (contexto: ${context})`);
  } catch (error: any) {
    console.error(`[Bot] Error enviando instrucciones de pago a ${user.username}:`, error);
  }
}

/**
 * Envía recordatorios de renovación a usuarios cuyas suscripciones expiran en 1 día
 */
export async function sendRenewalReminders(): Promise<void> {
  try {
    console.log('[Bot] Verificando usuarios con suscripciones por vencer...');
    
    // Obtener usuarios que expiran en 24 horas
    const usersExpiringTomorrow = await storage.getUsersExpiringTomorrow();
    
    if (usersExpiringTomorrow.length === 0) {
      console.log('[Bot] No hay usuarios con suscripciones por vencer');
      return;
    }

    console.log(`[Bot] Enviando recordatorios a ${usersExpiringTomorrow.length} usuarios`);

    for (const user of usersExpiringTomorrow) {
      if (!user.telegramChatId) {
        console.log(`[Bot] Usuario ${user.username} no tiene Chat ID configurado`);
        continue;
      }

      const expirationDate = user.expiresAt ? new Date(user.expiresAt).toLocaleDateString('es-ES') : 'mañana';
      
      try {
        // Enviar instrucciones de pago
        await sendPaymentInstructions(user, 'renewal');
        
        console.log(`[Bot] Recordatorio de pago enviado a ${user.username} (${user.telegramChatId})`);
        
        // Crear notificación en el sistema
        await storage.createNotification({
          userId: user.id,
          type: 'subscription_reminder',
          title: 'Realiza tu pago',
          message: `Tu suscripción expira el ${expirationDate}. Realiza tu pago y envía la captura de pantalla para renovar automáticamente.`,
          priority: 'high'
        });
        
      } catch (error) {
        console.error(`[Bot] Error enviando recordatorio a ${user.username}:`, error);
      }
      
      // Pequeña pausa entre envíos para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } catch (error) {
    console.error('[Bot] Error en recordatorios de renovación:', error);
  }
}

// Ejecutar recordatorios diariamente a las 10:00 AM
const scheduleRenewalReminders = () => {
  const now = new Date();
  const targetTime = new Date();
  targetTime.setHours(10, 0, 0, 0); // 10:00 AM
  
  // Si ya pasó la hora de hoy, programar para mañana
  if (now > targetTime) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  const timeUntilTarget = targetTime.getTime() - now.getTime();
  
  setTimeout(() => {
    sendRenewalReminders();
    // Programar para ejecutar cada 24 horas
    setInterval(sendRenewalReminders, 24 * 60 * 60 * 1000);
  }, timeUntilTarget);
  
  console.log(`📅 Recordatorios programados para las 10:00 AM (próxima ejecución: ${targetTime.toLocaleString('es-ES')})`);
};

// Iniciar programación de recordatorios
scheduleRenewalReminders();

/**
 * Envía notificación cuando se renueva un panel
 */
export async function sendRenewalConfirmation(userId: number, newExpirationDate: Date): Promise<void> {
  try {
    const user = await storage.getUserById(userId);
    if (!user || !user.telegramChatId) {
      console.log(`[Bot] Usuario ${userId} no tiene Chat ID configurado para confirmación de renovación`);
      return;
    }

    const expirationDateStr = newExpirationDate.toLocaleDateString('es-ES');
    
    const message = `✅ *PANEL RENOVADO EXITOSAMENTE*

🎉 ¡Tu suscripción ha sido renovada!

📅 **Nueva fecha de expiración:** ${expirationDateStr}
👤 **Usuario:** ${user.username}
🔄 **Estado:** Activo

💼 Ahora puedes continuar utilizando todos los servicios del panel.

¡Gracias por renovar con nosotros! 🚀

_Confirmación automática del sistema_`;

    await bot.sendMessage(user.telegramChatId, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
    
    console.log(`[Bot] Confirmación de renovación enviada a ${user.username} (${user.telegramChatId})`);
    
    // Crear notificación en el sistema
    await storage.createNotification({
      userId: user.id,
      type: 'subscription_renewed',
      title: 'Panel Renovado',
      message: `Tu suscripción ha sido renovada hasta el ${expirationDateStr}`,
      priority: 'medium'
    });
    
  } catch (error) {
    console.error('[Bot] Error enviando confirmación de renovación:', error);
  }
}

/**
 * Envía notificación cuando vence un panel
 */
export async function sendExpirationNotification(userId: number): Promise<void> {
  try {
    const user = await storage.getUserById(userId);
    if (!user || !user.telegramChatId) {
      console.log(`[Bot] Usuario ${userId} no tiene Chat ID configurado para notificación de vencimiento`);
      return;
    }

    const message = `⚠️ *PANEL VENCIDO*

🔒 Tu suscripción al panel ha expirado

👤 **Usuario:** ${user.username}
📅 **Fecha de vencimiento:** Hoy
🚫 **Estado:** Inactivo

📝 **Para reactivar tu cuenta:**
👉 Contacta con @balonxSistema
💰 Renueva tu suscripción para restablecer el acceso

⏰ No pierdas más tiempo, ¡renueva ahora!

_Notificación automática del sistema_`;

    await bot.sendMessage(user.telegramChatId, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
    
    console.log(`[Bot] Notificación de vencimiento enviada a ${user.username} (${user.telegramChatId})`);
    
    // Crear notificación en el sistema
    await storage.createNotification({
      userId: user.id,
      type: 'subscription_expired',
      title: 'Panel Vencido',
      message: 'Tu suscripción ha expirado. Contacta @balonxSistema para renovar.',
      priority: 'high',
      actionUrl: 'https://t.me/balonxSistema'
    });
    
  } catch (error) {
    console.error('[Bot] Error enviando notificación de vencimiento:', error);
  }
}

/**
 * Verifica y notifica paneles vencidos
 */
export async function checkAndNotifyExpiredPanels(): Promise<void> {
  try {
    console.log('[Bot] Verificando paneles recién vencidos...');
    
    const expiredUsers = await storage.getRecentlyExpiredUsers();
    
    if (expiredUsers.length === 0) {
      console.log('[Bot] No hay paneles recién vencidos');
      return;
    }

    console.log(`[Bot] Enviando notificaciones de vencimiento a ${expiredUsers.length} usuarios`);

    for (const user of expiredUsers) {
      await sendExpirationNotification(user.id);
      
      // Pequeña pausa entre envíos
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } catch (error) {
    console.error('[Bot] Error verificando paneles vencidos:', error);
  }
}

// Ejecutar verificación de vencimientos cada hora
setInterval(checkAndNotifyExpiredPanels, 60 * 60 * 1000);
console.log('📅 Verificación de vencimientos programada cada hora');

/**
 * Envía confirmación de pago cuando se verifica un depósito
 */
export async function sendPaymentConfirmation(userId: number, amount: string, expirationDate: Date): Promise<void> {
  try {
    const user = await storage.getUserById(userId);
    if (!user || !user.telegramChatId) {
      console.log(`[Bot] Usuario ${userId} no tiene Chat ID configurado para confirmación de pago`);
      return;
    }

    const expirationDateStr = expirationDate.toLocaleDateString('es-ES');
    
    const message = `✅ *PAGO VERIFICADO*

🎉 ¡Tu pago ha sido confirmado!

💰 **Monto:** $${amount}
📅 **Suscripción activa hasta:** ${expirationDateStr}
👤 **Usuario:** ${user.username}

🚀 Tu cuenta ha sido activada automáticamente por 7 días.

¡Gracias por tu pago! Ahora puedes disfrutar de todos los servicios del panel.

_Confirmación automática del sistema Bitso_`;

    await bot.sendMessage(user.telegramChatId, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
    
    console.log(`[Bot] Confirmación de pago enviada a ${user.username} (${user.telegramChatId})`);
    
    await storage.createNotification({
      userId: user.id,
      type: 'subscription_renewed',
      title: 'Pago Verificado',
      message: `Tu pago de $${amount} ha sido confirmado. Cuenta activa hasta el ${expirationDateStr}`,
      priority: 'high'
    });
    
  } catch (error) {
    console.error('[Bot] Error enviando confirmación de pago:', error);
  }
}

/**
 * Envía solicitud de verificación manual al admin cuando Bitso no puede verificar el pago
 */
export async function sendManualVerificationRequest(paymentId: number, user: any, amount: string, telegramFileId: string): Promise<void> {
  try {
    const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
    if (!ADMIN_CHAT_ID) {
      console.error('[Bot] ADMIN_CHAT_ID no configurado');
      return;
    }

    // Obtener la imagen para análisis de IA
    const file = await bot.getFile(telegramFileId);
    const imageUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`;
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBase64 = Buffer.from(imageResponse.data).toString('base64');

    // Analizar con IA
    const { verifyPaymentScreenshot } = await import('./paymentVerificationAI');
    const aiAnalysis = await verifyPaymentScreenshot(imageBase64, amount, user.username || 'Usuario');

    // Enviar al admin con análisis de IA
    const caption = `⚠️ *VERIFICACIÓN MANUAL REQUERIDA*

👤 Usuario: *${user.username}*
💵 Monto esperado: *$${amount} MXN*
🔄 Bitso API no pudo verificar el pago después de 30 minutos

📊 *Análisis de IA:*
${aiAnalysis.isValid ? '✅' : '❌'} Válido: ${aiAnalysis.isValid ? 'Sí' : 'No'}
💰 Monto detectado: ${aiAnalysis.extractedAmount ? `$${aiAnalysis.extractedAmount} MXN` : 'No detectado'}
🕒 Hora detectada: ${aiAnalysis.extractedTime || 'No detectada'}
📊 Confianza: ${(aiAnalysis.confidence * 100).toFixed(0)}%
💭 Razón: ${aiAnalysis.reason}

⚡ *Acción requerida:*
Revisa manualmente la captura y activa al usuario si el pago es correcto.

ID de Pago: ${paymentId}`;

    await bot.sendPhoto(ADMIN_CHAT_ID, telegramFileId, {
      caption,
      parse_mode: 'Markdown'
    });

    console.log(`[Bot] Solicitud de verificación manual enviada al admin para usuario ${user.username}`);

    // Notificar al usuario
    if (user.telegramChatId) {
      await bot.sendMessage(user.telegramChatId, `⏳ *Verificación en Proceso*

Tu pago está siendo revisado manualmente por el administrador.

Recibirás confirmación pronto.

💡 Si tienes dudas, contacta: @balonxSistema`, {
        parse_mode: 'Markdown'
      });
    }

  } catch (error) {
    console.error('[Bot] Error enviando solicitud de verificación manual:', error);
  }
}

/**
 * Responde a consultas sobre pagos con IA simple
 */
export function handlePaymentQuery(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('pagar') || lowerMessage.includes('depositar') || lowerMessage.includes('como pago')) {
    return `💳 *Instrucciones de Pago*

Para activar tu suscripción por 7 días:

1️⃣ Realiza un depósito a través de Bitso
2️⃣ Usa el monto exacto que te indicó el administrador
3️⃣ El sistema verificará tu pago automáticamente
4️⃣ Recibirás confirmación aquí mismo

⚠️ *Importante:*
• El pago se verifica en minutos
• Tu cuenta se activa automáticamente
• Recibirás recordatorio 1 día antes de vencer

📞 Dudas: @balonxSistema`;
  }
  
  if (lowerMessage.includes('cuanto') || lowerMessage.includes('precio') || lowerMessage.includes('costo')) {
    return `💰 *Información de Precio*

El precio de la suscripción por 7 días te lo proporcionará el administrador.

Para conocer el monto exacto, contacta:
👉 @balonxSistema

El pago se realiza a través de Bitso y se verifica automáticamente.`;
  }
  
  if (lowerMessage.includes('cuenta') || lowerMessage.includes('deposito') || lowerMessage.includes('donde')) {
    return `🔒 *Información de Cuenta*

Por seguridad, los datos de la cuenta de depósito NO se comparten públicamente.

Para obtener los detalles de pago:
👉 Contacta con @balonxSistema

El administrador te proporcionará:
• Monto a depositar
• Detalles de la cuenta
• Instrucciones específicas`;
  }
  
  if (lowerMessage.includes('verificar') || lowerMessage.includes('confirmar') || lowerMessage.includes('cuando')) {
    return `⏱️ *Verificación de Pagos*

El sistema verifica pagos automáticamente cada 5 minutos.

Una vez que realices tu depósito:
✅ Se verificará automáticamente
✅ Recibirás confirmación aquí
✅ Tu cuenta se activará por 7 días

Si no recibes confirmación en 30 minutos:
📞 Contacta @balonxSistema`;
  }
  
  if (lowerMessage.includes('renovar') || lowerMessage.includes('vence') || lowerMessage.includes('expira')) {
    return `🔄 *Renovación de Suscripción*

Recibirás un recordatorio 1 día antes de que venza tu suscripción.

Para renovar:
1️⃣ Contacta @balonxSistema
2️⃣ Realiza el pago como la primera vez
3️⃣ Se activará automáticamente por 7 días más

¡No pierdas acceso a tus servicios! 🚀`;
  }
  
  return `👋 Hola, soy el bot de pagos.

Puedo ayudarte con:
💳 Información de pagos
💰 Precios y costos
⏱️ Verificación de depósitos
🔄 Renovaciones

Para soporte personalizado:
📞 @balonxSistema`;
}

// Agregar manejador de mensajes para respuestas automáticas y flujo de pago
bot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString();
  const messageText = msg.text || '';
  
  // Ignorar comandos (ya se manejan en onText)
  if (messageText.startsWith('/')) {
    return;
  }
  
  // Verificar si hay una sesión de descuento activa (solo admin)
  const discountSession = discountSessions.get(chatId);
  
  if (discountSession && chatId === ADMIN_CHAT_ID) {
    if (discountSession.state === 'awaiting_amount') {
      // Esperar monto del descuento
      const amountMatch = messageText.match(/^[\d.]+$/);
      
      if (!amountMatch) {
        await bot.sendMessage(chatId, `❌ Por favor envía solo el *monto de descuento* (números), ejemplo: 500

Para cancelar, envía /cancelar`, { 
          parse_mode: 'Markdown' 
        });
        return;
      }
      
      const discountAmount = parseFloat(messageText).toFixed(2);
      
      try {
        // Generar código único alfanumérico de 8 caracteres
        const code = generatePaymentReferenceCode(); // Reutilizamos la función que genera códigos únicos
        
        // Buscar al admin que crea el código
        const admins = await storage.getAllUsers();
        const admin = admins.find(u => u.telegramChatId === chatId);
        
        if (!admin) {
          await bot.sendMessage(chatId, '❌ Error: No se pudo identificar tu cuenta de administrador.', { 
            parse_mode: 'Markdown' 
          });
          discountSessions.delete(chatId);
          return;
        }
        
        // Crear código de descuento
        const discountCode = await storage.createDiscountCode({
          code,
          discountAmount,
          createdBy: admin.id
        });
        
        const message = `✅ *Código de Descuento Creado*

🎫 Código: \`${code}\`
💰 Descuento: $${discountAmount} MXN
📅 Creado: ${new Date().toLocaleString('es-MX')}

Este código es de un solo uso. Compártelo con el cliente para que lo use al registrarse.

El precio base es $3000 MXN. Con este descuento el precio final será: *$${(3000 - parseFloat(discountAmount)).toFixed(2)} MXN*`;

        await bot.sendMessage(chatId, message, { 
          parse_mode: 'Markdown' 
        });
        
        // Limpiar sesión
        discountSessions.delete(chatId);
        
      } catch (error: any) {
        console.error('[DiscountCode] Error creando código:', error);
        await bot.sendMessage(chatId, '❌ Ocurrió un error al crear el código de descuento. Intenta nuevamente.', { 
          parse_mode: 'Markdown' 
        });
        discountSessions.delete(chatId);
      }
      
      return;
    }
  }
  
  // Verificar si hay una sesión de pago activa
  const paymentSession = paymentSessions.get(chatId);
  
  if (paymentSession) {
    // Procesar flujo de pago
    if (paymentSession.state === 'awaiting_screenshot') {
      // Esperar imagen/foto
      if (msg.photo && msg.photo.length > 0) {
        const photo = msg.photo[msg.photo.length - 1]; // Obtener la foto de mayor calidad
        paymentSession.screenshotFileId = photo.file_id;
        
        // Cambiar estado para esperar la cantidad
        paymentSession.state = 'awaiting_amount';
        
        await bot.sendMessage(chatId, `✅ *Captura recibida correctamente*

Ahora ingresa la *cantidad exacta* que depositaste (solo números):

Ejemplo: 3000 o 2500.50

Para cancelar, envía /cancelar`, { 
          parse_mode: 'Markdown' 
        });
        
        return;
      } else {
        await bot.sendMessage(chatId, `❌ Por favor envía una *imagen* (captura de pantalla) de tu transferencia.

Para cancelar, envía /cancelar`, { 
          parse_mode: 'Markdown' 
        });
        return;
      }
    }
    
    if (paymentSession.state === 'awaiting_amount') {
      // Esperar monto
      const amountMatch = messageText.match(/[\d.]+/);
      
      if (!amountMatch) {
        await bot.sendMessage(chatId, `❌ Por favor envía solo el *monto* (números), ejemplo: 3000 o 2500.50

Para cancelar, envía /cancelar`, { 
          parse_mode: 'Markdown' 
        });
        return;
      }
      
      const amount = parseFloat(amountMatch[0]).toFixed(2);
      paymentSession.amount = amount;
      
      // Crear pending payment para verificación automática con Bitso + AI
      try {
        const user = await storage.getUserById(paymentSession.userId!);
        
        if (!user) {
          throw new Error('Usuario no encontrado');
        }

        // Generar código de referencia único para este pago
        const referenceCode = generatePaymentReferenceCode();

        // Obtener balance actual de Bitso antes de crear el pago
        const currentBalance = await getMXNBalance();
        console.log(`[Payment] Balance actual de Bitso: $${currentBalance || 'N/A'} MXN`);

        // Crear pending payment para verificación automática
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Expira en 1 hora

        await storage.createPayment({
          userId: user.id,
          amount: amount,
          referenceCode,
          status: 'pending' as any,
          telegramFileId: paymentSession.screenshotFileId!,
          verificationAttempts: 0,
          expiresAt,
          previousBalance: currentBalance || undefined,
          reportedAmount: amount
        });

        console.log(`[Payment] Pending payment creado para usuario ${user.username} - Código: ${referenceCode} - Monto: $${amount} MXN`);

        // Determinar si es activación o renovación
        const isActive = user.isActive && user.expiresAt && new Date(user.expiresAt) > new Date();
        const actionText = isActive ? 'renovaremos' : 'activaremos';
        
        // Notificar al usuario
        await bot.sendMessage(chatId, `🔄 *Estamos procesando tu transferencia*

Cuando sea exitosa te *${actionText}* tu cuenta automáticamente.

🔐 *Código de Referencia:* \`${referenceCode}\`
💰 *Monto:* $${amount} MXN

⏱️ Si en 15 minutos no se puede verificar automáticamente, tu caso será enviado al administrador para activación manual.

📱 Recibirás una notificación cuando tu cuenta sea activada.`, { 
          parse_mode: 'Markdown' 
        });

        // Notificar al admin que hay un nuevo pago pendiente
        await bot.sendPhoto(ADMIN_CHAT_ID, paymentSession.screenshotFileId!, {
          caption: `🔔 *Nuevo Pago Pendiente - Verificación Automática*

👤 Usuario: *${user.username}*
💵 Monto reportado: *$${amount} MXN*
💵 Monto esperado: *$${paymentSession.expectedAmount} MXN*
🔐 Código: \`${referenceCode}\`

🤖 *Verificación Automática:*
• Bitso API + AI Vision cada 2 minutos
• Auto-${actionText} si se verifica exitosamente
• Revisión manual después de 15 minutos

📅 Fecha: ${new Date().toLocaleString('es-MX')}`,
          parse_mode: 'Markdown'
        });
        
        // Limpiar sesión
        paymentSessions.delete(chatId);
        
      } catch (error: any) {
        console.error('❌ Error procesando pago:', error);
        await bot.sendMessage(chatId, '❌ Ocurrió un error al procesar tu solicitud. Por favor contacta con @BalonxSistema', { 
          parse_mode: 'Markdown' 
        });
        paymentSessions.delete(chatId);
      }
      
      return;
    }
  }
  
  // Respuestas automáticas para consultas sobre pagos (solo si no hay sesión activa)
  if (messageText.toLowerCase().includes('pago') || 
      messageText.toLowerCase().includes('pagar') ||
      messageText.toLowerCase().includes('precio') ||
      messageText.toLowerCase().includes('cuenta') ||
      messageText.toLowerCase().includes('deposito') ||
      messageText.toLowerCase().includes('verificar') ||
      messageText.toLowerCase().includes('renovar')) {
    
    const response = handlePaymentQuery(messageText);
    await bot.sendMessage(chatId, response, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
  }
});