import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Send, CreditCard, AlertCircle, History, ExternalLink } from "lucide-react";

const UserSmsPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [message, setMessage] = useState("");
  const [prefix, setPrefix] = useState("+52");
  const [routeType, setRouteType] = useState<string>("short_code");

  // Obtener créditos del usuario
  const { data: userCredits = 0 } = useQuery({
    queryKey: ['/api/sms/credits'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/sms/credits');
      if (!res.ok) throw new Error('Error al obtener créditos');
      const data = await res.json();
      return data.credits || 0;
    },
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });

  // Obtener historial de SMS
  const { data: smsHistory = [] } = useQuery({
    queryKey: ['/api/sms/history'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/sms/history');
      if (!res.ok) throw new Error('Error al obtener historial');
      const data = await res.json();
      return data || [];
    },
  });

  // Mutación para enviar SMS
  const sendSmsMutation = useMutation({
    mutationFn: async (data: { phoneNumbers: string; message: string; prefix: string; routeType: string }) => {
      const res = await apiRequest('POST', '/api/sms/send', data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Error al enviar SMS');
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "SMS enviado exitosamente",
        description: `Se enviaron ${data.data?.sent || 0} mensajes`,
        variant: "default",
      });
      
      // Limpiar formulario
      setPhoneNumbers("");
      setMessage("");
      
      // Actualizar créditos e historial
      queryClient.invalidateQueries({ queryKey: ['/api/sms/credits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/history'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al enviar SMS",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendSms = () => {
    if (!phoneNumbers.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa al menos un número de teléfono",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un mensaje",
        variant: "destructive",
      });
      return;
    }

    // Calcular cuántos números se van a enviar y el costo total
    const numbers = phoneNumbers.split(',').map(n => n.trim()).filter(n => n.length > 0);
    const costPerSms = routeType === 'short_code' ? 1.0 : 0.5;
    const totalCost = numbers.length * costPerSms;
    
    if (userCredits < totalCost) {
      toast({
        title: "Créditos insuficientes",
        description: `Necesitas ${totalCost} créditos para ${numbers.length} SMS, tienes ${userCredits}`,
        variant: "destructive",
      });
      return;
    }

    sendSmsMutation.mutate({ phoneNumbers, message, prefix, routeType });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Panel de créditos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Mis Créditos SMS
          </CardTitle>
          <CardDescription>
            Short Code: 1.0 crédito • Long Code: 0.5 créditos por SMS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Créditos disponibles</p>
              <p className="text-3xl font-bold text-green-600">{userCredits}</p>
            </div>
            {userCredits === 0 && (
              <Alert className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Sin créditos.</strong><br />
                  Para recargar saldo, envía un mensaje en Telegram a:{" "}
                  <a 
                    href="https://t.me/BalonxSistema" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline inline-flex items-center gap-1"
                  >
                    @BalonxSistema <ExternalLink className="h-3 w-3" />
                  </a>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Panel de envío de SMS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Enviar SMS
          </CardTitle>
          <CardDescription>
            Envía mensajes SMS a múltiples números
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu mensaje aquí..."
              rows={3}
              maxLength={160}
              className="border-orange-300 focus:border-orange-500"
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-sm text-orange-700">
                💬 {message.length}/160 caracteres
              </p>
              {message.length > 140 && (
                <span className="text-red-600 text-sm font-medium">
                  ⚠️ Cerca del límite
                </span>
              )}
            </div>
          </div>

          {/* RESUMEN Y ENVÍO */}
          {routeType && prefix && phoneNumbers.trim() && message.trim() && (
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
            disabled={sendSmsMutation.isPending || userCredits === 0 || !routeType || !prefix || !phoneNumbers.trim() || !message.trim()}
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
        </CardContent>
      </Card>

      {/* Historial de SMS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de SMS
          </CardTitle>
          <CardDescription>
            Últimos mensajes enviados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {smsHistory.length === 0 ? (
            <div className="text-center p-6 text-muted-foreground">
              No hay historial de SMS
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {smsHistory.slice(0, 10).map((sms: any) => (
                <div key={sms.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium">A: {sms.phoneNumber}</p>
                      <p className="text-sm text-muted-foreground">{sms.message}</p>
                    </div>
                    <Badge variant={sms.status === 'sent' ? 'default' : 'destructive'}>
                      {sms.status === 'sent' ? 'Enviado' : 'Error'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(sms.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserSmsPanel;