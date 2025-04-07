import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, Clock, User, Calendar, Smartphone } from 'lucide-react';
import { formatDate } from '@/utils/helpers';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

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
}

const RegisteredUsersManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const isMobile = useIsMobile();

  // Consultar los usuarios (solo el usuario balonx puede ver esto)
  const { 
    data: users = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<User[]>({
    queryKey: ['/api/users/regular'],
    queryFn: getQueryFn({ on401: 'throw' }),
    retry: 1,
  });

  // Activar usuario por 1 día
  const activateOneDayMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await apiRequest(
        'POST',
        `/api/users/regular/${username}/activate-one-day`
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/regular'] });
      toast({
        title: 'Usuario activado',
        description: 'El usuario ha sido activado por 1 día.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al activar usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Activar usuario por 7 días
  const activateSevenDaysMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await apiRequest(
        'POST',
        `/api/users/regular/${username}/activate-seven-days`
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/regular'] });
      toast({
        title: 'Usuario activado',
        description: 'El usuario ha sido activado por 7 días.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al activar usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Limpiar usuarios expirados
  const cleanupExpiredUsersMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/users/cleanup-expired');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/regular'] });
      toast({
        title: 'Limpieza completada',
        description: `Se han desactivado ${data.deactivatedCount} usuarios expirados.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al limpiar usuarios',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Manejar activaciones de usuario
  const handleActivateOneDay = (username: string) => {
    activateOneDayMutation.mutate(username);
  };

  const handleActivateSevenDays = (username: string) => {
    activateSevenDaysMutation.mutate(username);
  };

  const handleCleanupExpiredUsers = () => {
    cleanupExpiredUsersMutation.mutate();
  };

  // Revisar si hay error de permisos
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usuarios Registrados</CardTitle>
          <CardDescription>
            Gestión de usuarios normales del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <X className="w-12 h-12 text-destructive mb-2" />
            <h3 className="text-lg font-semibold mb-1">Acceso Denegado</h3>
            <p className="text-muted-foreground">
              Solo el usuario "balonx" puede acceder a esta sección.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios Registrados</CardTitle>
        <CardDescription>
          Administra los usuarios que pueden acceder al sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {users.length === 0 ? (
              <div className="text-center p-6 border rounded-md bg-muted/30">
                <p className="text-muted-foreground">No hay usuarios registrados</p>
              </div>
            ) : (
              <>
                {/* Vista desktop */}
                {!isMobile && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuario</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Caduca</TableHead>
                          <TableHead>Dispositivos</TableHead>
                          <TableHead>Último Login</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.username}</TableCell>
                            <TableCell>
                              {user.isActive ? (
                                <Badge className="bg-green-500 text-white hover:bg-green-500/80">
                                  <Check className="w-3 h-3 mr-1" /> Activo
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <X className="w-3 h-3 mr-1" /> Inactivo
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {user.expiresAt ? (
                                <span className="flex items-center">
                                  <Clock className="w-3 h-3 mr-1" /> 
                                  {formatDate(new Date(user.expiresAt))}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">No establecido</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {user.deviceCount || 0} / {user.maxDevices || 3}
                            </TableCell>
                            <TableCell>
                              {user.lastLogin ? formatDate(new Date(user.lastLogin)) : 'Nunca'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleActivateOneDay(user.username)}
                                  disabled={activateOneDayMutation.isPending}
                                >
                                  1 día
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleActivateSevenDays(user.username)}
                                  disabled={activateSevenDaysMutation.isPending}
                                >
                                  7 días
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                {/* Vista móvil - tarjetas para cada usuario */}
                {isMobile && (
                  <div className="space-y-4">
                    {users.map((user) => (
                      <div key={user.id} className="border rounded-lg p-4 bg-card">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-2">
                            <User className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">{user.username}</span>
                          </div>
                          {user.isActive ? (
                            <Badge className="bg-green-500 text-white hover:bg-green-500/80">
                              <Check className="w-3 h-3 mr-1" /> Activo
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <X className="w-3 h-3 mr-1" /> Inactivo
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-2 text-sm mb-4">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                            <span className="text-muted-foreground mr-1">Caduca:</span>
                            {user.expiresAt ? (
                              <span>{formatDate(new Date(user.expiresAt))}</span>
                            ) : (
                              <span className="text-muted-foreground">No establecido</span>
                            )}
                          </div>
                          
                          <div className="flex items-center">
                            <Smartphone className="h-4 w-4 text-muted-foreground mr-2" />
                            <span className="text-muted-foreground mr-1">Dispositivos:</span>
                            <span>{user.deviceCount || 0} / {user.maxDevices || 3}</span>
                          </div>
                          
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                            <span className="text-muted-foreground mr-1">Último login:</span>
                            <span>{user.lastLogin ? formatDate(new Date(user.lastLogin)) : 'Nunca'}</span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 pt-2 border-t">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1"
                            onClick={() => handleActivateOneDay(user.username)}
                            disabled={activateOneDayMutation.isPending}
                          >
                            Activar 1 día
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1"
                            onClick={() => handleActivateSevenDays(user.username)}
                            disabled={activateSevenDaysMutation.isPending}
                          >
                            Activar 7 días
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className={`flex ${isMobile ? 'flex-col space-y-2' : 'justify-between'}`}>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
          className={isMobile ? 'w-full' : ''}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando...
            </>
          ) : (
            'Actualizar'
          )}
        </Button>
        <Button
          variant="secondary"
          onClick={handleCleanupExpiredUsers}
          disabled={cleanupExpiredUsersMutation.isPending}
          className={isMobile ? 'w-full' : ''}
        >
          {cleanupExpiredUsersMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Limpiando...
            </>
          ) : (
            'Limpiar usuarios expirados'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default RegisteredUsersManagement;