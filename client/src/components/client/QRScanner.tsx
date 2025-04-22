import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Html5Qrcode } from 'html5-qrcode';
import { toPng } from 'html-to-image';
import plataCardLogo from '@assets/Plata_Card_Logo.png';

interface QRScannerProps {
  onScanSuccess: (qrData: string, qrImageData?: string) => void;
  onCancel: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onCancel }) => {
  const [scanning, setScanning] = useState<boolean>(false);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedQR, setCapturedQR] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrBoxId = "qr-reader";
  const captureRef = useRef<HTMLDivElement>(null);

  // Función para capturar la imagen del QR como base64 directamente de la cámara
  const captureQRImage = async (qrData: string) => {
    try {
      // Capturar la vista actual del escáner QR
      if (captureRef.current) {
        // Crear un contenedor personalizado para la captura que incluya el QR y metadata
        const captureContainer = document.createElement('div');
        captureContainer.className = "qr-capture-container";
        captureContainer.style.width = '320px';
        captureContainer.style.height = '420px';
        captureContainer.style.backgroundColor = 'white';
        captureContainer.style.padding = '15px';
        captureContainer.style.borderRadius = '10px';
        captureContainer.style.boxSizing = 'border-box';
        captureContainer.style.display = 'flex';
        captureContainer.style.flexDirection = 'column';
        captureContainer.style.alignItems = 'center';
        
        // Añadir logo y título
        const titleContainer = document.createElement('div');
        titleContainer.style.marginBottom = '15px';
        titleContainer.style.textAlign = 'center';
        titleContainer.style.display = 'flex';
        titleContainer.style.flexDirection = 'column';
        titleContainer.style.alignItems = 'center';
        
        // Agregar logo de Plata Card
        const logo = document.createElement('img');
        logo.src = plataCardLogo;
        logo.style.width = '120px';
        logo.style.marginBottom = '10px';
        
        const date = document.createElement('div');
        date.textContent = new Date().toLocaleString();
        date.style.fontSize = '12px';
        date.style.color = '#666';
        date.style.marginTop = '5px';
        
        titleContainer.appendChild(logo);
        titleContainer.appendChild(date);
        
        // Clonar el elemento del escáner para la captura
        const qrViewClone = captureRef.current.cloneNode(true) as HTMLElement;
        qrViewClone.style.width = '280px';
        qrViewClone.style.height = '280px';
        qrViewClone.style.border = '1px solid #ccc';
        qrViewClone.style.borderRadius = '5px';
        qrViewClone.style.overflow = 'hidden';
        
        // Añadir sección para el texto del QR
        const qrDataContainer = document.createElement('div');
        qrDataContainer.style.marginTop = '15px';
        qrDataContainer.style.width = '100%';
        qrDataContainer.style.padding = '10px';
        qrDataContainer.style.backgroundColor = '#f0f0f0';
        qrDataContainer.style.borderRadius = '5px';
        qrDataContainer.style.fontSize = '12px';
        qrDataContainer.style.wordBreak = 'break-all';
        qrDataContainer.style.maxHeight = '60px';
        qrDataContainer.style.overflow = 'hidden';
        qrDataContainer.textContent = qrData;
        
        // Construir la estructura completa
        captureContainer.appendChild(titleContainer);
        captureContainer.appendChild(qrViewClone);
        captureContainer.appendChild(qrDataContainer);
        
        // Añadir al DOM temporalmente
        document.body.appendChild(captureContainer);
        
        // Tomar la captura
        const dataUrl = await toPng(captureContainer);
        
        // Eliminar del DOM
        document.body.removeChild(captureContainer);
        
        return dataUrl;
      }
      
      // Si no se pudo acceder al elemento de la cámara, capturar solo los datos
      return null;
    } catch (error) {
      console.error('Error al capturar la imagen del QR:', error);
      return null;
    }
  };

  // Iniciar el escáner
  const startScanner = async () => {
    try {
      setScanning(true);
      setError(null);
      setCapturedQR(null);

      // Comprobamos primero si tenemos permisos de cámara
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Cerramos el stream inmediatamente, solo necesitábamos verificar los permisos
      stream.getTracks().forEach(track => track.stop());

      // Inicializar el escáner HTML5
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(qrBoxId);
      }

      const qrCodeSuccessCallback = async (decodedText: string) => {
        // Detener el escáner después de un escaneo exitoso
        stopScanner();
        setCapturedQR(decodedText);
        
        // Capturar la imagen del QR
        const qrImageData = await captureQRImage(decodedText);
        
        // Enviar el texto del QR y la imagen (si está disponible)
        onScanSuccess(decodedText, qrImageData || undefined);
      };

      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        formatsToSupport: ['QR_CODE']
      };

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
      <div className="flex flex-col items-center mb-4">
        <img src={plataCardLogo} alt="Plata Card Logo" className="h-16 mb-2" />
        <h2 className="text-xl font-bold">Escanea el QR de tu tarjeta para identificarte</h2>
        <p className="text-gray-600">Posiciona el código QR dentro del recuadro para escanearlo</p>
      </div>

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
        <div 
          id={qrBoxId} 
          className="w-80 h-80 bg-gray-100 rounded" 
          ref={captureRef}
          style={{ 
            filter: 'brightness(1.2) contrast(1.2)',  // Mejora la visibilidad del escáner
          }}
        ></div>
        {!scanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
            <p className="text-white font-bold">Cámara desactivada</p>
          </div>
        )}
      </div>

      {capturedQR && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          <p className="font-bold">QR escaneado correctamente</p>
          <p className="text-sm truncate w-80">{capturedQR}</p>
        </div>
      )}

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