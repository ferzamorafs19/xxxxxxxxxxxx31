import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Check, X, Clock, User, Calendar, Smartphone, ToggleLeft, ToggleRight, Trash, Settings, Building, Link as LinkIcon, MessageCircle } from 'lucide-react';
import { formatDate } from '@/utils/helpers';
import { useToast } from '@/hooks/use-toast';
import { useDeviceInfo } from '@/hooks/use-device-orientation';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BankType } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

// Interfaces
interface User {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
  expiresAt: string | null;
  deviceCount: number;
  maxDevices: number;
  createdAt: string | null;
  lastLogin: string | null;
  allowedBanks?: string;
  telegramChatId?: string;
}

const RegisteredUsersManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [bankOptions, setBankOptions] = useState<string[]>(['all']);
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [selectedBank, setSelectedBank] = useState<string>('BANORTE');
  const [messageText, setMessageText] = useState<string>('');
  const { isMobile, isLandscape } = useDeviceInfo();

  // Query para obtener usuarios registrados
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users');
      if (!response.ok) throw new Error('Error al cargar usuarios');
      return response.json();
    },
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  // Mutation para activar usuario por 1 día
  const activateOneDayMutation = useMutation({
    mutationFn: async ({ username, allowedBanks }: { username: string; allowedBanks?: string }) => {
      const response = await apiRequest('POST', `/api/users/${username}/activate-one-day`, { allowedBanks });
      if (!response.ok) throw new Error('Error al activar usuario');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      toast({
        title: "Usuario activado",
        description: "Usuario activado por 1 día exitosamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para activar usuario por 7 días
  const activateSevenDaysMutation = useMutation({
    mutationFn: async ({ username, allowedBanks }: { username: string; allowedBanks?: string }) => {
      const response = await apiRequest('POST', `/api/users/${username}/activate-seven-days`, { allowedBanks });
      if (!response.ok) throw new Error('Error al activar usuario');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      toast({
        title: "Usuario activado",
        description: "Usuario activado por 7 días exitosamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para toggle status
  const toggleStatusMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiRequest('POST', `/api/toggle-user-status/${username}`);
      if (!response.ok) throw new Error('Error al cambiar estado');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Estado actualizado",
        description: "El estado del usuario ha sido actualizado",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Función para verificar si el usuario está vencido
  const isUserExpired = (user: User) => {
    if (!user.expiresAt) return false;
    return new Date(user.expiresAt) < new Date();
  };

  // Función para verificar si el usuario está por vencer (menos de 24 horas)
  const isUserExpiringSoon = (user: User) => {
    if (!user.expiresAt) return false;
    const expiresAt = new Date(user.expiresAt);
    const now = new Date();
    const hoursRemaining = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursRemaining < 24 && hoursRemaining > 0;
  };

  // Lista de bancos en orden alfabético
  const bankList = [
    'amex',
    'banbajio',
    'bancoazteca',
    'bancoppel',
    'banorte',
    'banregio',
    'bbva',
    'bienestar',
    'cajapopular',
    'citibanamex',
    'hsbc',
    'invex',
    'liverpool',
    'platacard',
    'santander',
    'scotiabank',
    'spin'
  ];

  // Función para obtener el nombre amigable del banco
  const getBankFriendlyName = (bank: string) => {
    const bankNames: { [key: string]: string } = {
      'amex': 'American Express',
      'banbajio': 'BanBajío',
      'bancoazteca': 'Banco Azteca',
      'bancoppel': 'BanCoppel',
      'banorte': 'Banorte',
      'banregio': 'Banregio',
      'bbva': 'BBVA',
      'bienestar': 'Banco del Bienestar',
      'cajapopular': 'Caja Popular',
      'citibanamex': 'Citibanamex',
      'hsbc': 'HSBC',
      'invex': 'Invex',
      'liverpool': 'Liverpool',
      'platacard': 'PlataCard',
      'santander': 'Santander',
      'scotiabank': 'Scotiabank',
      'spin': 'Spin'
    };
    return bankNames[bank] || bank.toUpperCase();
  };

  // Función para obtener el icono del banco
  const getBankIcon = (bank: string) => {
    if (bank === 'cajapopular' || bank === 'bienestar') return '🏛️';
    if (bank === 'liverpool') return '🛍️';
    if (bank === 'amex' || bank === 'platacard' || bank === 'spin') return '💳';
    return '🏦';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Cargando usuarios...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Usuarios Registrados</span>
            <Badge variant="secondary">{users.length} usuarios</Badge>
          </CardTitle>
          <CardDescription>
            Administra los usuarios del sistema y sus fechas de vencimiento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay usuarios registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Dispositivos</TableHead>
                    <TableHead>Expira</TableHead>
                    <TableHead>Bancos</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user: User) => (
                    <TableRow key={user.id} className={isUserExpired(user) ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <span>{user.username}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'destructive'}>
                          {isUserExpired(user) ? 'Vencido' : user.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                        {isUserExpiringSoon(user) && (
                          <Badge variant="outline" className="ml-1 text-yellow-600">
                            Por vencer
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Smartphone className="h-4 w-4" />
                          <span>{user.deviceCount || 0}/{user.maxDevices || 2}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.expiresAt ? (
                          <div className="flex items-center space-x-1">
                            <Clock className={`h-4 w-4 ${isUserExpired(user) ? 'text-red-500' : isUserExpiringSoon(user) ? 'text-yellow-500' : 'text-green-500'}`} />
                            <span className={isUserExpired(user) ? 'text-red-600 font-medium' : isUserExpiringSoon(user) ? 'text-yellow-600 font-medium' : ''}>
                              {formatDate(user.expiresAt)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sin límite</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-32">
                          {user.allowedBanks === 'all' ? (
                            <Badge variant="outline">Todos</Badge>
                          ) : user.allowedBanks ? (
                            <div className="flex flex-wrap gap-1">
                              {user.allowedBanks.split(',').slice(0, 2).map((bank) => (
                                <Badge key={bank} variant="outline" className="text-xs">
                                  {getBankFriendlyName(bank.trim())}
                                </Badge>
                              ))}
                              {user.allowedBanks.split(',').length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{user.allowedBanks.split(',').length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline">Todos</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          {/* Botón toggle activar/desactivar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleStatusMutation.mutate(user.username)}
                            disabled={toggleStatusMutation.isPending}
                          >
                            {user.isActive ? (
                              <ToggleRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-gray-500" />
                            )}
                          </Button>
                          
                          {/* Botón activar por 1 día - solo si no está activo o está vencido */}
                          {(!user.isActive || isUserExpired(user)) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => activateOneDayMutation.mutate({ username: user.username })}
                              disabled={activateOneDayMutation.isPending}
                              title="Activar por 1 día"
                            >
                              1D
                            </Button>
                          )}
                          
                          {/* Botón activar por 7 días - solo si no está activo o está vencido */}
                          {(!user.isActive || isUserExpired(user)) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => activateSevenDaysMutation.mutate({ username: user.username })}
                              disabled={activateSevenDaysMutation.isPending}
                              title="Activar por 7 días"
                            >
                              7D
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisteredUsersManagement;