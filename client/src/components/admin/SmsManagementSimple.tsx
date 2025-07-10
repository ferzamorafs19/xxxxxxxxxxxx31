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
import { MessageSquare, Users, Send, Plus, History, CreditCard, CheckCircle } from "lucide-react";

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

const SmsManagementSimple = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados locales
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [creditsToAdd, setCreditsToAdd] = useState<number>(0);
  const [isSendSmsDialogOpen, setIsSendSmsDialogOpen] = useState(false);
  
  // Estados para el formulario de envío de SMS
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [prefix, setPrefix] = useState("+52");
  const [routeType, setRouteType] = useState("short_code");

  // Obtener lista de usuarios regulares
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users/regular'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users/regular');
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
    mutationFn: async ({ phoneNumbers, message, prefix, routeType }: { phoneNumbers: string; message: string; prefix: string; routeType: string }) => {
      const res = await apiRequest('POST', '/api/sms/send', { phoneNumbers, message, prefix, routeType });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "SMS enviado",
        description: data.message || "El SMS se ha enviado correctamente",
      });
      setIsSendSmsDialogOpen(false);
      setPhoneNumbers("");
      setSmsMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al enviar SMS",
        variant: "destructive",
      });
    }
  });

  const handleAddCredits = () => {
    if (selectedUserId && creditsToAdd > 0) {
      addCreditsMutation.mutate({ userId: selectedUserId, amount: creditsToAdd });
    }
  };

  const handleSendSms = () => {
    if (phoneNumbers.trim() && smsMessage.trim()) {
      console.log('Enviando SMS con datos:', { phoneNumbers, message: smsMessage, prefix, routeType });
      sendSmsMutation.mutate({ phoneNumbers, message: smsMessage, prefix, routeType });
    } else {
      toast({
        title: "Error",
        description: "Debes ingresar números de teléfono y mensaje",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sistema SMS</h2>
          <p className="text-muted-foreground">
            Gestiona el envío de mensajes de texto y créditos de usuarios
          </p>
        </div>
      </div>

      {/* Estado de la API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Estado del Sistema SMS
          </CardTitle>
          <CardDescription>
            La API de Sofmex está configurada automáticamente y lista para usar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-100 text-green-800">
              Activo
            </Badge>
            <span className="text-sm text-muted-foreground">
              Sistema listo para envío de mensajes
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Panel de gestión de créditos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Gestión de Créditos
            </CardTitle>
            <CardDescription>
              Administra los créditos SMS de los usuarios
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-select">Seleccionar Usuario</Label>
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
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm font-medium">Créditos actuales</div>
                  <div className="text-2xl font-bold">{userCredits}</div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credits-input">Créditos a agregar</Label>
                  <Input
                    id="credits-input"
                    type="number"
                    min="1"
                    value={creditsToAdd === 0 ? '' : creditsToAdd}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '0') {
                        setCreditsToAdd(0);
                      } else {
                        const numValue = parseInt(value);
                        if (!isNaN(numValue) && numValue > 0) {
                          setCreditsToAdd(numValue);
                        }
                      }
                    }}
                    placeholder="Ingresa cantidad (ej: 10)"
                  />
                </div>

                <Button 
                  onClick={handleAddCredits}
                  disabled={creditsToAdd <= 0 || addCreditsMutation.isPending}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {addCreditsMutation.isPending ? 'Agregando...' : 'Agregar Créditos'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel de envío de SMS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Envío de SMS
            </CardTitle>
            <CardDescription>
              Envía mensajes de texto directamente desde el panel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={isSendSmsDialogOpen} onOpenChange={setIsSendSmsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Enviar SMS
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>🚀 Enviar SMS Masivo - Administrador</DialogTitle>
                </DialogHeader>
                
                {/* Resumen de rutas disponibles */}
                <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border-2 border-blue-200 mb-4">
                  <h3 className="font-semibold text-gray-800 mb-2">📱 Rutas SMS Disponibles:</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded border border-orange-200 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">🚀 Short Code</span>
                        <span className="text-lg font-bold text-orange-600">1.0</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Sofmex - Alta entregabilidad</p>
                    </div>
                    <div className="bg-white p-3 rounded border border-green-200 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">💰 Long Code</span>
                        <span className="text-lg font-bold text-green-600">0.5</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Ankarex - Económica</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* PASO 1: Seleccionar Ruta de Envío */}
                  <div className="border-2 border-blue-500 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center mb-3">
                      <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">1</div>
                      <Label className="text-lg font-semibold text-blue-900">Seleccionar Ruta de Envío</Label>
                    </div>
                    <Select value={routeType} onValueChange={setRouteType}>
                      <SelectTrigger className="border-blue-300 focus:border-blue-500 h-12">
                        <SelectValue placeholder="🚀 Elige tu ruta SMS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short_code" className="py-4">
                          <div className="flex items-center justify-between w-full">
                            <div>
                              <span className="font-semibold text-base">🚀 Short Code</span>
                              <p className="text-sm text-muted-foreground">Sofmex - Alta entregabilidad</p>
                            </div>
                            <span className="text-lg font-bold text-orange-600 ml-4">1.0 crédito</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="long_code" className="py-4">
                          <div className="flex items-center justify-between w-full">
                            <div>
                              <span className="font-semibold text-base">💰 Long Code</span>
                              <p className="text-sm text-muted-foreground">Ankarex - Económica</p>
                            </div>
                            <span className="text-lg font-bold text-green-600 ml-4">0.5 créditos</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {routeType && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                        <div className="text-sm font-medium text-green-700">
                          ✅ Ruta seleccionada: {routeType === 'short_code' ? 'Short Code (Sofmex)' : 'Long Code (Ankarex)'} - 
                          {routeType === 'short_code' ? ' 1.0 crédito por SMS' : ' 0.5 créditos por SMS'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PASO 2: Prefijo de País */}
                  <div className="border-2 border-green-500 rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50">
                    <div className="flex items-center mb-3">
                      <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">2</div>
                      <Label className="text-lg font-semibold text-green-900">Prefijo de País</Label>
                    </div>
                    <Select value={prefix} onValueChange={setPrefix}>
                      <SelectTrigger className="border-green-300 focus:border-green-500 h-12">
                        <SelectValue placeholder="🌍 Selecciona el país" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="+52">🇲🇽 México (+52)</SelectItem>
                        <SelectItem value="+1">🇺🇸 USA (+1)</SelectItem>
                        <SelectItem value="+57">🇨🇴 Colombia (+57)</SelectItem>
                        <SelectItem value="+34">🇪🇸 España (+34)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* PASO 3: Números de Teléfono */}
                  <div className="border-2 border-purple-500 rounded-lg p-4 bg-gradient-to-r from-purple-50 to-violet-50">
                    <div className="flex items-center mb-3">
                      <div className="bg-purple-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">3</div>
                      <Label className="text-lg font-semibold text-purple-900">Números de Teléfono</Label>
                    </div>
                    <Textarea
                      value={phoneNumbers}
                      onChange={(e) => setPhoneNumbers(e.target.value)}
                      placeholder="Ejemplo: 5512345678,5523456789,5534567890"
                      rows={4}
                      className="border-purple-300 focus:border-purple-500"
                    />
                    <p className="text-sm text-purple-700 mt-2">
                      📱 Separa los números con comas • Máximo 250 números
                      {phoneNumbers.trim() && (
                        <span className="font-semibold ml-2">
                          ({phoneNumbers.split(',').filter(n => n.trim()).length} números detectados)
                        </span>
                      )}
                    </p>
                  </div>

                  {/* PASO 4: Mensaje SMS */}
                  <div className="border-2 border-orange-500 rounded-lg p-4 bg-gradient-to-r from-orange-50 to-amber-50">
                    <div className="flex items-center mb-3">
                      <div className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">4</div>
                      <Label className="text-lg font-semibold text-orange-900">Mensaje SMS</Label>
                    </div>
                    <Textarea
                      value={smsMessage}
                      onChange={(e) => setSmsMessage(e.target.value)}
                      placeholder="Escribe tu mensaje aquí..."
                      rows={3}
                      maxLength={160}
                      className="border-orange-300 focus:border-orange-500"
                    />
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-sm text-orange-700">
                        💬 {smsMessage.length}/160 caracteres
                      </p>
                      {smsMessage.length > 140 && (
                        <span className="text-red-600 text-sm font-medium">
                          ⚠️ Cerca del límite
                        </span>
                      )}
                    </div>
                  </div>

                  {/* RESUMEN Y ENVÍO */}
                  {routeType && prefix && phoneNumbers.trim() && smsMessage.trim() && (
                    <div className="border-2 border-red-500 rounded-lg p-4 bg-gradient-to-r from-red-50 to-rose-50">
                      <div className="flex items-center mb-3">
                        <div className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">5</div>
                        <Label className="text-lg font-semibold text-red-900">Resumen del Envío</Label>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-red-200">
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div>
                            <span className="text-gray-600">Ruta:</span>
                            <p className="font-semibold">{routeType === 'short_code' ? '🚀 Short Code (Sofmex)' : '💰 Long Code (Ankarex)'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">País:</span>
                            <p className="font-semibold">{prefix === '+52' ? '🇲🇽 México' : prefix === '+1' ? '🇺🇸 USA' : prefix === '+57' ? '🇨🇴 Colombia' : '🇪🇸 España'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Números:</span>
                            <p className="font-semibold text-blue-600">{phoneNumbers.split(',').filter(n => n.trim()).length} destinatarios</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Costo por SMS:</span>
                            <p className="font-semibold text-green-600">{routeType === 'short_code' ? '1.0' : '0.5'} créditos</p>
                          </div>
                        </div>
                        <div className="border-t pt-3">
                          <div className="flex justify-between items-center text-lg">
                            <span className="font-bold text-gray-800">Total a consumir:</span>
                            <span className="font-bold text-red-600 text-xl">
                              {((routeType === 'short_code' ? 1.0 : 0.5) * 
                                phoneNumbers.split(',').filter(n => n.trim()).length).toFixed(1)} créditos
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button 
                    onClick={handleSendSms}
                    disabled={sendSmsMutation.isPending || !routeType || !prefix || !phoneNumbers.trim() || !smsMessage.trim()}
                    className="w-full text-lg py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    {sendSmsMutation.isPending ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Enviando SMS...
                      </div>
                    ) : (
                      `🚀 Enviar SMS ${phoneNumbers.trim() ? `(${phoneNumbers.split(',').filter(n => n.trim()).length} números)` : ''}`
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Historial de SMS */}
      {selectedUserId && smsHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de SMS
            </CardTitle>
            <CardDescription>
              Últimos mensajes enviados por el usuario seleccionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {smsHistory.slice(0, 5).map((sms: SmsHistory) => (
                <div key={sms.id} className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{sms.phoneNumber}</div>
                    <Badge variant={sms.status === 'sent' ? 'default' : 'destructive'}>
                      {sms.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">
                    {sms.message}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(sms.sentAt).toLocaleString()}
                  </div>
                  {sms.errorMessage && (
                    <div className="text-xs text-red-600 mt-1">
                      Error: {sms.errorMessage}
                    </div>
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

export default SmsManagementSimple;