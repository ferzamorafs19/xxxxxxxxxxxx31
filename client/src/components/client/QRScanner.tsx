import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Html5Qrcode } from 'html5-qrcode';
import { toPng } from 'html-to-image';

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

  // Función para capturar la imagen del QR como base64
  const captureQRImage = async (qrData: string) => {
    try {
      // Crear un elemento para mostrar el QR escaneado
      const qrContainer = document.createElement('div');
      qrContainer.style.width = '300px';
      qrContainer.style.height = '300px';
      qrContainer.style.backgroundColor = 'white';
      qrContainer.style.display = 'flex';
      qrContainer.style.flexDirection = 'column';
      qrContainer.style.alignItems = 'center';
      qrContainer.style.justifyContent = 'center';
      qrContainer.style.padding = '20px';
      qrContainer.style.boxSizing = 'border-box';
      
      // Añadir el texto del QR
      const qrText = document.createElement('div');
      qrText.textContent = qrData;
      qrText.style.wordBreak = 'break-all';
      qrText.style.fontSize = '14px';
      qrText.style.marginTop = '20px';
      qrText.style.width = '100%';
      qrText.style.textAlign = 'center';
      
      // Añadir un título
      const title = document.createElement('div');
      title.textContent = 'QR Escaneado - Plata Card';
      title.style.fontWeight = 'bold';
      title.style.fontSize = '16px';
      title.style.marginBottom = '20px';
      
      // Crear un borde para simular el QR
      const qrImage = document.createElement('div');
      qrImage.style.width = '200px';
      qrImage.style.height = '200px';
      qrImage.style.border = '2px solid black';
      qrImage.style.position = 'relative';
      
      // Crear un patrón tipo QR con CSS
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const qrBlock = document.createElement('div');
          qrBlock.style.position = 'absolute';
          qrBlock.style.width = '40px';
          qrBlock.style.height = '40px';
          qrBlock.style.backgroundColor = Math.random() > 0.5 ? 'black' : 'transparent';
          qrBlock.style.left = `${j * 50}px`;
          qrBlock.style.top = `${i * 50}px`;
          qrImage.appendChild(qrBlock);
        }
      }
      
      // Añadir elementos al contenedor
      qrContainer.appendChild(title);
      qrContainer.appendChild(qrImage);
      qrContainer.appendChild(qrText);
      
      // Añadir a DOM temporalmente
      document.body.appendChild(qrContainer);
      
      // Capturar como PNG
      const dataUrl = await toPng(qrContainer);
      
      // Eliminar del DOM
      document.body.removeChild(qrContainer);
      
      return dataUrl;
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