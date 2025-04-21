import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScanSuccess: (qrData: string) => void;
  onCancel: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onCancel }) => {
  const [scanning, setScanning] = useState<boolean>(false);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrBoxId = "qr-reader";

  // Iniciar el escáner
  const startScanner = async () => {
    try {
      setScanning(true);
      setError(null);

      // Comprobamos primero si tenemos permisos de cámara
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Cerramos el stream inmediatamente, solo necesitábamos verificar los permisos
      stream.getTracks().forEach(track => track.stop());

      // Inicializar el escáner HTML5
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(qrBoxId);
      }

      const qrCodeSuccessCallback = (decodedText: string) => {
        // Detener el escáner después de un escaneo exitoso
        stopScanner();
        onScanSuccess(decodedText);
      };

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      // Iniciar el escáner con la cámara trasera preferiblemente
      await scannerRef.current.start(
        { facingMode: "environment" }, 
        config, 
        qrCodeSuccessCallback, 
        undefined
      );
    } catch (err: any) {
      console.error("Error al iniciar el escáner:", err);
      
      // Verificar si el error es por negación de permisos
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setError("No se otorgaron permisos para acceder a la cámara");
      } else {
        setError(`Error: ${err.message || "No se pudo iniciar el escáner QR"}`);
      }
      
      setScanning(false);
    }
  };

  // Detener el escáner
  const stopScanner = async () => {
    if (scannerRef.current && scanning) {
      try {
        await scannerRef.current.stop();
      } catch (error) {
        console.error("Error al detener el escáner:", error);
      }
    }
    setScanning(false);
  };

  // Limpiar al desmontar el componente
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl font-bold mb-3">Escanea el QR de tu tarjeta para identificarte</h2>
      <p className="mb-4">Posiciona el código QR dentro del recuadro para escanearlo</p>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          {permissionDenied && (
            <p className="mt-2 text-sm">
              Para usar esta función, debes permitir el acceso a la cámara en la configuración de tu navegador.
            </p>
          )}
        </div>
      )}

      <div className="relative mb-4 border-2 border-dashed border-gray-300 rounded-lg p-1">
        <div id={qrBoxId} className="w-80 h-80 bg-gray-100 rounded"></div>
        {!scanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
            <p className="text-white font-bold">Cámara desactivada</p>
          </div>
        )}
      </div>

      <div className="flex space-x-4">
        {!scanning ? (
          <Button 
            className="bg-orange-500 hover:bg-orange-600" 
            onClick={startScanner}
          >
            Iniciar cámara
          </Button>
        ) : (
          <Button 
            className="bg-red-500 hover:bg-red-600"
            onClick={stopScanner}
          >
            Detener cámara
          </Button>
        )}
        <Button 
          variant="outline" 
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
};

export default QRScanner;