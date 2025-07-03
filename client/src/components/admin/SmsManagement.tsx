import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Users, Settings, Send, Plus, History, CreditCard } from "lucide-react";

interface SmsConfig {
  id?: number;
  username: string | null;
  password: string | null;
  apiUrl: string;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

interface User {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
}

interface SmsHistory {
  id: number;
  userId: number;
  phoneNumber: string;
  message: string;
  sentAt: string;
  status: string;
  errorMessage?: string;
}

const SmsManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados locales
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [creditsToAdd, setCreditsToAdd] = useState<number>(0);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isSendSmsDialogOpen, setIsSendSmsDialogOpen] = useState(false);
  
  // Estados para el formulario de envío de SMS
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [prefix, setPrefix] = useState("+52");

  // Configuración SMS
  const [smsConfig, setSmsConfig] = useState<Partial<SmsConfig>>({
    username: "",
    password: "",
    apiUrl: "https://www.sofmex.com/api/sms/v3/asignacion"
  });

  // Obtener configuración de SMS
  const { data: config } = useQuery({
    queryKey: ['/api/sms/config'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/sms/config');
      const data = await res.json();
      return data.config;
    }
  });

  // Obtener lista de usuarios
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users');
      return await res.json();
    }
  });

  // Obtener créditos de usuario seleccionado
  const { data: userCredits = 0 } = useQuery({
    queryKey: ['/api/sms/credits', selectedUserId],
    enabled: !!selectedUserId,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sms/credits/${selectedUserId}`);
      const data = await res.json();
      return data.credits;
    }
  });

  // Obtener historial de SMS de usuario seleccionado
  const { data: smsHistory = [] } = useQuery({
    queryKey: ['/api/sms/history', selectedUserId],
    enabled: !!selectedUserId,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sms/history/${selectedUserId}`);
      const data = await res.json();
      return data.history;
    }
  });

  // Mutación para actualizar configuración SMS
  const updateConfigMutation = useMutation({
    mutationFn: async (config: Partial<SmsConfig>) => {
      const res = await apiRequest('POST', '/api/sms/config', config);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuración actualizada",
        description: "La configuración de SMS se ha actualizado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/config'] });
      setIsConfigDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar la configuración",
        variant: "destructive",
      });
    }
  });

  // Mutación para agregar créditos
  const addCreditsMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: number; amount: number }) => {
      const res = await apiRequest('POST', '/api/sms/credits/add', { userId, amount });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Créditos agregados",
        description: `Se han agregado ${creditsToAdd} créditos al usuario`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/credits', selectedUserId] });
      setCreditsToAdd(0);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al agregar créditos",
        variant: "destructive",
      });
    }
  });

  // Mutación para enviar SMS
  const sendSmsMutation = useMutation({
    mutationFn: async (data: { phoneNumbers: string; message: string; prefix: string }) => {
      const res = await apiRequest('POST', '/api/sms/send', data);
      return await res.json();
    },
    onSuccess: (data) => {
      const result = data.data;
      toast({
        title: "SMS enviado",
        description: `Enviados: ${result.sent}, Fallidos: ${result.failed}. Créditos usados: ${result.creditsUsed}`,
      });
      setIsSendSmsDialogOpen(false);
      setPhoneNumbers("");
      setSmsMessage("");
      // Actualizar créditos si hay un usuario seleccionado
      if (selectedUserId) {
        queryClient.invalidateQueries({ queryKey: ['/api/sms/credits', selectedUserId] });
        queryClient.invalidateQueries({ queryKey: ['/api/sms/history', selectedUserId] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error al enviar SMS",
        description: error.message || "Error al enviar SMS",
        variant: "destructive",
      });
    }
  });

  const handleSaveConfig = () => {
    updateConfigMutation.mutate(smsConfig);
  };

  const handleAddCredits = () => {
    if (!selectedUserId || creditsToAdd <= 0) {
      toast({
        title: "Error",
        description: "Selecciona un usuario y una cantidad válida de créditos",
        variant: "destructive",
      });
      return;
    }
    addCreditsMutation.mutate({ userId: selectedUserId, amount: creditsToAdd });
  };

  const handleSendSms = () => {
    if (!phoneNumbers.trim() || !smsMessage.trim()) {
      toast({
        title: "Error",
        description: "Ingresa números de teléfono y mensaje",
        variant: "destructive",
      });
      return;
    }
    sendSmsMutation.mutate({ phoneNumbers, message: smsMessage, prefix });
  };

  const formatPhoneNumber = (phone: string) => {
    if (phone.startsWith('+')) return phone;
    return `+${phone}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-500">Enviado</Badge>;
      case 'failed':
        return <Badge variant="destructive">Fallido</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestión de SMS</h2>
          <p className="text-muted-foreground">
            Administra el envío de mensajes de texto y créditos
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Configuración
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configuración de SMS</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="username">Usuario API</Label>
                  <Input
                    id="username"
                    value={smsConfig.username || ""}
                    onChange={(e) => setSmsConfig({ ...smsConfig, username: e.target.value })}
                    placeholder="Usuario de la API de Sofmex"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Contraseña API</Label>
                  <Input
                    id="password"
                    type="password"
                    value={smsConfig.password || ""}
                    onChange={(e) => setSmsConfig({ ...smsConfig, password: e.target.value })}
                    placeholder="Contraseña de la API de Sofmex"
                  />
                </div>
                <div>
                  <Label htmlFor="apiUrl">URL de la API</Label>
                  <Input
                    id="apiUrl"
                    value={smsConfig.apiUrl || ""}
                    onChange={(e) => setSmsConfig({ ...smsConfig, apiUrl: e.target.value })}
                    placeholder="URL de la API de SMS"
                  />
                </div>
                <Button 
                  onClick={handleSaveConfig} 
                  disabled={updateConfigMutation.isPending}
                  className="w-full"
                >
                  {updateConfigMutation.isPending ? "Guardando..." : "Guardar Configuración"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isSendSmsDialogOpen} onOpenChange={setIsSendSmsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Send className="mr-2 h-4 w-4" />
                Enviar SMS
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Enviar SMS Masivo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="prefix">Prefijo de País</Label>
                  <Select value={prefix} onValueChange={setPrefix}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+52">🇲🇽 México (+52)</SelectItem>
                      <SelectItem value="+1">🇺🇸 USA (+1)</SelectItem>
                      <SelectItem value="+57">🇨🇴 Colombia (+57)</SelectItem>
                      <SelectItem value="+34">🇪🇸 España (+34)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="phoneNumbers">Números de Teléfono</Label>
                  <Textarea
                    id="phoneNumbers"
                    value={phoneNumbers}
                    onChange={(e) => setPhoneNumbers(e.target.value)}
                    placeholder="5512345678,5523456789,5534567890"
                    rows={3}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Separa los números con comas (máx. 250 números)
                  </p>
                </div>
                <div>
                  <Label htmlFor="smsMessage">Mensaje</Label>
                  <Textarea
                    id="smsMessage"
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    placeholder="Escribe tu mensaje aquí..."
                    rows={3}
                    maxLength={160}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {smsMessage.length}/160 caracteres
                  </p>
                </div>
                <Button 
                  onClick={handleSendSms} 
                  disabled={sendSmsMutation.isPending}
                  className="w-full"
                >
                  {sendSmsMutation.isPending ? "Enviando..." : "Enviar SMS"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Panel de Gestión de Créditos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="mr-2 h-5 w-5" />
              Gestión de Créditos
            </CardTitle>
            <CardDescription>
              Administra los créditos SMS de los usuarios
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="userSelect">Seleccionar Usuario</Label>
              <Select value={selectedUserId?.toString() || ""} onValueChange={(value) => setSelectedUserId(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un usuario" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user: User) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.username} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUserId && (
              <>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Créditos actuales</p>
                  <p className="text-2xl font-bold">{userCredits}</p>
                </div>

                <div className="flex space-x-2">
                  <Input
                    type="number"
                    value={creditsToAdd}
                    onChange={(e) => setCreditsToAdd(parseInt(e.target.value) || 0)}
                    placeholder="Cantidad de créditos"
                    min="1"
                  />
                  <Button 
                    onClick={handleAddCredits}
                    disabled={addCreditsMutation.isPending || creditsToAdd <= 0}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Estado de la API */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="mr-2 h-5 w-5" />
              Estado de la API
            </CardTitle>
            <CardDescription>
              Configuración actual de la API de SMS
            </CardDescription>
          </CardHeader>
          <CardContent>
            {config ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Estado:</span>
                  <Badge variant={config.isActive ? "default" : "destructive"}>
                    {config.isActive ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Usuario:</span>
                  <span className="text-sm">{config.username || "No configurado"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">URL:</span>
                  <span className="text-sm text-muted-foreground">
                    {config.apiUrl?.substring(0, 30)}...
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Actualizado por:</span>
                  <span className="text-sm">{config.updatedBy}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay configuración disponible</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historial de SMS */}
      {selectedUserId && smsHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <History className="mr-2 h-5 w-5" />
              Historial de SMS
            </CardTitle>
            <CardDescription>
              Últimos mensajes enviados por el usuario seleccionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {smsHistory.slice(0, 10).map((item: SmsHistory) => (
                <div key={item.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{formatPhoneNumber(item.phoneNumber)}</p>
                      <p className="text-sm text-muted-foreground mt-1">{item.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDate(item.sentAt)}
                      </p>
                    </div>
                    <div className="ml-4">
                      {getStatusBadge(item.status)}
                    </div>
                  </div>
                  {item.errorMessage && (
                    <p className="text-xs text-red-500 mt-2">{item.errorMessage}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SmsManagement;