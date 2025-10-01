import crypto from 'crypto';
import axios from 'axios';

const BITSO_API_KEY = process.env.BITSO_API_KEY || '';
const BITSO_API_SECRET = process.env.BITSO_API_SECRET || '';
const BITSO_API_URL = 'https://api.bitso.com/v3';

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

export async function verifyPayment(expectedAmount: string, receivingAccount: string = '710969000010685312'): Promise<BitsoTransaction | null> {
  try {
    console.log(`[Bitso] Buscando pago de ${expectedAmount} a cuenta ${receivingAccount}`);
    
    const fundings = await getBitsoFundings(50);
    
    const recentPayment = fundings.find(funding => {
      const amountMatch = parseFloat(funding.amount) >= parseFloat(expectedAmount) * 0.99 && 
                         parseFloat(funding.amount) <= parseFloat(expectedAmount) * 1.01;
      
      const accountMatch = funding.details?.receiving_account === receivingAccount;
      
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
      const bitsoPayment = await verifyPayment(payment.amount);
      
      if (bitsoPayment) {
        console.log(`[Bitso] Pago verificado para usuario ${payment.userId}`);
        
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
      }
    }
  } catch (error) {
    console.error('[Bitso] Error en verificación de pagos pendientes:', error);
  }
}

setInterval(checkPendingPayments, 5 * 60 * 1000);
console.log('🔄 Verificación automática de pagos Bitso iniciada (cada 5 minutos)');
