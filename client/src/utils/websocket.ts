/**
 * Creates a WebSocket connection to the server with the proper protocol
 * @param path The WebSocket endpoint path
 * @returns A new WebSocket instance
 */
export function createSocketConnection(path: string): WebSocket {
  try {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    
    // Check if we're running in a Replit environment
    const isReplit = window.location.hostname.includes('replit') || 
                     window.location.hostname.endsWith('.repl.co');
    
    // For Replit, use the full hostname to ensure proper WebSocket connection
    const wsUrl = `${protocol}//${window.location.host}${path}`;
    
    console.log(`Establishing WebSocket connection to: ${wsUrl}`, {
      isReplit,
      host: window.location.host,
      hostname: window.location.hostname,
      path,
      protocol
    });
    
    const ws = new WebSocket(wsUrl);
    
    // Add event listeners for debugging with enhanced information
    ws.addEventListener('open', () => {
      console.log(`WebSocket connection established successfully to: ${wsUrl}`);
      
      // Send an immediate PING to keep the connection alive
      try {
        ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
      } catch (e) {
        console.warn('Error sending initial ping:', e);
      }
    });
    
    ws.addEventListener('error', (error) => {
      console.error(`WebSocket connection error to ${wsUrl}:`, error);
    });
    
    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
          console.log('Ping enviado para mantener conexión activa');
        } catch (e) {
          console.warn('Error sending ping:', e);
        }
      } else {
        console.log(`No se envía ping - estado WebSocket: ${
          ws.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
          ws.readyState === WebSocket.CLOSING ? 'CLOSING' :
          ws.readyState === WebSocket.CLOSED ? 'CLOSED' : 'DESCONOCIDO'
        }`);
      }
    }, 30000); // Ping cada 30 segundos
    
    // Clean up interval when connection closes
    ws.addEventListener('close', () => {
      clearInterval(pingInterval);
    });
    
    return ws;
  } catch (error) {
    console.error("Error creating WebSocket connection:", error);
    
    // Create a dummy WebSocket that will automatically trigger error handlers
    // Note: This is a workaround to prevent app crashes, but we now add more
    // diagnostic information to help troubleshoot connection issues
    const dummyWs = new WebSocket('ws://localhost');
    
    console.error("Using fallback WebSocket. Connection details:", {
      host: window.location.host,
      hostname: window.location.hostname,
      path,
      protocol: window.location.protocol,
      href: window.location.href,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return dummyWs;
  }
}
