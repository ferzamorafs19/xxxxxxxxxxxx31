import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MessageSquare, Send, Settings, RefreshCw, PlusCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';

interface SmsConfig {
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
  hasApiKey: boolean;
}

interface SmsHistory {
  id: number;
  userId: number;
  phoneNumber: string;
  message: string;
  sentAt: string;
  status: 'pending' | 'sent' | 'failed';
  sessionId: string | null;
  errorMessage: string | null;
}

const formatPhoneNumber = (phoneNumber: string) => {
  // Formato básico: mostrar últimos 4 dígitos y ocultar el resto
  if (phoneNumber.length > 4) {
    return `****${phoneNumber.slice(-4)}`;
  }
  return phoneNumber;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

const SmsManagement: React.FC = () => {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  
  // Consulta para obtener el estado de la API
  const { data: apiConfig, isLoading: isConfigLoading } = useQuery({
    queryKey: ['/api/sms/config'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/sms/config');
      return await res.json() as SmsConfig | null;
    }
  });
  
  // Consulta para obtener los créditos
  const { data: credits, isLoading: isCreditsLoading } = useQuery({
    queryKey: ['/api/sms/credits'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/sms/credits');
      return await res.json() as { credits: number };
    }
  });
  
  // Consulta para obtener el historial
  const { data: history, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['/api/sms/history'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/sms/history');
      return await res.json() as SmsHistory[];
    }
  });
  
  // Consulta para obtener las sesiones activas para el selector
  const { data: sessions, isLoading: isSessionsLoading } = useQuery({
    queryKey: ['/api/sessions'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/sessions');
      return await res.json();
    }
  });
  
  // Mutación para actualizar la configuración de la API
  const updateApiConfig = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/sms/config', { apiKey });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sms/config'] });
      setIsConfigDialogOpen(false);
      toast({
        title: "Configuración actualizada",
        description: "La configuración de la API de SMS ha sido actualizada correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudo actualizar la configuración: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutación para enviar SMS
  const sendSms = useMutation({
    mutationFn: async () => {
      const payload = {
        phoneNumber,
        message: messageText,
        sessionId: selectedSession
      };
      const res = await apiRequest('POST', '/api/sms/send', payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sms/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/credits'] });
      setIsSendDialogOpen(false);
      setPhoneNumber('');
      setMessageText('');
      setSelectedSession(null);
      toast({
        title: "Mensaje enviado",
        description: "El SMS ha sido enviado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudo enviar el SMS: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Enviado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500"><RefreshCw className="w-3 h-3 mr-1" /> Pendiente</Badge>;
      case 'failed':
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" /> Fallido</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  return (
    <div className="p-4 h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">API de Mensajes SMS</h2>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/sms/config'] });
              queryClient.invalidateQueries({ queryKey: ['/api/sms/credits'] });
              queryClient.invalidateQueries({ queryKey: ['/api/sms/history'] });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Settings className="h-4 w-4 mr-2" />
                Configurar API
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configuración de API de SMS</DialogTitle>
                <DialogDescription>
                  Configura las credenciales para la API de SofMex para enviar mensajes SMS.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key de SofMex</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="Ingresa la API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                {apiConfig && (
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <span>Estado actual:</span>
                    <Badge variant={apiConfig.isActive ? "default" : "outline"}>
                      {apiConfig.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                    {apiConfig.hasApiKey && <span>(API Key configurada)</span>}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsConfigDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"

                  onClick={() => updateApiConfig.mutate()}
                  disabled={!apiKey || updateApiConfig.isPending}
                >
                  {updateApiConfig.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <MessageSquare className="h-4 w-4 mr-2" />
                Enviar SMS
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enviar Mensaje SMS</DialogTitle>
                <DialogDescription>
                  Envía un mensaje SMS a un número de teléfono.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Número de teléfono</Label>
                  <Input
                    id="phoneNumber"
                    placeholder="Ej: 5512345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Mensaje</Label>
                  <Textarea
                    id="message"
                    placeholder="Escribe tu mensaje aquí"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session">Asociar con Sesión (opcional)</Label>
                  <Select 
                    value={selectedSession || ''} 
                    onValueChange={(value) => setSelectedSession(value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar sesión" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Ninguna</SelectItem>
                      {sessions && Array.isArray(sessions) && sessions.map((session) => (
                        <SelectItem key={session.sessionId} value={session.sessionId}>
                          {session.banco} - {session.sessionId.slice(0, 6)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {credits && (
                  <Alert>
                    <AlertDescription>
                      Tienes <Badge variant="outline">{credits.credits}</Badge> créditos disponibles.
                      Cada mensaje consume 1 crédito.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsSendDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  onClick={() => sendSms.mutate()}
                  disabled={!phoneNumber || !messageText || sendSms.isPending || (credits?.credits === 0)}
                >
                  {sendSms.isPending ? (
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
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Estado de la API
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isConfigLoading ? (
              <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
            ) : apiConfig ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Estado:</span>
                  <Badge variant={apiConfig.isActive ? "default" : "secondary"}>
                    {apiConfig.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">API Key:</span>
                  <Badge variant={apiConfig.hasApiKey ? "outline" : "destructive"}>
                    {apiConfig.hasApiKey ? "Configurada" : "No configurada"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Última actualización:</span>
                  <span className="text-sm">{apiConfig.updatedAt ? formatDate(apiConfig.updatedAt) : 'Nunca'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Actualizado por:</span>
                  <span className="text-sm">{apiConfig.updatedBy || 'N/A'}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                No hay configuración. Configura la API primero.
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              Créditos SMS
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isCreditsLoading ? (
              <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
            ) : (
              <div className="text-center py-4">
                <div className="text-4xl font-bold">{credits?.credits || 0}</div>
                <div className="text-sm text-gray-500 mt-2">créditos disponibles</div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Send className="h-5 w-5 mr-2" />
              Estadísticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isHistoryLoading ? (
              <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{history?.length || 0}</div>
                  <div className="text-sm text-gray-500">Total enviados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {history?.filter(sms => sms.status === 'sent').length || 0}
                  </div>
                  <div className="text-sm text-gray-500">Enviados con éxito</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Historial de Mensajes</CardTitle>
          <CardDescription>
            Lista de mensajes SMS enviados recientemente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isHistoryLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : history && history.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {history.map((sms) => (
                <div 
                  key={sms.id} 
                  className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">{formatPhoneNumber(sms.phoneNumber)}</div>
                      <div className="text-sm text-gray-500">{formatDate(sms.sentAt)}</div>
                    </div>
                    <div>{getStatusBadge(sms.status)}</div>
                  </div>
                  <div className="text-sm border-l-2 border-gray-300 pl-2">{sms.message}</div>
                  {sms.errorMessage && (
                    <div className="mt-2 text-xs text-red-500">{sms.errorMessage}</div>
                  )}
                  {sms.sessionId && (
                    <div className="mt-2 text-xs text-gray-500">
                      Sesión: {sms.sessionId}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No hay mensajes en el historial
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsSendDialogOpen(true)}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Enviar nuevo mensaje
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SmsManagement;