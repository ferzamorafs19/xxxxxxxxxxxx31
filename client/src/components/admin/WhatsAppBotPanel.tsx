import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Send, Save, MessageSquare, QrCode, Power, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { WhatsappConfig, WhatsappMenuOption } from "@shared/schema";

export default function WhatsAppBotPanel() {
  const { toast } = useToast();
  const [testNumber, setTestNumber] = useState("5531781885");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Obtener configuración
  const { data: config, isLoading: loadingConfig } = useQuery<WhatsappConfig>({
    queryKey: ["/api/whatsapp/config"],
  });

  // Obtener opciones de menú
  const { data: menuOptions = [], isLoading: loadingMenu } = useQuery<WhatsappMenuOption[]>({
    queryKey: ["/api/whatsapp/menu"],
  });

  // Obtener estado de conexión (polling cada 3 segundos)
  const { data: status } = useQuery<{ isConnected: boolean; qrCode: string | null; phoneNumber: string }>({
    queryKey: ["/api/whatsapp/status"],
    refetchInterval: 3000, // Actualizar cada 3 segundos
  });

  // Sincronizar valores cuando carga la configuración
  useEffect(() => {
    if (config) {
      setWelcomeMessage(config.welcomeMessage || "");
      setPhoneNumber(config.phoneNumber || "");
    }
  }, [config]);

  // Mutación para actualizar configuración
  const updateConfigMutation = useMutation({
    mutationFn: async (data: { welcomeMessage: string; phoneNumber: string }) => {
      return await apiRequest("/api/whatsapp/config", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
      toast({
        title: "Configuración guardada",
        description: "La configuración de WhatsApp ha sido actualizada.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración.",
        variant: "destructive",
      });
    },
  });

  // Mutación para crear opción de menú
  const createMenuOptionMutation = useMutation({
    mutationFn: async (data: Partial<WhatsappMenuOption>) => {
      return await apiRequest("/api/whatsapp/menu", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/menu"] });
      toast({
        title: "Opción creada",
        description: "La opción de menú ha sido creada.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la opción de menú.",
        variant: "destructive",
      });
    },
  });

  // Mutación para actualizar opción de menú
  const updateMenuOptionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<WhatsappMenuOption> }) => {
      return await apiRequest(`/api/whatsapp/menu/${id}`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/menu"] });
      toast({
        title: "Opción actualizada",
        description: "La opción de menú ha sido actualizada.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la opción de menú.",
        variant: "destructive",
      });
    },
  });

  // Mutación para eliminar opción de menú
  const deleteMenuOptionMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/whatsapp/menu/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/menu"] });
      toast({
        title: "Opción eliminada",
        description: "La opción de menú ha sido eliminada.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la opción de menú.",
        variant: "destructive",
      });
    },
  });

  // Mutación para enviar mensaje de prueba
  const sendTestMessageMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      return await apiRequest("/api/whatsapp/send-test", "POST", { phoneNumber });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Mensaje enviado",
        description: `Mensaje enviado a ${data.sentTo}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar el mensaje de prueba.",
        variant: "destructive",
      });
    },
  });

  // Mutación para iniciar el bot
  const startBotMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/whatsapp/start", "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
      toast({
        title: "Bot iniciado",
        description: "Escanea el código QR con WhatsApp para conectar.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo iniciar el bot de WhatsApp.",
        variant: "destructive",
      });
    },
  });

  // Mutación para detener el bot
  const stopBotMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/whatsapp/stop", "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
      toast({
        title: "Bot detenido",
        description: "El bot de WhatsApp ha sido desconectado.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo detener el bot de WhatsApp.",
        variant: "destructive",
      });
    },
  });

  const handleSaveConfig = () => {
    updateConfigMutation.mutate({
      welcomeMessage: welcomeMessage,
      phoneNumber: phoneNumber,
    });
  };

  const handleAddMenuOption = () => {
    const nextNumber = menuOptions.length > 0 
      ? Math.max(...menuOptions.map(o => o.optionNumber)) + 1 
      : 1;
    
    createMenuOptionMutation.mutate({
      optionNumber: nextNumber,
      optionText: `Opción ${nextNumber}`,
      responseMessage: "",
      actionType: "message",
    });
  };

  const handleUpdateMenuOption = (id: number, field: string, value: string | number) => {
    const option = menuOptions.find(o => o.id === id);
    if (!option) return;

    updateMenuOptionMutation.mutate({
      id,
      data: {
        ...option,
        [field]: value,
      },
    });
  };

  const handleDeleteMenuOption = (id: number) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta opción?")) {
      deleteMenuOptionMutation.mutate(id);
    }
  };

  const handleSendTestMessage = () => {
    if (!testNumber) {
      toast({
        title: "Error",
        description: "Por favor ingresa un número de teléfono.",
        variant: "destructive",
      });
      return;
    }
    sendTestMessageMutation.mutate(testNumber);
  };

  if (loadingConfig || loadingMenu) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Bot de WhatsApp</h1>
        <p className="text-muted-foreground">
          Configura el bot de WhatsApp para enviar mensajes automáticos con menú de opciones.
        </p>
      </div>

      {/* Estado de Conexión y QR */}
      <Card>
        <CardHeader>
          <CardTitle>Conexión de WhatsApp</CardTitle>
          <CardDescription>
            Conecta tu cuenta de WhatsApp escaneando el código QR
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estado de conexión */}
          <div className="flex items-center gap-3 p-4 border rounded-lg">
            {status?.isConnected ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-500" />
                <div>
                  <p className="font-semibold text-green-600">WhatsApp Conectado</p>
                  <p className="text-sm text-muted-foreground">El bot está listo para enviar mensajes</p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-gray-400" />
                <div>
                  <p className="font-semibold text-gray-600">WhatsApp Desconectado</p>
                  <p className="text-sm text-muted-foreground">Inicia el bot y escanea el código QR para conectar</p>
                </div>
              </>
            )}
          </div>

          {/* Código QR */}
          {status?.qrCode && !status?.isConnected && (
            <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-lg bg-muted/50">
              <QrCode className="w-8 h-8 text-primary" />
              <p className="text-sm font-medium">Escanea este código QR con WhatsApp</p>
              <img 
                src={status.qrCode} 
                alt="WhatsApp QR Code" 
                className="w-64 h-64 border-4 border-white rounded-lg shadow-lg"
              />
              <p className="text-xs text-muted-foreground text-center max-w-md">
                Abre WhatsApp en tu teléfono → Menú → Dispositivos vinculados → Vincular un dispositivo → Escanea este código
              </p>
            </div>
          )}

          {/* Botones de control */}
          <div className="flex gap-3">
            {!status?.isConnected ? (
              <Button
                data-testid="button-start-bot"
                onClick={() => startBotMutation.mutate()}
                disabled={startBotMutation.isPending}
                className="flex-1"
              >
                <Power className="w-4 h-4 mr-2" />
                {startBotMutation.isPending ? "Iniciando..." : "Iniciar Bot y Generar QR"}
              </Button>
            ) : (
              <Button
                data-testid="button-stop-bot"
                onClick={() => stopBotMutation.mutate()}
                disabled={stopBotMutation.isPending}
                variant="destructive"
                className="flex-1"
              >
                <Power className="w-4 h-4 mr-2" />
                {stopBotMutation.isPending ? "Deteniendo..." : "Detener Bot"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuración General */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración General</CardTitle>
          <CardDescription>
            Configura el mensaje de bienvenida y el número de WhatsApp del bot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone-number">Número de WhatsApp</Label>
            <Input
              id="phone-number"
              data-testid="input-phone-number"
              placeholder="5531781885"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcome-message">Mensaje de Bienvenida</Label>
            <Textarea
              id="welcome-message"
              data-testid="textarea-welcome-message"
              rows={4}
              placeholder="Hola! Bienvenido a nuestro servicio..."
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
            />
          </div>

          <Button
            data-testid="button-save-config"
            onClick={handleSaveConfig}
            disabled={updateConfigMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {updateConfigMutation.isPending ? "Guardando..." : "Guardar Configuración"}
          </Button>
        </CardContent>
      </Card>

      {/* Opciones del Menú */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Opciones del Menú</CardTitle>
              <CardDescription>
                Define las opciones que aparecerán en el menú del bot
              </CardDescription>
            </div>
            <Button
              data-testid="button-add-option"
              onClick={handleAddMenuOption}
              disabled={createMenuOptionMutation.isPending}
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Opción
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {menuOptions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No hay opciones de menú configuradas. Haz clic en "Agregar Opción" para crear una.
              </p>
            ) : (
              menuOptions.map((option) => (
                <div
                  key={option.id}
                  className="border rounded-lg p-4 space-y-3"
                  data-testid={`menu-option-${option.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`option-number-${option.id}`}>Número</Label>
                        <Input
                          id={`option-number-${option.id}`}
                          data-testid={`input-option-number-${option.id}`}
                          type="number"
                          value={option.optionNumber}
                          onChange={(e) =>
                            handleUpdateMenuOption(option.id, "optionNumber", parseInt(e.target.value))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`option-text-${option.id}`}>Etiqueta</Label>
                        <Input
                          id={`option-text-${option.id}`}
                          data-testid={`input-option-text-${option.id}`}
                          value={option.optionText}
                          onChange={(e) =>
                            handleUpdateMenuOption(option.id, "optionText", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <Button
                      data-testid={`button-delete-option-${option.id}`}
                      variant="ghost"
                      size="icon"
                      className="ml-2"
                      onClick={() => handleDeleteMenuOption(option.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`option-response-${option.id}`}>Texto de Respuesta</Label>
                    <Textarea
                      id={`option-response-${option.id}`}
                      data-testid={`textarea-option-response-${option.id}`}
                      rows={3}
                      value={option.responseMessage || ""}
                      onChange={(e) =>
                        handleUpdateMenuOption(option.id, "responseMessage", e.target.value)
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enviar Mensaje de Prueba */}
      <Card>
        <CardHeader>
          <CardTitle>Enviar Mensaje de Prueba</CardTitle>
          <CardDescription>
            Envía un mensaje de prueba con el mensaje de bienvenida y el menú configurado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-number">Número de Teléfono</Label>
            <Input
              id="test-number"
              data-testid="input-test-number"
              placeholder="5531781885"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
            />
          </div>

          <Button
            data-testid="button-send-test"
            onClick={handleSendTestMessage}
            disabled={sendTestMessageMutation.isPending}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            {sendTestMessageMutation.isPending ? "Enviando..." : "Enviar Mensaje de Prueba"}
          </Button>

          {/* Vista Previa del Mensaje */}
          {welcomeMessage && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Vista Previa:</h4>
              <div className="whitespace-pre-wrap text-sm">
                {welcomeMessage}
                {menuOptions.length > 0 && (
                  <>
                    {"\n\n"}
                    {menuOptions.map((option) => (
                      <div key={option.id}>
                        {option.optionNumber}. {option.optionText}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
