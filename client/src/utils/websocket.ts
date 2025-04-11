/**
 * Creates a WebSocket connection to the server with the proper protocol
 * @param path The WebSocket endpoint path or complete URL
 * @returns A new WebSocket instance
 */
export function createSocketConnection(path: string): WebSocket {
  // Si el path comienza con ws: o wss:, es una URL completa
  if (path.startsWith('ws:') || path.startsWith('wss:')) {
    console.log('Conectando a WebSocket con URL completa:', path);
    return new WebSocket(path);
  }
  
  // De lo contrario, construir la URL basada en el host actual
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}${path}`;
  console.log('Conectando a WebSocket con URL relativa:', wsUrl);
  return new WebSocket(wsUrl);
}
