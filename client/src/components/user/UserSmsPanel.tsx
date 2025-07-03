import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Send, CreditCard, AlertCircle, History, ExternalLink } from "lucide-react";

const UserSmsPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [message, setMessage] = useState("");
  const [prefix, setPrefix] = useState("+52");

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
    mutationFn: async (data: { phoneNumbers: string; message: string; prefix: string }) => {
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

    // Calcular cuántos números se van a enviar
    const numbers = phoneNumbers.split(',').map(n => n.trim()).filter(n => n.length > 0);
    
    if (userCredits < numbers.length) {
      toast({
        title: "Créditos insuficientes",
        description: `Necesitas ${numbers.length} créditos, tienes ${userCredits}`,
        variant: "destructive",
      });
      return;
    }

    sendSmsMutation.mutate({ phoneNumbers, message, prefix });
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
            Cada SMS consume 1 crédito
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
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <Label htmlFor="prefix">Prefijo</Label>
              <Input
                id="prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="+52"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="numbers">Números de teléfono</Label>
              <Input
                id="numbers"
                value={phoneNumbers}
                onChange={(e) => setPhoneNumbers(e.target.value)}
                placeholder="5534149890, 5512345678 (separados por comas)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Solo números de 10 dígitos, sin prefijo
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="message">Mensaje</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu mensaje aquí..."
              className="min-h-[100px]"
              maxLength={160}
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-muted-foreground">
                Números ingresados: {phoneNumbers.split(',').filter(n => n.trim()).length}
              </p>
              <p className="text-xs text-muted-foreground">
                {message.length}/160 caracteres
              </p>
            </div>
          </div>

          <Button 
            onClick={handleSendSms}
            disabled={sendSmsMutation.isPending || userCredits === 0}
            className="w-full"
          >
            <Send className="mr-2 h-4 w-4" />
            {sendSmsMutation.isPending ? "Enviando..." : "Enviar SMS"}
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