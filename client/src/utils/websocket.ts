/**
 * Creates a WebSocket connection to the server with the proper protocol
 * @param path The WebSocket endpoint path
 * @returns A new WebSocket instance
 */
export function createSocketConnection(path: string): WebSocket {
  try {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}${path}`;
    console.log(`Establishing WebSocket connection to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    
    // Add event listeners for debugging
    ws.addEventListener('open', () => {
      console.log(`WebSocket connection established successfully to: ${wsUrl}`);
    });
    
    ws.addEventListener('error', (error) => {
      console.error(`WebSocket connection error to ${wsUrl}:`, error);
    });
    
    return ws;
  } catch (error) {
    console.error("Error creating WebSocket connection:", error);
    // Return a dummy WebSocket that will automatically trigger error handlers
    // This prevents the app from crashing if WebSocket fails to initialize
    return new WebSocket('ws://localhost');
  }
}
