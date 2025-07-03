import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, CreditCard, Send, History } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SmsCredits {
  id: number;
  userId: number;
  credits: number;
  updatedAt: string;
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

export function UserSmsPanel() {
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [message, setMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener créditos del usuario
  const { data: smsCredits, isLoading: loadingCredits } = useQuery<SmsCredits>({
    queryKey: ["/api/sms/credits"],
  });

  // Obtener historial de SMS
  const { data: smsHistory, isLoading: loadingHistory } = useQuery<SmsHistory[]>({
    queryKey: ["/api/sms/history"],
    enabled: showHistory,
  });

  // Mutación para enviar SMS
  const sendSmsMutation = useMutation({
    mutationFn: async (data: { phoneNumbers: string; message: string; prefix?: string }) => {
      const response = await apiRequest("/api/sms/send", "POST", data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "SMS enviado",
        description: "El mensaje se ha enviado correctamente",
      });
      setPhoneNumbers("");
      setMessage("");
      // Actualizar créditos
      queryClient.invalidateQueries({ queryKey: ["/api/sms/credits"] });
      if (showHistory) {
        queryClient.invalidateQueries({ queryKey: ["/api/sms/history"] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error al enviar SMS",
        description: error.message || "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    },
  });

  const handleSendSms = () => {
    if (!phoneNumbers.trim()) {
      toast({
        title: "Error",
        description: "Debes ingresar al menos un número de teléfono",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Debes escribir un mensaje",
        variant: "destructive",
      });
      return;
    }

    // Contar números válidos para verificar créditos
    const validNumbers = phoneNumbers.split(',').map(n => n.trim()).filter(n => /^\d{10}$/.test(n));
    
    if (validNumbers.length === 0) {
      toast({
        title: "Error",
        description: "No hay números válidos. Usa formato de 10 dígitos separados por comas",
        variant: "destructive",
      });
      return;
    }

    if (smsCredits && smsCredits.credits < validNumbers.length) {
      toast({
        title: "Créditos insuficientes",
        description: `Necesitas ${validNumbers.length} créditos pero solo tienes ${smsCredits.credits}`,
        variant: "destructive",
      });
      return;
    }

    sendSmsMutation.mutate({
      phoneNumbers,
      message,
      prefix: "+52"
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-MX');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Panel de créditos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Créditos SMS
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCredits ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Cargando créditos...</span>
            </div>
          ) : (
            <div className="text-2xl font-bold text-blue-600">
              {smsCredits?.credits || 0} créditos disponibles
            </div>
          )}
          <p className="text-sm text-gray-600 mt-2">
            Cada mensaje consume 1 crédito
          </p>
        </CardContent>
      </Card>

      {/* Panel de envío de SMS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Enviar SMS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="phoneNumbers">Números de teléfono</Label>
            <Input
              id="phoneNumbers"
              placeholder="5534149890, 5512345678 (separados por comas)"
              value={phoneNumbers}
              onChange={(e) => setPhoneNumbers(e.target.value)}
              disabled={sendSmsMutation.isPending}
            />
            <p className="text-sm text-gray-600 mt-1">
              Ingresa números de 10 dígitos separados por comas
            </p>
          </div>

          <div>
            <Label htmlFor="message">Mensaje</Label>
            <Textarea
              id="message"
              placeholder="Escribe tu mensaje aquí..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sendSmsMutation.isPending}
              rows={4}
            />
            <p className="text-sm text-gray-600 mt-1">
              {message.length}/160 caracteres
            </p>
          </div>

          <Button 
            onClick={handleSendSms}
            disabled={sendSmsMutation.isPending || !smsCredits || smsCredits.credits === 0}
            className="w-full"
          >
            {sendSmsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar SMS
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Panel de historial */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de mensajes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => setShowHistory(!showHistory)}
            className="mb-4"
          >
            {showHistory ? "Ocultar historial" : "Ver historial"}
          </Button>

          {showHistory && (
            <div className="space-y-2">
              {loadingHistory ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Cargando historial...</span>
                </div>
              ) : smsHistory && smsHistory.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {smsHistory.map((sms) => (
                    <div key={sms.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">{sms.phoneNumber}</span>
                        <span className={`text-sm font-medium ${getStatusColor(sms.status)}`}>
                          {sms.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">{sms.message}</p>
                      <p className="text-xs text-gray-500">{formatDate(sms.sentAt)}</p>
                      {sms.errorMessage && (
                        <p className="text-xs text-red-600 mt-1">{sms.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No hay mensajes en el historial</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}