import crypto from 'crypto';
import axios from 'axios';
import { PaymentStatus } from '@shared/schema';

const BITSO_API_KEY = process.env.BITSO_API_KEY;
const BITSO_API_SECRET = process.env.BITSO_API_SECRET;
const BITSO_RECEIVING_ACCOUNT = process.env.BITSO_RECEIVING_ACCOUNT;
const BITSO_API_URL = 'https://api.bitso.com/v3';

if (!BITSO_API_KEY || !BITSO_API_SECRET || !BITSO_RECEIVING_ACCOUNT) {
  throw new Error('BITSO_API_KEY, BITSO_API_SECRET y BITSO_RECEIVING_ACCOUNT deben estar configurados en las variables de entorno');
}

interface BitsoTransaction {
  tid: string;
  amount: string;
  currency: string;
  method: string;
  created_at: string;
  status: string;
  details?: {
    sender?: string;
    receiving_account?: string;
  };
}

interface BitsoFundingsResponse {
  success: boolean;
  payload: BitsoTransaction[];
}

function generateBitsoSignature(httpMethod: string, requestPath: string, nonce: string, jsonPayload: string = ''): string {
  if (!BITSO_API_SECRET) {
    throw new Error('BITSO_API_SECRET no está configurado');
  }
  const message = nonce + httpMethod + requestPath + jsonPayload;
  const signature = crypto.createHmac('sha256', BITSO_API_SECRET).update(message).digest('hex');
  return signature;
}

export async function getBitsoFundings(limit: number = 100): Promise<BitsoTransaction[]> {
  try {
    const nonce = Date.now().toString();
    const httpMethod = 'GET';
    const requestPath = '/v3/fundings/';
    
    const signature = generateBitsoSignature(httpMethod, requestPath, nonce);
    
    const headers = {
      'Authorization': `Bitso ${BITSO_API_KEY}:${nonce}:${signature}`,
      'Content-Type': 'application/json'
    };

    const response = await axios.get<BitsoFundingsResponse>(`${BITSO_API_URL}/fundings/`, {
      headers,
      params: { limit }
    });

    if (response.data.success) {
      return response.data.payload;
    } else {
      console.error('[Bitso] Error en respuesta:', response.data);
      return [];
    }
  } catch (error: any) {
    console.error('[Bitso] Error obteniendo fundings:', error.response?.data || error.message);
    return [];
  }
}

export async function verifyPayment(expectedAmount: string, receivingAccount?: string): Promise<BitsoTransaction | null> {
  const accountToVerify = receivingAccount || BITSO_RECEIVING_ACCOUNT;
  if (!accountToVerify) {
    throw new Error('BITSO_RECEIVING_ACCOUNT no está configurado');
  }
  try {
    console.log(`[Bitso] Buscando pago de ${expectedAmount}`);
    
    const fundings = await getBitsoFundings(50);
    
    const recentPayment = fundings.find(funding => {
      const amountMatch = parseFloat(funding.amount) >= parseFloat(expectedAmount) * 0.99 && 
                         parseFloat(funding.amount) <= parseFloat(expectedAmount) * 1.01;
      
      const accountMatch = funding.details?.receiving_account === accountToVerify;
      
      const isRecent = new Date(funding.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;
      
      const isCompleted = funding.status === 'complete';
      
      return amountMatch && accountMatch && isRecent && isCompleted;
    });

    if (recentPayment) {
      console.log(`[Bitso] Pago encontrado: ${recentPayment.tid} - ${recentPayment.amount} ${recentPayment.currency}`);
      return recentPayment;
    } else {
      console.log('[Bitso] No se encontró pago que coincida con los criterios');
      return null;
    }
  } catch (error) {
    console.error('[Bitso] Error verificando pago:', error);
    return null;
  }
}

// Flag para prevenir ejecuciones concurrentes
let isCheckingPayments = false;

export async function checkPendingPayments(): Promise<void> {
  // Prevenir ejecuciones concurrentes
  if (isCheckingPayments) {
    console.log('[Bitso] Ya hay una verificación en curso, saltando...');
    return;
  }
  
  isCheckingPayments = true;
  console.log('[Bitso] Verificando pagos pendientes...');
  
  try {
    const { storage } = await import('./storage');
    const pendingPayments = await storage.getPendingPayments();
    
    if (pendingPayments.length === 0) {
      console.log('[Bitso] No hay pagos pendientes');
      return;
    }

    for (const payment of pendingPayments) {
      // Incrementar intentos de verificación
      const newAttempts = (payment.verificationAttempts || 0) + 1;
      await storage.incrementPaymentVerificationAttempts(payment.id);
      
      // Paso 1: Verificar con Bitso API si existe el pago
      const bitsoPayment = await verifyPayment(payment.amount);
      
      if (bitsoPayment && payment.telegramFileId) {
        // Paso 2: Si Bitso encuentra el pago, verificar con AI la captura de pantalla
        console.log(`[Bitso+AI] Pago encontrado en Bitso, verificando captura con AI...`);
        
        const user = await storage.getUserById(payment.userId);
        if (!user) {
          console.error(`[Bitso+AI] Usuario ${payment.userId} no encontrado`);
          
          // Si se alcanza el límite de intentos, escalar a revisión manual
          if (newAttempts >= 15) {
            console.log(`[Bitso+AI] ⚠️ Usuario no encontrado después de ${newAttempts} intentos - Marcando para revisión manual`);
            await storage.updatePaymentStatus(payment.id, PaymentStatus.MANUAL_REVIEW);
          }
          continue;
        }
        
        try {
          // Obtener la imagen de Telegram y convertir a base64
          const TelegramBot = await import('node-telegram-bot-api');
          const bot = new TelegramBot.default(process.env.TELEGRAM_TOKEN || '', { polling: false });
          const fileLink = await bot.getFileLink(payment.telegramFileId);
          
          const axios = await import('axios');
          const imageResponse = await axios.default.get(fileLink, { responseType: 'arraybuffer' });
          const imageBase64 = Buffer.from(imageResponse.data).toString('base64');
          
          const { verifyPaymentScreenshot } = await import('./paymentVerificationAI');
          const aiAnalysis = await verifyPaymentScreenshot(imageBase64, payment.amount, user.username);
          
          // Paso 3: Activar solo si AI confirma con alta confianza (>70%)
          if (aiAnalysis.isValid && aiAnalysis.confidence > 0.7) {
            console.log(`[Bitso+AI] ✅ Verificación completa - Bitso: ${bitsoPayment.tid} | AI: ${(aiAnalysis.confidence * 100).toFixed(0)}% confianza`);
            
            await storage.markPaymentAsCompleted(payment.id, bitsoPayment.tid);
            
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 7);
            
            await storage.updateUser(payment.userId, {
              isActive: true,
              expiresAt: expirationDate
            });
            
            if (user.telegramChatId) {
              try {
                const { sendPaymentConfirmation } = await import('./telegramBot');
                await sendPaymentConfirmation(user.id, bitsoPayment.amount, expirationDate);
              } catch (notifError: any) {
                console.error(`[Bitso+AI] Error enviando confirmación:`, notifError.message);
              }
            }
            
            console.log(`[Bitso+AI] Usuario ${payment.userId} activado hasta ${expirationDate.toLocaleDateString('es-ES')}`);
          } else {
            // AI no confirma con suficiente confianza
            console.log(`[Bitso+AI] AI no confirmó el pago (confianza: ${(aiAnalysis.confidence * 100).toFixed(0)}%) - Intento ${newAttempts}/7`);
            
            // Si se alcanza el límite de intentos, enviar a revisión manual
            if (newAttempts >= 7) {
              console.log(`[Bitso+AI] ⚠️ Bitso encontró pago pero AI no confirmó después de ${newAttempts} intentos (15 min) - Enviando a revisión manual`);
              
              try {
                const { sendManualVerificationRequest } = await import('./telegramBot');
                await sendManualVerificationRequest(payment.id, user, payment.amount, payment.telegramFileId);
              } catch (notifError: any) {
                console.error(`[Bitso+AI] Error enviando solicitud manual:`, notifError.message);
              }
              
              await storage.updatePaymentStatus(payment.id, PaymentStatus.MANUAL_REVIEW);
            }
          }
        } catch (aiError: any) {
          console.error(`[Bitso+AI] Error verificando con AI:`, aiError.message);
          console.log(`[Bitso+AI] Continuando sin verificación AI - Intento ${newAttempts}/7`);
          
          // Si se alcanza el límite de intentos y hay error de AI, enviar a revisión manual
          if (newAttempts >= 7) {
            console.log(`[Bitso+AI] ⚠️ Error de AI después de ${newAttempts} intentos (15 min) - Enviando a revisión manual`);
            
            try {
              const { sendManualVerificationRequest } = await import('./telegramBot');
              await sendManualVerificationRequest(payment.id, user, payment.amount, payment.telegramFileId);
            } catch (notifError: any) {
              console.error(`[Bitso+AI] Error enviando solicitud manual:`, notifError.message);
            }
            
            await storage.updatePaymentStatus(payment.id, PaymentStatus.MANUAL_REVIEW);
          }
        }
      } else if (newAttempts >= 7) {
        // Después de 7 intentos (15 minutos), enviar al admin para revisión manual
        console.log(`[Bitso+AI] ⚠️ No se pudo verificar pago después de ${newAttempts} intentos (15 min) - Enviando a revisión manual`);
        
        // Primero marcar como en revisión manual (prioritario para evitar bucle)
        await storage.updatePaymentStatus(payment.id, PaymentStatus.MANUAL_REVIEW);
        
        // Luego intentar enviar notificación (no crítico si falla)
        try {
          const user = await storage.getUserById(payment.userId);
          if (user && payment.telegramFileId) {
            const { sendManualVerificationRequest } = await import('./telegramBot');
            await sendManualVerificationRequest(payment.id, user, payment.amount, payment.telegramFileId);
          }
        } catch (notifError: any) {
          console.error(`[Bitso+AI] Error enviando solicitud manual:`, notifError.message);
        }
      } else {
        console.log(`[Bitso+AI] Intento ${newAttempts}/7 - Pago de $${payment.amount} MXN aún no verificado`);
      }
    }
  } catch (error) {
    console.error('[Bitso] Error en verificación de pagos pendientes:', error);
  } finally {
    isCheckingPayments = false;
  }
}

setInterval(checkPendingPayments, 2 * 60 * 1000);
console.log('🔄 Verificación automática de pagos Bitso iniciada (cada 2 minutos)');
