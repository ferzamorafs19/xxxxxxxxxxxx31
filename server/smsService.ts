import axios from 'axios';

// URLs de las APIs SMS
const SOFMEX_LOGIN_URL = 'https://www.sofmex.com/api/login';
const SOFMEX_SMS_URL = 'https://www.sofmex.com/api/sms/v3/asignacion';
const ANKAREX_SMS_URL = 'https://rest.ankarex.ltd';

// Credenciales desde variables de entorno
const SOFMEX_USERNAME = process.env.SOFMEX_USERNAME;
const SOFMEX_PASSWORD = process.env.SOFMEX_PASSWORD;
const ANKAREX_API_TOKEN = 'MSL3-YQPV-M4LP-ACF3-HNHG-ZMLR-QR7J-6S8U';

// Credenciales de eims (ruta premium)
const EIMS_AUTH_NAME = process.env.EIMS_AUTH_NAME;
const EIMS_API_KEY = process.env.EIMS_API_KEY;
const EIMS_SMS_URL = 'https://ws.mxims.com/api/sendsms';

// Enum para tipos de rutas SMS
export enum SmsRouteType {
  SHORT_CODE = 'short_code', // 1 crédito - Sofmex (ruta actual)
  LONG_CODE = 'long_code',   // 0.5 crédito - Ankarex (nueva ruta)
  PREMIUM = 'premium'        // 1 crédito - eims (ruta premium)
}

if (!SOFMEX_USERNAME || !SOFMEX_PASSWORD) {
  console.warn('⚠️ Las credenciales de Sofmex no están configuradas');
}

/**
 * Obtiene el token de autenticación de Sofmex
 */
export async function getSofmexToken(): Promise<string | null> {
  try {
    console.log('🔑 Solicitando token de Sofmex con credenciales:', { 
      username: SOFMEX_USERNAME, 
      passwordSet: !!SOFMEX_PASSWORD,
      url: SOFMEX_LOGIN_URL 
    });
    
    const response = await axios.post(SOFMEX_LOGIN_URL, null, {
      params: {
        username: SOFMEX_USERNAME,
        password: SOFMEX_PASSWORD
      },
      timeout: 30000
    });
    
    console.log('📡 Respuesta de login Sofmex:', { 
      status: response.status, 
      data: response.data 
    });
    
    if (response.status === 200 && response.data) {
      console.log('✅ Token de Sofmex obtenido exitosamente');
      return response.data.message; // Token en "message"
    }
    
    console.error('❌ Error obteniendo token de Sofmex: Respuesta inválida');
    return null;
  } catch (error: any) {
    console.error('❌ Error obteniendo token de Sofmex:', error.message);
    if (error.response) {
      console.error('Respuesta de error:', error.response.data);
    }
    return null;
  }
}

/**
 * Envía SMS en lote usando la ruta Ankarex (Long Code - 0.5 crédito)
 */
export async function sendBulkSMSAnkarex(
  numeros: string[], 
  mensaje: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log(`📱 Enviando SMS vía Ankarex (Long Code) a ${numeros.length} números`);
    
    // Crear lista de números en formato string separado por comas
    const numerosString = numeros.join(',');
    
    console.log(`📤 Enviando a Ankarex API...`);
    console.log('📋 Números:', numerosString);
    console.log('💬 Mensaje:', mensaje);
    
    const response = await axios.post(ANKAREX_SMS_URL, {
      token: ANKAREX_API_TOKEN,
      send: "bulk",
      to: numerosString,
      sender_id: "SMS",
      message_content: mensaje,
      unicode: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Ankarex-Rest-0.22'
      },
      timeout: 30000
    });
    
    console.log('📡 Ankarex Response Status:', response.status);
    console.log('📡 Ankarex Response Data:', response.data);
    
    if (response.status === 200 && response.data) {
      // Verificar respuestas exitosas de Ankarex
      const isSuccess = (
        (response.data.error === "false") || 
        (response.data.info === "SENT") || 
        (response.data.info === "CAMPAIGN_SENT") ||
        (response.data.campaign_id)
      );
      
      if (isSuccess) {
        const campaignId = response.data.id || response.data.campaign_id || 'N/A';
        console.log(`✅ SMS enviados exitosamente vía Ankarex. Campaign ID: ${campaignId}`);
        return { success: true, data: response.data };
      } else {
        console.log(`❌ Error en Ankarex API: ${response.data.info || 'Error desconocido'}`);
        return { success: false, error: response.data.info || 'Error en el envío vía Ankarex' };
      }
    } else {
      console.log(`⚠️ Respuesta no exitosa de Ankarex:`, response.data);
      return { success: false, error: 'Error en la API de Ankarex' };
    }
  } catch (error: any) {
    console.error(`❌ Error enviando SMS vía Ankarex:`, error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
}

/**
 * Envía SMS en lote usando la ruta eims (Premium - 1 crédito)
 */
export async function sendBulkSMSeims(
  numeros: string[], 
  mensaje: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log(`📱 Enviando SMS vía eims (Premium) a ${numeros.length} números`);
    
    if (!EIMS_AUTH_NAME || !EIMS_API_KEY) {
      console.error('❌ Las credenciales de eims no están configuradas');
      return { success: false, error: 'Credenciales de eims no configuradas' };
    }
    
    console.log(`📤 Enviando a eims API...`);
    console.log('📋 Números:', numeros);
    console.log('💬 Mensaje:', mensaje);
    
    // Crear lista de números en formato string separado por comas
    const numerosString = numeros.join(',');
    
    const response = await axios.post(EIMS_SMS_URL, {
      authname: EIMS_AUTH_NAME,
      apikey: EIMS_API_KEY,
      mobile: numerosString,
      message: mensaje,
      sender: "SMS",
      route: "1" // Ruta premium
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('📡 eims Response Status:', response.status);
    console.log('📡 eims Response Data:', response.data);
    
    if (response.status === 200 && response.data) {
      // Verificar respuestas exitosas de eims
      const isSuccess = (
        response.data.status === "success" || 
        response.data.status === "OK" ||
        response.data.message_id ||
        response.data.result === "success"
      );
      
      if (isSuccess) {
        const messageId = response.data.message_id || response.data.id || 'N/A';
        console.log(`✅ SMS enviados exitosamente vía eims. Message ID: ${messageId}`);
        return { success: true, data: response.data };
      } else {
        console.log(`❌ Error en eims API: ${response.data.message || response.data.error || 'Error desconocido'}`);
        return { success: false, error: response.data.message || response.data.error || 'Error en el envío vía eims' };
      }
    } else {
      console.log(`⚠️ Respuesta no exitosa de eims:`, response.data);
      return { success: false, error: 'Error en la API de eims' };
    }
  } catch (error: any) {
    console.error(`❌ Error enviando SMS vía eims:`, error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
}

/**
 * Envía SMS en lote usando la ruta Sofmex (Short Code - 1 crédito)
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
    console.log('📋 Datos del envío:', JSON.stringify(data, null, 2));
    console.log('🔐 Headers:', headers);

    const response = await axios.post(SOFMEX_SMS_URL, data, {
      headers: headers,
      timeout: 60000 // Timeout aumentado para lotes grandes
    });

    console.log('📡 Respuesta completa de envío SMS:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data
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
  // Solo números de 10 dígitos sin prefijo (igual que el código del bot que funciona)
  const cleanNumber = numero.replace(/\s/g, '').replace(/^\+\d{1,3}/, '');
  return /^\d{10}$/.test(cleanNumber);
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
 * Función unificada para enviar SMS con selección automática de ruta
 */
export async function sendSMSWithRoute(
  numeros: string[], 
  mensaje: string,
  routeType: SmsRouteType = SmsRouteType.SHORT_CODE
): Promise<{ success: boolean; data?: any; error?: string; creditCost: number }> {
  console.log(`📱 Enviando SMS usando ruta: ${routeType}`);
  
  let result;
  let creditCost;
  
  if (routeType === SmsRouteType.LONG_CODE) {
    // Usar Ankarex (0.5 crédito por mensaje)
    result = await sendBulkSMSAnkarex(numeros, mensaje);
    creditCost = numeros.length * 0.5;
  } else if (routeType === SmsRouteType.PREMIUM) {
    // Usar eims (1 crédito por mensaje) - ruta premium
    result = await sendBulkSMSeims(numeros, mensaje);
    creditCost = numeros.length * 1;
  } else {
    // Usar Sofmex (1 crédito por mensaje) - ruta por defecto
    result = await sendBulkSMS(numeros, mensaje);
    creditCost = numeros.length;
  }
  
  return {
    ...result,
    creditCost
  };
}

/**
 * Obtiene el costo en créditos para un envío
 */
export function calculateCreditCost(numeroCount: number, routeType: SmsRouteType): number {
  if (routeType === SmsRouteType.LONG_CODE) {
    return numeroCount * 0.5;
  } else if (routeType === SmsRouteType.PREMIUM) {
    return numeroCount * 1;
  } else {
    return numeroCount;
  }
}

/**
 * Procesa una lista de números separados por comas (igual que el código del bot que funciona)
 */
export function parsePhoneNumbers(numbersString: string, defaultPrefix: string = '+52'): string[] {
  const numeros = numbersString.split(',').map(n => n.trim()).filter(n => /^\d{10}$/.test(n));
  console.log(`📱 Números procesados: ${numeros.length} de entrada: "${numbersString}"`);
  console.log(`📋 Números válidos:`, numeros);
  
  // Agregar prefijo a números válidos
  return numeros.map(numero => `${defaultPrefix}${numero}`);
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