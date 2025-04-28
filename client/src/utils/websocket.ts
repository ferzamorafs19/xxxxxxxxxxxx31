/**
 * Creates a WebSocket connection to the server with the proper protocol
 * @param path The WebSocket endpoint path
 * @returns A new WebSocket instance
 */
export function createSocketConnection(path: string): WebSocket {
  try {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    
    // Check if we're running in various environments
    const isReplit = window.location.hostname.includes('replit') || 
                     window.location.hostname.endsWith('.repl.co') ||
                     window.location.hostname.endsWith('.replit.app');
    
    // Asegurarnos de que el path empiece con /
    const formattedPath = path.startsWith('/') ? path : `/${path}`;
    
    // Crear la URL del WebSocket
    const wsUrl = `${protocol}//${window.location.host}${formattedPath}`;
    
    console.log(`[WebSocket] Conectando a: ${wsUrl}`, {
      isReplit,
      host: window.location.host,
      hostname: window.location.hostname,
      path: formattedPath,
      protocol,
      timestamp: new Date().toISOString()
    });
    
    // Crear la conexión WebSocket
    const ws = new WebSocket(wsUrl);
    
    // Timeout para detectar si la conexión no se establece en tiempo razonable
    const connectTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn(`[WebSocket] Timeout de conexión después de 10 segundos: ${wsUrl}`);
        // No cerramos el socket para permitir que eventualmente conecte
      }
    }, 10000);
    
    // Add event listeners for debugging with enhanced information
    ws.addEventListener('open', (event) => {
      clearTimeout(connectTimeout);
      
      console.log(`[WebSocket] Conexión establecida con éxito: ${wsUrl}`, {
        timestamp: new Date().toISOString(),
        readyState: ws.readyState
      });
      
      // Send an immediate PING to keep the connection alive
      try {
        ws.send(JSON.stringify({ 
          type: 'PING', 
          timestamp: Date.now(),
          clientInfo: {
            url: window.location.href,
            userAgent: navigator.userAgent
          }
        }));
      } catch (e) {
        console.warn('[WebSocket] Error enviando ping inicial:', e);
      }
    });
    
    ws.addEventListener('error', (error) => {
      console.error(`[WebSocket] Error de conexión a ${wsUrl}:`, {
        error,
        timestamp: new Date().toISOString(),
        readyState: ws.readyState
      });
    });
    
    ws.addEventListener('close', (event) => {
      clearTimeout(connectTimeout);
      console.log(`[WebSocket] Conexión cerrada: Código ${event.code}`, {
        reason: event.reason || 'Sin razón especificada',
        wasClean: event.wasClean,
        timestamp: new Date().toISOString()
      });
    });
    
    // Set up ping interval to keep connection alive
    // Usamos un intervalo más corto (20s) para Replit
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ 
            type: 'PING', 
            timestamp: Date.now(),
            message: 'keep-alive'
          }));
          console.log('[WebSocket] Ping enviado para mantener conexión activa');
        } catch (e) {
          console.warn('[WebSocket] Error enviando ping:', e);
        }
      } else {
        const readyStateText = 
          ws.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
          ws.readyState === WebSocket.CLOSING ? 'CLOSING' :
          ws.readyState === WebSocket.CLOSED ? 'CLOSED' : 'DESCONOCIDO';
          
        console.log(`[WebSocket] No se envía ping - estado: ${readyStateText}`);
      }
    }, isReplit ? 15000 : 30000); // Ping más frecuente en Replit
    
    // Clean up interval when connection closes
    ws.addEventListener('close', () => {
      clearInterval(pingInterval);
    });
    
    return ws;
  } catch (error) {
    console.error("[WebSocket] Error crítico al crear conexión:", error);
    
    // Enviar información de diagnóstico
    try {
      const diagnosticData = {
        timestamp: new Date().toISOString(),
        location: window.location.href,
        userAgent: navigator.userAgent,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : String(error)
      };
      
      console.error("[WebSocket] Datos de diagnóstico:", diagnosticData);
      
      // Opcionalmente podríamos enviar esta información al servidor para diagnóstico
      // mediante una petición fetch si es necesario
    } catch (e) {
      // Ignorar errores en el reporte de errores
    }
    
    // Create a dummy WebSocket that will automatically trigger error handlers
    const dummyWs = new WebSocket('ws://localhost:1');
    
    // Hacer que el error sea más evidente
    setTimeout(() => {
      if (dummyWs.dispatchEvent) {
        const errorEvent = new Event('error');
        dummyWs.dispatchEvent(errorEvent);
        
        const closeEvent = new CloseEvent('close', { 
          code: 1011, 
          reason: 'Error crítico al crear la conexión WebSocket', 
          wasClean: false 
        });
        dummyWs.dispatchEvent(closeEvent);
      }
    }, 100);
    
    return dummyWs;
  }
}
