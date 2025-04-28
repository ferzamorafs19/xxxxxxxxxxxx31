import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';

// Página de diagnóstico para identificar problemas de conexión y rutas
export default function DiagnosticPage() {
  const [location, setLocation] = useLocation();
  const [, params] = useRoute<{ sessionId: string }>('/:sessionId(\\d{8})');
  const [, paramsClient] = useRoute<{ sessionId: string }>('/client/:sessionId');

  const [wsStatus, setWsStatus] = useState<string>('Iniciando...');
  const [wsError, setWsError] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [sessionData, setSessionData] = useState<any>(null);

  // Información general del diagnóstico
  const detectedSessionId = params?.sessionId || paramsClient?.sessionId || 'No detectado';
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  const fullUrl = window.location.href;
  const isHttps = protocol === 'https:';
  const wsProtocol = isHttps ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${hostname}${port ? ':' + port : ''}/ws`;

  // Intentar establecer conexión WebSocket para diagnóstico
  useEffect(() => {
    try {
      setWsStatus('Conectando...');
      
      // Crear WebSocket
      const ws = new WebSocket(wsUrl);
      
      ws.addEventListener('open', () => {
        setWsStatus('Conectado');
        
        // Si tenemos un sessionId, intentar obtener información de sesión
        if (detectedSessionId && detectedSessionId !== 'No detectado') {
          ws.send(JSON.stringify({
            type: 'REGISTER',
            role: 'CLIENT',
            sessionId: detectedSessionId
          }));
        }
      });
      
      ws.addEventListener('error', (error) => {
        console.error('Error WebSocket:', error);
        setWsStatus('Error de conexión');
        setWsError('No se pudo establecer conexión con el servidor WebSocket');
      });
      
      ws.addEventListener('close', (event) => {
        setWsStatus(`Cerrado (${event.code})`);
      });
      
      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Mensaje recibido:', data);
          
          if (data.type === 'INIT_SESSION') {
            setSessionData(data.data);
          }
        } catch (error) {
          console.error('Error al procesar mensaje:', error);
        }
      });
      
      return () => {
        ws.close();
      };
    } catch (error) {
      console.error('Error al inicializar WebSocket:', error);
      setWsStatus('Error de inicialización');
      setWsError(error instanceof Error ? error.message : String(error));
    }
  }, [detectedSessionId, wsUrl]);
  
  // Obtener información del servidor
  useEffect(() => {
    fetch('/api/healthcheck')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Estado HTTP: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setServerInfo(data);
      })
      .catch(error => {
        console.error('Error al obtener información del servidor:', error);
        setServerInfo({ error: error.message });
      });
  }, []);

  return (
    <div className="bg-gray-100 min-h-screen p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6 text-blue-700">Diagnóstico de Sistema</h1>
        
        <div className="grid gap-6">
          {/* Información de URL y Ruta */}
          <section className="border rounded-lg p-4 bg-gray-50">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">Información de URL</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-medium text-gray-600">URL Completa:</p>
                <p className="font-mono bg-white p-2 rounded border text-sm">{fullUrl}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Protocolo:</p>
                <p className="font-mono bg-white p-2 rounded border text-sm">{protocol}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Hostname:</p>
                <p className="font-mono bg-white p-2 rounded border text-sm">{hostname}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Puerto:</p>
                <p className="font-mono bg-white p-2 rounded border text-sm">{port || '(por defecto)'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Ruta:</p>
                <p className="font-mono bg-white p-2 rounded border text-sm">{location}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Código de Sesión Detectado:</p>
                <p className="font-mono bg-white p-2 rounded border text-sm font-bold">{detectedSessionId}</p>
              </div>
            </div>
          </section>
          
          {/* Estado WebSocket */}
          <section className="border rounded-lg p-4 bg-gray-50">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">Estado WebSocket</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-medium text-gray-600">URL WebSocket:</p>
                <p className="font-mono bg-white p-2 rounded border text-sm">{wsUrl}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Estado:</p>
                <p className={`font-mono font-bold p-2 rounded border text-sm ${
                  wsStatus === 'Conectado' 
                    ? 'bg-green-100 text-green-800 border-green-200' 
                    : wsStatus.includes('Error') 
                      ? 'bg-red-100 text-red-800 border-red-200'
                      : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                }`}>{wsStatus}</p>
              </div>
              {wsError && (
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-600">Error:</p>
                  <p className="font-mono bg-red-50 text-red-800 p-2 rounded border border-red-200 text-sm">{wsError}</p>
                </div>
              )}
            </div>
          </section>
          
          {/* Información de la Sesión */}
          <section className="border rounded-lg p-4 bg-gray-50">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">Información de Sesión</h2>
            {sessionData ? (
              <div className="overflow-auto max-h-60">
                <pre className="font-mono text-xs bg-white p-3 rounded border">{JSON.stringify(sessionData, null, 2)}</pre>
              </div>
            ) : (
              <div className="bg-blue-50 text-blue-800 p-3 rounded border border-blue-200">
                <p>No hay información de sesión disponible.</p>
                <p className="text-xs mt-1">
                  {detectedSessionId === 'No detectado' 
                    ? 'No se ha detectado un código de sesión en la URL.'
                    : 'Esperando datos de la sesión desde el servidor...'}
                </p>
              </div>
            )}
          </section>
          
          {/* Información del Servidor */}
          <section className="border rounded-lg p-4 bg-gray-50">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">Información del Servidor</h2>
            {serverInfo ? (
              serverInfo.error ? (
                <div className="bg-red-50 text-red-800 p-3 rounded border border-red-200">
                  <p>Error al obtener información: {serverInfo.error}</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-60">
                  <pre className="font-mono text-xs bg-white p-3 rounded border">{JSON.stringify(serverInfo, null, 2)}</pre>
                </div>
              )
            ) : (
              <div className="bg-gray-200 p-3 rounded animate-pulse flex justify-center">
                Cargando información del servidor...
              </div>
            )}
          </section>
          
          {/* Acciones */}
          <section className="border rounded-lg p-4 bg-blue-50">
            <h2 className="text-xl font-semibold mb-3 text-blue-800">Acciones</h2>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Refrescar Diagnóstico
              </button>
              
              {detectedSessionId !== 'No detectado' && (
                <>
                  <button 
                    onClick={() => window.location.href = `/client/${detectedSessionId}`} 
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                  >
                    Abrir en Ruta /client/
                  </button>
                  
                  <button 
                    onClick={() => window.location.href = `/${detectedSessionId}`} 
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
                  >
                    Abrir en Ruta Directa
                  </button>
                </>
              )}
              
              <button 
                onClick={() => window.location.href = '/'} 
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
              >
                Volver al Inicio
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}