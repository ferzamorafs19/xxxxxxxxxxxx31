import { useState, useEffect, useCallback, useRef } from 'react';
import { createSocketConnection } from '@/utils/websocket';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'max-attempts';
type ConnectionError = null | { code?: number; message: string; timestamp: string };

export const useWebSocket = (path: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastError, setLastError] = useState<ConnectionError>(null);
  const [connectionInfo, setConnectionInfo] = useState<{
    url: string;
    attempts: number;
    reconnectTime?: number;
    lastMessageTime?: string;
  }>({ url: '', attempts: 0 });
  
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Create socket connection
  useEffect(() => {
    const createConnection = () => {
      // Actualizar estado a 'connecting'
      setStatus('connecting');
      
      // Construir la URL completa para información de diagnóstico
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}${path}`;
      
      // Actualizar información de conexión
      setConnectionInfo(prev => ({
        ...prev,
        url: wsUrl,
        attempts: reconnectAttemptsRef.current
      }));
      
      console.log(`Iniciando conexión WebSocket a: ${wsUrl} (intento ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS + 1})`);
      
      const ws = createSocketConnection(path);
      
      ws.addEventListener('open', () => {
        console.log(`WebSocket conectado exitosamente a: ${wsUrl}`);
        setConnected(true);
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
        setLastError(null);
        
        // Actualizar info de conexión
        setConnectionInfo(prev => ({
          ...prev,
          attempts: 0,
          reconnectTime: undefined,
          lastMessageTime: new Date().toISOString()
        }));
      });
      
      ws.addEventListener('close', (event) => {
        const message = `WebSocket cerrado: Código ${event.code} - ${event.reason || 'Sin razón especificada'}`;
        console.log(message);
        
        setConnected(false);
        setStatus('disconnected');
        
        // Registrar el error de cierre si no fue normal
        if (event.code !== 1000) {
          setLastError({
            code: event.code,
            message: event.reason || 'Conexión cerrada sin razón especificada',
            timestamp: new Date().toISOString()
          });
        }
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const timeout = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
          console.log(`Intentando reconectar en ${timeout}ms...`);
          
          // Actualizar info para mostrar tiempo de reconexión
          setConnectionInfo(prev => ({
            ...prev,
            reconnectTime: timeout
          }));
          
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            createConnection();
          }, timeout);
        } else {
          const maxAttemptsMessage = 'Número máximo de intentos de reconexión alcanzado.';
          console.error(maxAttemptsMessage);
          setStatus('max-attempts');
          setLastError({
            code: -1,
            message: maxAttemptsMessage,
            timestamp: new Date().toISOString()
          });
        }
      });
      
      ws.addEventListener('error', (error) => {
        const errorMessage = `Error de WebSocket: ${error.toString()}`;
        console.error(errorMessage, error);
        
        setStatus('error');
        setLastError({
          message: errorMessage,
          timestamp: new Date().toISOString()
        });
      });
      
      // Actualizar cuando recibimos mensajes para diagnóstico
      ws.addEventListener('message', () => {
        setConnectionInfo(prev => ({
          ...prev,
          lastMessageTime: new Date().toISOString()
        }));
      });
      
      setSocket(ws);
    };
    
    createConnection();
    
    return () => {
      if (socket) {
        // Imprimimos el estado antes de cerrar para diagnóstico
        console.log(`Cerrando conexión WebSocket. Estado actual: ${
          socket.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
          socket.readyState === WebSocket.OPEN ? 'OPEN' :
          socket.readyState === WebSocket.CLOSING ? 'CLOSING' :
          socket.readyState === WebSocket.CLOSED ? 'CLOSED' : 'DESCONOCIDO'
        }`);
        
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close(1000, 'Cierre normal por cambio de componente');
        }
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Actualizar estado al desmontar
      setStatus('disconnected');
    };
  }, [path]);

  // Send message function
  const sendMessage = useCallback((data: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, [socket]);

  return { 
    socket, 
    connected, 
    sendMessage,
    status,
    lastError,
    connectionInfo
  };
};
