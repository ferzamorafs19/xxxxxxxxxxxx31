import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QrCode, Download, Copy, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function QRGenerator() {
  const [inputText, setInputText] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Función para validar que el input sea solo números
  const validateInput = (input: string) => {
    return /^\d*$/.test(input);
  };

  // Función para generar el código QR
  const generateQR = async () => {
    if (!inputText) {
      toast({
        title: "Error al generar QR",
        description: "Debes ingresar un número para generar el código QR",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const url = await QRCode.toDataURL(inputText, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        }
      });
      
      setQrImageUrl(url);
    } catch (error) {
      console.error("Error generando QR:", error);
      toast({
        title: "Error al generar QR",
        description: "Ocurrió un error al generar el código QR",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Función para descargar el código QR como imagen
  const downloadQR = () => {
    if (!qrImageUrl) return;
    
    const link = document.createElement('a');
    link.href = qrImageUrl;
    link.download = `qr-code-${inputText}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "QR descargado",
      description: "El código QR se ha descargado correctamente",
    });
  };

  // Función para copiar el texto del QR al portapapeles
  const copyQRText = () => {
    navigator.clipboard.writeText(inputText)
      .then(() => {
        toast({
          title: "Texto copiado",
          description: "El número ha sido copiado al portapapeles",
        });
      })
      .catch((error) => {
        console.error("Error copiando al portapapeles:", error);
        toast({
          title: "Error al copiar",
          description: "No se pudo copiar el texto al portapapeles",
          variant: "destructive",
        });
      });
  };

  // Manejar cambios en el input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Solo permitir números
    if (validateInput(value)) {
      setInputText(value);
    }
  };

  return (
    <div className="mx-4 md:mx-6 mt-4">
      <Card className="bg-[#1e1e1e] text-white border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center">
            <QrCode className="mr-2 h-5 w-5" />
            Generador de Códigos QR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-1 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="qr-input">Ingresa solo números</Label>
                  <Input
                    id="qr-input"
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    placeholder="Ej: 123456789"
                    className="bg-[#2a2a2a] border-gray-700 text-white"
                    maxLength={50}
                  />
                </div>
                
                <div className="space-y-2">
                  <Button 
                    onClick={generateQR} 
                    className="w-full bg-[#007bff] hover:bg-blue-700 text-white flex items-center justify-center"
                    disabled={isGenerating || !inputText}
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <QrCode className="h-4 w-4 mr-2" />
                        Generar QR
                      </>
                    )}
                  </Button>
                </div>
                
                {qrImageUrl && (
                  <div className="space-y-2">
                    <div className="flex space-x-2">
                      <Button
                        onClick={downloadQR}
                        className="flex-1 bg-[#28a745] hover:bg-green-700 text-white flex items-center justify-center"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Descargar
                      </Button>
                      <Button
                        onClick={copyQRText}
                        className="flex-1 bg-[#6c757d] hover:bg-gray-700 text-white flex items-center justify-center"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="col-span-2 flex flex-col items-center justify-center bg-[#2a2a2a] rounded-lg p-4">
                {qrImageUrl ? (
                  <>
                    <img 
                      src={qrImageUrl} 
                      alt="Código QR generado" 
                      className="max-w-full max-h-60 md:max-h-80"
                    />
                    <div className="mt-4 text-center">
                      <span className="text-sm text-gray-400">
                        Código: <span className="font-mono">{inputText}</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500 py-16">
                    <QrCode className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Ingresa un número y presiona "Generar QR" para crear un código QR.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}