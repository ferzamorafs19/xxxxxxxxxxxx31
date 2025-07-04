import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SendIcon, MessageCircleIcon, UsersIcon } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  username: string;
  telegramChatId: string | null;
  isActive: boolean;
  role: string;
}

export function MessageSender() {
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  // Obtener lista de usuarios
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    staleTime: 30000, // 30 segundos
  });

  // Filtrar usuarios que tienen Chat ID configurado
  const usersWithChatId = users.filter(user => 
    user.telegramChatId && 
    user.telegramChatId !== '' && 
    user.role === 'user' // Solo usuarios regulares
  );

  const handleSendMessage = async () => {
    if (!selectedUser || !message.trim()) {
      toast({
        title: "Error",
        description: "Selecciona un usuario y escribe un mensaje",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/admin/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: selectedUser,
          message: message.trim()
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "✅ Mensaje enviado",
          description: `Mensaje enviado correctamente a ${selectedUser}`,
        });
        
        // Limpiar formulario
        setSelectedUser('');
        setMessage('');
      } else {
        throw new Error(result.message || 'Error enviando mensaje');
      }
    } catch (error: any) {
      console.error('Error enviando mensaje:', error);
      toast({
        title: "❌ Error",
        description: error.message || 'Error al enviar el mensaje',
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircleIcon className="h-5 w-5" />
            Enviar Mensaje a Usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Cargando usuarios...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircleIcon className="h-5 w-5" />
          Enviar Mensaje a Usuario
        </CardTitle>
        <CardDescription>
          Envía mensajes personalizados a usuarios registrados con Chat ID configurado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {usersWithChatId.length === 0 ? (
          <Alert>
            <UsersIcon className="h-4 w-4" />
            <AlertDescription>
              No hay usuarios con Chat ID configurado disponibles para enviar mensajes.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="user-select">Usuario destinatario</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un usuario" />
                </SelectTrigger>
                <SelectContent>
                  {usersWithChatId.map((user) => (
                    <SelectItem key={user.id} value={user.username}>
                      <div className="flex items-center gap-2">
                        <span>{user.username}</span>
                        <span className="text-xs text-muted-foreground">
                          ({user.isActive ? 'Activo' : 'Inactivo'})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                {usersWithChatId.length} usuario(s) con Chat ID configurado
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message-input">Mensaje</Label>
              <Textarea
                id="message-input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Escribe tu mensaje aquí..."
                rows={4}
                className="resize-none"
              />
              <div className="text-xs text-muted-foreground">
                Presiona Ctrl+Enter para enviar rápidamente
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleSendMessage}
                disabled={isSending || !selectedUser || !message.trim()}
                className="flex-1"
              >
                <SendIcon className="mr-2 h-4 w-4" />
                {isSending ? 'Enviando...' : 'Enviar Mensaje'}
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => {
                  setSelectedUser('');
                  setMessage('');
                }}
                disabled={isSending}
              >
                Limpiar
              </Button>
            </div>

            {selectedUser && (
              <Alert>
                <MessageCircleIcon className="h-4 w-4" />
                <AlertDescription>
                  El mensaje se enviará vía Telegram al usuario <strong>{selectedUser}</strong> 
                  e incluirá tu nombre como remitente y @BalonxSistema como contacto de soporte.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}