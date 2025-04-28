import { useState, useEffect, useCallback, useRef } from 'react';
import { createSocketConnection } from '@/utils/websocket';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'max-attempts';
type ConnectionError = null | { code?: number; message: string; timestamp: string };

// Constantes para la reconexión con backoff exponencial
const MAX_RECONNECT_ATTEMPTS = 10; // Más intentos para mejor tolerancia a fallos
const BASE_RETRY_MS = 1000; // 1 segundo inicial
const MAX_RETRY_MS = 30000; // Máximo 30 segundos entre intentos

// Constantes para ping/pong
const PING_INTERVAL_MS = 15000; // 15 segundos entre pings
const PONG_TIMEOUT_MS = 10000; // 10 segundos para recibir un pong antes de considerar la conexión caída

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
    lastPingSent?: number;
    lastPongReceived?: number;
    missedPongs: number;
  }>({ url: '', attempts: 0, missedPongs: 0 });
  
  // Referencias para manejar intervalos y timeouts
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastPingSentRef = useRef<number | null>(null);
  const missedPongsRef = useRef(0);

  // Función para limpiar todos los timers
  const clearAllTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
  }, []);
  
  // Función para enviar un ping de forma segura 
  const sendPing = useCallback(() => {
    const currentSocket = socketRef.current;
    if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) return;
    
    try {
      const now = Date.now();
      lastPingSentRef.current = now;
      
      currentSocket.send(JSON.stringify({ 
        type: 'PING', 
        timestamp: now,
        message: 'keep-alive',
        attempt: missedPongsRef.current
      }));
      
      console.log('[WebSocket] Ping enviado.');
      
      // Actualizamos la info de conexión
      setConnectionInfo(prev => ({
        ...prev,
        lastPingSent: now
      }));
      
      // Establecemos un timeout para detectar si no recibimos el pong
      if (pongTimeoutRef.current) {
        clearTimeout(pongTimeoutRef.current);
      }
      
      pongTimeoutRef.current = setTimeout(() => {
        // Si no recibimos un pong en el tiempo esperado, consideramos que
        // la conexión puede estar caída y aumentamos el contador
        missedPongsRef.current++;
        
        console.warn(`[WebSocket] No se recibió pong después de ${PONG_TIMEOUT_MS}ms. ` +
          `Pongs perdidos: ${missedPongsRef.current}`);
          
        setConnectionInfo(prev => ({
          ...prev,
          missedPongs: missedPongsRef.current
        }));
        
        // Si perdemos demasiados pongs consecutivos, forzamos una reconexión
        if (missedPongsRef.current >= 3) {
          console.error('[WebSocket] Demasiados pongs perdidos, forzando reconexión');
          
          const ws = socketRef.current;
          if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            ws.close(4000, 'Forzando reconexión por falta de respuesta');
          }
        }
      }, PONG_TIMEOUT_MS);
      
    } catch (e) {
      console.warn('[WebSocket] Error enviando ping:', e);
    }
  }, []);
  
  // Función para iniciar el sistema de ping/pong
  const startPingSystem = useCallback(() => {
    // Limpiar cualquier intervalo existente
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    // Resetear los contadores
    missedPongsRef.current = 0;
    
    // Iniciar un nuevo intervalo de ping
    pingIntervalRef.current = setInterval(sendPing, PING_INTERVAL_MS);
    
    // Enviar un ping inmediatamente
    sendPing();
  }, [sendPing]);
  
  // Función para procesar un pong recibido
  const handlePong = useCallback((timestamp: number) => {
    const now = Date.now();
    const latency = lastPingSentRef.current ? now - lastPingSentRef.current : -1;
    
    console.log(`[WebSocket] Pong recibido. Latencia: ${latency}ms`);
    
    // Reseteamos los contadores de pings perdidos
    missedPongsRef.current = 0;
    
    // Limpiamos el timeout de pong pendiente
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
    
    // Actualizamos la información de conexión
    setConnectionInfo(prev => ({
      ...prev,
      lastPongReceived: now,
      missedPongs: 0
    }));
  }, []);

  // Create socket connection
  useEffect(() => {
    const createConnection = () => {
      // Limpiar cualquier conexión existente
      clearAllTimers();
      
      // Actualizar estado a 'connecting'
      setStatus('connecting');
      
      // Construir la URL completa para información de diagnóstico
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}${path}`;
      
      // Actualizar información de conexión
      setConnectionInfo(prev => ({
        ...prev,
        url: wsUrl,
        attempts: reconnectAttemptsRef.current,
        missedPongs: 0
      }));
      
      console.log(`[WebSocket] Iniciando conexión a: ${wsUrl} (intento ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS + 1})`);
      
      // Crear la conexión
      const ws = createSocketConnection(path);
      socketRef.current = ws;
      
      ws.addEventListener('open', () => {
        console.log(`[WebSocket] Conectado exitosamente a: ${wsUrl}`);
        
        // Actualizar estados
        setConnected(true);
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
        missedPongsRef.current = 0;
        setLastError(null);
        
        // Actualizar info de conexión
        setConnectionInfo(prev => ({
          ...prev,
          attempts: 0,
          reconnectTime: undefined,
          lastMessageTime: new Date().toISOString(),
          missedPongs: 0
        }));
        
        // Iniciar sistema de ping/pong
        startPingSystem();
      });
      
      ws.addEventListener('close', (event) => {
        const message = `[WebSocket] Cerrado: Código ${event.code} - ${event.reason || 'Sin razón especificada'}`;
        console.log(message);
        
        // Limpiar todos los timers
        clearAllTimers();
        
        // Actualizar estados
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
          const timeout = Math.min(BASE_RETRY_MS * (1.5 ** reconnectAttemptsRef.current), MAX_RETRY_MS);
          console.log(`[WebSocket] Intentando reconectar en ${timeout}ms...`);
          
          // Actualizar info para mostrar tiempo de reconexión
          setConnectionInfo(prev => ({
            ...prev,
            reconnectTime: timeout
          }));
          
          // Programar el intento de reconexión
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            createConnection();
          }, timeout);
        } else {
          const maxAttemptsMessage = '[WebSocket] Número máximo de intentos de reconexión alcanzado.';
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
        const errorMessage = `[WebSocket] Error: ${error.toString()}`;
        console.error(errorMessage, error);
        
        setStatus('error');
        setLastError({
          message: errorMessage,
          timestamp: new Date().toISOString()
        });
      });
      
      // Manejar mensajes WebSocket
      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Actualizar timestamp para diagnóstico
          setConnectionInfo(prev => ({
            ...prev,
            lastMessageTime: new Date().toISOString()
          }));
          
          // Manejar mensaje PONG del servidor
          if (data.type === 'PONG') {
            handlePong(data.timestamp);
            return;
          }
          
          // Los otros tipos de mensajes se manejan en los componentes
        } catch (e) {
          console.warn('[WebSocket] Error procesando mensaje:', e);
        }
      });
      
      setSocket(ws);
    };
    
    // Iniciar la conexión
    createConnection();
    
    // Limpiar al desmontar
    return () => {
      const currentSocket = socketRef.current;
      if (currentSocket) {
        // Registrar cierre para diagnóstico
        console.log(`[WebSocket] Cerrando conexión. Estado actual: ${
          currentSocket.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
          currentSocket.readyState === WebSocket.OPEN ? 'OPEN' :
          currentSocket.readyState === WebSocket.CLOSING ? 'CLOSING' :
          currentSocket.readyState === WebSocket.CLOSED ? 'CLOSED' : 'DESCONOCIDO'
        }`);
        
        // Cerrar la conexión apropiadamente
        if (currentSocket.readyState === WebSocket.OPEN || 
            currentSocket.readyState === WebSocket.CONNECTING) {
          currentSocket.close(1000, 'Cierre normal por cambio de componente');
        }
      }
      
      // Limpiar todos los timers
      clearAllTimers();
      
      // Actualizar estado
      setStatus('disconnected');
    };
  }, [path, clearAllTimers, startPingSystem, handlePong]);

  // Send message function with enhanced error handling
  const sendMessage = useCallback((data: any) => {
    const currentSocket = socketRef.current;
    
    if (!currentSocket) {
      console.warn('[WebSocket] No hay conexión disponible para enviar mensaje.');
      return false;
    }
    
    if (currentSocket.readyState !== WebSocket.OPEN) {
      console.warn(`[WebSocket] No se puede enviar mensaje - socket en estado: ${
        currentSocket.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
        currentSocket.readyState === WebSocket.CLOSING ? 'CLOSING' :
        currentSocket.readyState === WebSocket.CLOSED ? 'CLOSED' : 'DESCONOCIDO'
      }`);
      return false;
    }
    
    try {
      const message = JSON.stringify(data);
      currentSocket.send(message);
      return true;
    } catch (error) {
      console.error('[WebSocket] Error enviando mensaje:', error);
      return false;
    }
  }, []);

  // Función para forzar la reconexión manualmente
  const reconnect = useCallback(() => {
    console.log('[WebSocket] Forzando reconexión manual...');
    
    const currentSocket = socketRef.current;
    if (currentSocket) {
      if (currentSocket.readyState === WebSocket.OPEN || 
          currentSocket.readyState === WebSocket.CONNECTING) {
        currentSocket.close(3000, 'Reconexión manual solicitada');
      }
    }
    
    // Limpiar timers existentes
    clearAllTimers();
    
    // Reiniciar contadores
    reconnectAttemptsRef.current = 0;
    missedPongsRef.current = 0;
    
    // Crear nueva conexión inmediatamente
    socketRef.current = createSocketConnection(path);
    setSocket(socketRef.current);
    
    // Reiniciar estado
    setStatus('connecting');
    
    return true;
  }, [path, clearAllTimers]);

  return { 
    socket, 
    connected, 
    sendMessage,
    status,
    lastError,
    connectionInfo,
    reconnect  // Exportamos la función de reconexión manual
  };
};
