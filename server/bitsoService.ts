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

export async function checkPendingPayments(): Promise<void> {
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
      
      const bitsoPayment = await verifyPayment(payment.amount);
      
      if (bitsoPayment) {
        console.log(`[Bitso] ✅ Pago verificado para usuario ${payment.userId}`);
        
        await storage.markPaymentAsCompleted(payment.id, bitsoPayment.tid);
        
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7);
        
        await storage.updateUser(payment.userId, {
          isActive: true,
          expiresAt: expirationDate
        });
        
        const user = await storage.getUserById(payment.userId);
        if (user && user.telegramChatId) {
          const { sendPaymentConfirmation } = await import('./telegramBot');
          await sendPaymentConfirmation(user.id, bitsoPayment.amount, expirationDate);
        }
        
        console.log(`[Bitso] Usuario ${payment.userId} activado hasta ${expirationDate.toLocaleDateString('es-ES')}`);
      } else if (newAttempts >= 15) {
        // Después de 15 intentos (30 minutos), enviar al admin para revisión manual
        console.log(`[Bitso] ⚠️ No se pudo verificar pago después de ${newAttempts} intentos - Enviando a revisión manual`);
        
        const user = await storage.getUserById(payment.userId);
        if (user && payment.telegramFileId) {
          const { sendManualVerificationRequest } = await import('./telegramBot');
          await sendManualVerificationRequest(payment.id, user, payment.amount, payment.telegramFileId);
        }
        
        // Marcar como expirado para que no se siga verificando
        await storage.updatePaymentStatus(payment.id, PaymentStatus.EXPIRED);
      } else {
        console.log(`[Bitso] Intento ${newAttempts}/15 - Pago de $${payment.amount} MXN aún no verificado`);
      }
    }
  } catch (error) {
    console.error('[Bitso] Error en verificación de pagos pendientes:', error);
  }
}

setInterval(checkPendingPayments, 2 * 60 * 1000);
console.log('🔄 Verificación automática de pagos Bitso iniciada (cada 2 minutos)');
