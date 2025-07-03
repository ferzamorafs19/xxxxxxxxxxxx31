import axios from 'axios';

// URLs de la API de Sofmex
const SOFMEX_LOGIN_URL = 'https://www.sofmex.com/api/login';
const SOFMEX_SMS_URL = 'https://www.sofmex.com/api/sms/v3/asignacion';

// Credenciales de Sofmex desde variables de entorno
const SOFMEX_USERNAME = process.env.SOFMEX_USERNAME;
const SOFMEX_PASSWORD = process.env.SOFMEX_PASSWORD;

if (!SOFMEX_USERNAME || !SOFMEX_PASSWORD) {
  console.warn('⚠️ Las credenciales de Sofmex no están configuradas');
}

/**
 * Obtiene el token de autenticación de Sofmex
 */
export async function getSofmexToken(): Promise<string | null> {
  try {
    const response = await axios.post(SOFMEX_LOGIN_URL, null, {
      params: {
        username: SOFMEX_USERNAME,
        password: SOFMEX_PASSWORD
      },
      timeout: 30000
    });
    
    if (response.status === 200 && response.data) {
      console.log('✅ Token de Sofmex obtenido exitosamente');
      return response.data.message; // Token en "message"
    }
    
    console.error('❌ Error obteniendo token de Sofmex: Respuesta inválida');
    return null;
  } catch (error: any) {
    console.error('❌ Error obteniendo token de Sofmex:', error.message);
    return null;
  }
}

/**
 * Envía SMS en lote a múltiples números
 */
export async function sendBulkSMS(
  numeros: string[], 
  mensaje: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log(`📱 Iniciando envío de SMS a ${numeros.length} números`);
    
    const token = await getSofmexToken();
    if (!token) {
      return { success: false, error: "No se pudo obtener el token de autenticación." };
    }

    const headers = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    };

    // Crear registros para envío bulk
    const registros = numeros.map(numero => ({
      telefono: numero,
      mensaje: mensaje
    }));

    const data = { registros: registros };

    console.log(`📤 Enviando ${registros.length} mensajes a la API de Sofmex`);

    const response = await axios.post(SOFMEX_SMS_URL, data, {
      headers: headers,
      timeout: 60000 // Timeout aumentado para lotes grandes
    });

    if (response.status === 200) {
      console.log('✅ SMS enviados exitosamente a través de Sofmex');
      return { success: true, data: response.data };
    } else {
      console.error(`❌ Error en respuesta de Sofmex: ${response.statusText}`);
      return { success: false, error: `Error al enviar SMS: ${response.statusText}` };
    }
  } catch (error: any) {
    console.error('❌ Error enviando SMS con Sofmex:', error.message);
    return { success: false, error: `Error al enviar SMS: ${error.message}` };
  }
}

/**
 * Envía un SMS individual
 */
export async function sendSingleSMS(
  numero: string, 
  mensaje: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  return sendBulkSMS([numero], mensaje);
}

/**
 * Valida formato de número de teléfono
 */
export function validatePhoneNumber(numero: string): boolean {
  // Permite números con o sin prefijo de país
  const phoneRegex = /^(\+\d{1,3})?\d{10}$/;
  return phoneRegex.test(numero.replace(/\s/g, ''));
}

/**
 * Normaliza números de teléfono agregando prefijo si es necesario
 */
export function normalizePhoneNumber(numero: string, defaultPrefix: string = '+52'): string {
  // Remover espacios
  const cleanNumber = numero.replace(/\s/g, '');
  
  // Si ya tiene prefijo, devolverlo tal como está
  if (cleanNumber.startsWith('+')) {
    return cleanNumber;
  }
  
  // Si es un número de 10 dígitos, agregar el prefijo por defecto
  if (/^\d{10}$/.test(cleanNumber)) {
    return `${defaultPrefix}${cleanNumber}`;
  }
  
  // Si es un número de más de 10 dígitos, asumir que ya incluye código de país
  return `+${cleanNumber}`;
}

/**
 * Procesa una lista de números separados por comas
 */
export function parsePhoneNumbers(numbersString: string, defaultPrefix: string = '+52'): string[] {
  return numbersString
    .split(',')
    .map(num => num.trim())
    .filter(num => num.length > 0)
    .map(num => normalizePhoneNumber(num, defaultPrefix))
    .filter(num => validatePhoneNumber(num));
}

/**
 * Valida el mensaje SMS
 */
export function validateSMSMessage(mensaje: string): { valid: boolean; error?: string } {
  if (!mensaje || mensaje.trim().length === 0) {
    return { valid: false, error: 'El mensaje no puede estar vacío' };
  }
  
  if (mensaje.length > 160) {
    return { valid: false, error: `El mensaje es demasiado largo (${mensaje.length}/160 caracteres)` };
  }
  
  return { valid: true };
}