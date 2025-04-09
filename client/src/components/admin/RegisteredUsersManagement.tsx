import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, Clock, User, Calendar, Smartphone, ToggleLeft, ToggleRight, Trash, Settings, Building, Link as LinkIcon } from 'lucide-react';
import { formatDate } from '@/utils/helpers';
import { useToast } from '@/hooks/use-toast';
import { useDeviceInfo } from '@/hooks/use-device-orientation';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BankType } from '@shared/schema';

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
}

const RegisteredUsersManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [bankOptions, setBankOptions] = useState<string[]>(['all']);
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [selectedBank, setSelectedBank] = useState<string>('BANORTE');
  const { isMobile, isLandscape } = useDeviceInfo();

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
    // Forzar refresco automático cada 3 segundos para mantener los datos actualizados
    // Esto es necesario porque parece que la invalidación de caché no está funcionando correctamente
    refetchInterval: 3000
  });
  
  // Manejar errores y éxitos de manera independiente
  React.useEffect(() => {
    if (error) {
      console.error('[RegisteredUsers] Error al obtener usuarios:', error);
    }
  }, [error]);
  
  React.useEffect(() => {
    if (users && users.length > 0) {
      console.log('[RegisteredUsers] Usuarios obtenidos:', users.length);
      // Mostrar detalles de los usuarios para depuración
      users.forEach(user => {
        console.log(`Usuario: ${user.username}, Activo: ${user.isActive}, Expira: ${user.expiresAt || 'No establecido'}`);
      });
    }
  }, [users]);

  // Activar usuario por 1 día
  const activateOneDayMutation = useMutation({
    mutationFn: async (username: string) => {
      console.log(`[RegisteredUsers] Intentando activar usuario ${username} por 1 día`);
      // Si el usuario seleccionado tiene bancos permitidos, incluirlos en la solicitud
      const payload = selectedUser?.allowedBanks 
        ? { allowedBanks: selectedUser.allowedBanks }
        : {};
        
      const res = await apiRequest(
        'POST',
        `/api/users/regular/${username}/activate-one-day`,
        payload
      );
      const data = await res.json();
      console.log(`[RegisteredUsers] Respuesta de activación por 1 día:`, data);
      return data;
    },
    onSuccess: (data) => {
      console.log(`[RegisteredUsers] Activación por 1 día exitosa:`, data);
      // Invalidar la consulta y forzar su recarga
      queryClient.invalidateQueries({ queryKey: ['/api/users/regular'] });
      refetch(); // Forzar una recarga inmediata
      toast({
        title: 'Usuario activado',
        description: 'El usuario ha sido activado por 1 día. ' + 
          (data.user?.expiresAt ? `Expira: ${formatDate(new Date(data.user.expiresAt))}` : ''),
      });
      
      // Cerrar el diálogo si está abierto
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      console.error(`[RegisteredUsers] Error al activar usuario por 1 día:`, error);
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
      console.log(`[RegisteredUsers] Intentando activar usuario ${username} por 7 días`);
      // Si el usuario seleccionado tiene bancos permitidos, incluirlos en la solicitud
      const payload = selectedUser?.allowedBanks 
        ? { allowedBanks: selectedUser.allowedBanks }
        : {};
        
      const res = await apiRequest(
        'POST',
        `/api/users/regular/${username}/activate-seven-days`,
        payload
      );
      const data = await res.json();
      console.log(`[RegisteredUsers] Respuesta de activación por 7 días:`, data);
      return data;
    },
    onSuccess: (data) => {
      console.log(`[RegisteredUsers] Activación por 7 días exitosa:`, data);
      // Invalidar la consulta y forzar su recarga
      queryClient.invalidateQueries({ queryKey: ['/api/users/regular'] });
      refetch(); // Forzar una recarga inmediata
      toast({
        title: 'Usuario activado',
        description: 'El usuario ha sido activado por 7 días. ' + 
          (data.user?.expiresAt ? `Expira: ${formatDate(new Date(data.user.expiresAt))}` : ''),
      });
      
      // Cerrar el diálogo si está abierto
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      console.error(`[RegisteredUsers] Error al activar usuario por 7 días:`, error);
      toast({
        title: 'Error al activar usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Alternar estado (activar/desactivar)
  const toggleUserStatusMutation = useMutation({
    mutationFn: async (username: string) => {
      console.log(`[RegisteredUsers] Intentando alternar estado del usuario ${username}`);
      const res = await apiRequest(
        'POST',
        `/api/users/regular/${username}/toggle-status`
      );
      const data = await res.json();
      console.log(`[RegisteredUsers] Respuesta de toggle estado:`, data);
      return data;
    },
    onSuccess: (data) => {
      console.log(`[RegisteredUsers] Toggle de estado exitoso:`, data);
      // Invalidar la consulta y forzar su recarga
      queryClient.invalidateQueries({ queryKey: ['/api/users/regular'] });
      refetch(); // Forzar una recarga inmediata
      toast({
        title: `Usuario ${data.user.isActive ? 'activado' : 'desactivado'}`,
        description: `El estado del usuario ha sido cambiado a ${data.user.isActive ? 'activo' : 'inactivo'}.`,
      });
    },
    onError: (error: Error) => {
      console.error(`[RegisteredUsers] Error al alternar estado:`, error);
      toast({
        title: 'Error al cambiar estado',
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
      refetch(); // Forzar recarga inmediata
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
  
  // Eliminar un usuario
  const deleteUserMutation = useMutation({
    mutationFn: async (username: string) => {
      console.log(`[RegisteredUsers] Intentando eliminar usuario ${username}`);
      const res = await apiRequest(
        'DELETE',
        `/api/users/regular/${username}`
      );
      const data = await res.json();
      console.log(`[RegisteredUsers] Respuesta de eliminación:`, data);
      return data;
    },
    onSuccess: (data) => {
      console.log(`[RegisteredUsers] Eliminación exitosa:`, data);
      // Invalidar la consulta y forzar su recarga
      queryClient.invalidateQueries({ queryKey: ['/api/users/regular'] });
      refetch(); // Forzar una recarga inmediata
      toast({
        title: 'Usuario eliminado',
        description: data.message || 'El usuario ha sido eliminado correctamente.',
      });
    },
    onError: (error: Error) => {
      console.error(`[RegisteredUsers] Error al eliminar usuario:`, error);
      toast({
        title: 'Error al eliminar usuario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Generar enlace para usuario
  const generateLinkMutation = useMutation({
    mutationFn: async (banco: string) => {
      console.log(`[RegisteredUsers] Generando enlace para el banco: ${banco}`);
      const res = await apiRequest('GET', `/api/generate-link?banco=${banco}`);
      return await res.json();
    },
    onSuccess: (data) => {
      setGeneratedLink(data.link);
      setGeneratedCode(data.code);
      setIsLinkDialogOpen(true);
      
      toast({
        title: "Enlace generado",
        description: `Enlace generado exitosamente con código: ${data.code}`,
      });
      
      // Invalidar la consulta para actualizar la lista de sesiones
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al generar enlace",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Manejar activaciones de usuario
  const handleOpenBankOptions = (user: User) => {
    setSelectedUser(user);
    // Inicializar las opciones de bancos seleccionadas basadas en el usuario actual
    const banksList = user.allowedBanks === 'all' 
      ? ['all'] 
      : user.allowedBanks?.split(',') || ['all'];
    setBankOptions(banksList);
    setIsDialogOpen(true);
  };
  
  const handleUpdateBankOptions = () => {
    if (!selectedUser) return;
    
    // Actualizaremos los bancos permitidos cuando el usuario se active
    // No necesitamos hacer nada más aquí, ya que las mutaciones de activación
    // enviarán la información actualizada
    setIsDialogOpen(false);
  };
  
  const handleBankOptionChange = (bank: string) => {
    // Si seleccionamos 'all', eliminamos todas las demás opciones
    if (bank === 'all') {
      setBankOptions(['all']);
      return;
    }
    
    // Si ya tenemos 'all' seleccionado y elegimos una opción específica, eliminamos 'all'
    if (bankOptions.includes('all')) {
      setBankOptions([bank]);
      return;
    }
    
    // Si ya tenemos la opción seleccionada, la removemos, a menos que sea la única
    if (bankOptions.includes(bank) && bankOptions.length > 1) {
      setBankOptions(bankOptions.filter(b => b !== bank));
      return;
    }
    
    // Si tenemos menos de 3 bancos seleccionados y no incluye 'all', agregamos la opción
    if (bankOptions.length < 3 && !bankOptions.includes('all') && !bankOptions.includes(bank)) {
      setBankOptions([...bankOptions, bank]);
      return;
    }
    
    // Si ya tenemos 3 bancos y seleccionamos uno nuevo, mostramos un mensaje
    if (bankOptions.length >= 3 && !bankOptions.includes(bank) && !bankOptions.includes('all')) {
      toast({
        title: 'Límite alcanzado',
        description: 'Solo puede seleccionar hasta 3 bancos específicos, o la opción "Todos".',
        variant: 'destructive',
      });
    }
  };
  
  const handleActivateOneDay = (username: string) => {
    // Si hay un usuario seleccionado, actualiza sus bancos permitidos
    if (selectedUser?.username === username) {
      selectedUser.allowedBanks = bankOptions.join(',');
    }
    activateOneDayMutation.mutate(username);
  };

  const handleActivateSevenDays = (username: string) => {
    // Si hay un usuario seleccionado, actualiza sus bancos permitidos
    if (selectedUser?.username === username) {
      selectedUser.allowedBanks = bankOptions.join(',');
    }
    activateSevenDaysMutation.mutate(username);
  };

  const handleToggleStatus = (username: string) => {
    toggleUserStatusMutation.mutate(username);
  };

  const handleCleanupExpiredUsers = () => {
    cleanupExpiredUsersMutation.mutate();
  };
  
  const handleDeleteUser = (username: string) => {
    // Confirmación antes de eliminar
    if (window.confirm(`¿Estás seguro de que deseas eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) {
      deleteUserMutation.mutate(username);
    }
  };
  
  // Manejador para generar un nuevo enlace
  const handleGenerateLink = (user: User) => {
    // Determinar qué banco usar
    let bancoSeleccionado = selectedBank;
    
    // Si el usuario tiene bancos específicos, usar el primero
    if (user.allowedBanks && user.allowedBanks !== 'all') {
      const bancos = user.allowedBanks.split(',');
      if (bancos.length > 0) {
        bancoSeleccionado = bancos[0].toUpperCase();
      }
    }
    
    // Generar el enlace directamente (alternativa para cuando hay problemas de autenticación)
    // Primero asegurarnos de que el usuario esté activo
    if (!user.isActive) {
      toast({
        title: "Usuario inactivo",
        description: "El usuario debe estar activo para generar enlaces",
        variant: "destructive"
      });
      return;
    }
    
    if (user.username === "balonx") {
      // Para el administrador, usamos la API normal
      generateLinkMutation.mutate(bancoSeleccionado);
    } else {
      // Mostrar mensaje de generación
      toast({
        title: "Generando enlace",
        description: `Creando enlace para ${bancoSeleccionado}...`,
      });
      
      // Abrir directamente la URL en modo admin en una nueva pestaña
      window.open(`/admin?generateLink=true&banco=${bancoSeleccionado}`, '_blank');
    }
  };
  
  // Función para copiar el enlace al portapapeles
  const copyGeneratedLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink)
        .then(() => {
          toast({
            title: "Enlace copiado",
            description: "El enlace ha sido copiado al portapapeles",
          });
        })
        .catch(err => {
          console.error('Error al copiar al portapapeles:', err);
          toast({
            title: "Error al copiar",
            description: "No se pudo copiar el enlace",
            variant: "destructive",
          });
        });
    }
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
    <>
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
                  {/* Renderización condicional basada en si es móvil y orientación */}
                  {!isMobile || isLandscape ? (
                    /* Vista para desktop o móvil en landscape: tabla */
                    <div className="overflow-x-auto max-h-[70vh] overflow-y-auto pr-2">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
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
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {user.username}
                                  {user.allowedBanks && (
                                    <Badge variant="outline" className="px-1.5 py-0 h-5">
                                      <Building className="h-3 w-3 mr-1" /> 
                                      {user.allowedBanks === 'all' ? 'Todos' : user.allowedBanks.split(',').length}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
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
                                    onClick={() => handleOpenBankOptions(user)}
                                    disabled={activateOneDayMutation.isPending || activateSevenDaysMutation.isPending}
                                    title="Configurar bancos y activar"
                                  >
                                    <Building className="w-4 h-4 mr-1" /> Activar
                                  </Button>
                                  <Button 
                                    variant={user.isActive ? "destructive" : "default"}
                                    size="sm"
                                    className="ml-2"
                                    onClick={() => handleToggleStatus(user.username)}
                                    disabled={toggleUserStatusMutation.isPending}
                                  >
                                    {user.isActive ? 
                                      <><ToggleRight className="w-4 h-4 mr-1" /> Desactivar</> : 
                                      <><ToggleLeft className="w-4 h-4 mr-1" /> Activar</>
                                    }
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    className="ml-2"
                                    onClick={() => handleDeleteUser(user.username)}
                                    disabled={deleteUserMutation.isPending}
                                  >
                                    <Trash className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    /* Vista para móvil en portrait: tarjetas */
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                      {users.map((user) => (
                        <div key={user.id} className="border rounded-lg p-4 bg-card">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-2">
                              <User className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium">{user.username}</span>
                              {user.allowedBanks && (
                                <Badge variant="outline" className="px-1.5 py-0 h-5 ml-1">
                                  <Building className="h-3 w-3 mr-1" /> 
                                  {user.allowedBanks === 'all' ? 'Todos' : user.allowedBanks.split(',').length}
                                </Badge>
                              )}
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
                              onClick={() => handleOpenBankOptions(user)}
                              disabled={activateOneDayMutation.isPending || activateSevenDaysMutation.isPending}
                            >
                              <Building className="w-4 h-4 mr-1" /> Configurar bancos
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="flex-1"
                              onClick={() => handleGenerateLink(user)}
                              disabled={!user.isActive || generateLinkMutation.isPending}
                            >
                              <LinkIcon className="w-4 h-4 mr-1" /> Generar enlace
                            </Button>
                          </div>
                          <div className="mt-2 pt-2 border-t">
                            <Button 
                              variant={user.isActive ? "destructive" : "default"}
                              size="sm"
                              className="w-full mb-2"
                              onClick={() => handleToggleStatus(user.username)}
                              disabled={toggleUserStatusMutation.isPending}
                            >
                              {user.isActive ? 
                                <><ToggleRight className="w-4 h-4 mr-1" /> Desactivar usuario</> : 
                                <><ToggleLeft className="w-4 h-4 mr-1" /> Activar usuario</>
                              }
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              className="w-full"
                              onClick={() => handleDeleteUser(user.username)}
                              disabled={deleteUserMutation.isPending}
                            >
                              <Trash className="w-4 h-4 mr-1" /> Eliminar usuario
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

      {/* Dialog para configurar bancos permitidos */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Bancos Permitidos</DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <>
                  Selecciona los bancos a los que el usuario <strong>{selectedUser.username}</strong> tendrá acceso.
                  Puedes seleccionar hasta 3 bancos específicos o la opción "Todos".
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <div 
                  className={`cursor-pointer px-3 py-2 rounded-md flex items-center ${
                    bankOptions.includes('all') ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                  onClick={() => handleBankOptionChange('all')}
                >
                  <Building className="w-4 h-4 mr-2" />
                  <span>Todos los bancos</span>
                </div>
                {Object.values(BankType)
                  .filter(bank => bank !== BankType.ALL) // Excluir "all" ya que lo mostramos arriba
                  .map((bank) => (
                    <div 
                      key={bank}
                      className={`cursor-pointer px-3 py-2 rounded-md flex items-center ${
                        bankOptions.includes(bank) ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                      onClick={() => handleBankOptionChange(bank)}
                    >
                      <span className="capitalize">{bank}</span>
                    </div>
                  ))}
              </div>
            </div>
            
            <div className="bg-muted p-3 rounded-md">
              <h4 className="font-medium text-sm mb-2">Bancos seleccionados:</h4>
              <div className="text-sm">
                {bankOptions.includes('all') ? (
                  <p>Todos los bancos</p>
                ) : (
                  <p>{bankOptions.map(bank => (
                    <span key={bank} className="inline-block bg-primary/20 rounded px-2 py-1 mr-1 mb-1 capitalize">
                      {bank}
                    </span>
                  ))}</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="sm:w-auto w-full"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (selectedUser) {
                  setIsDialogOpen(false);
                  // Abrimos un diálogo para elegir la duración de la activación
                  const duration = window.confirm(
                    "¿Desea activar el usuario por 7 días?\n\nPresione OK para activar por 7 días o Cancelar para activar por 1 día."
                  );
                  
                  if (duration) {
                    handleActivateSevenDays(selectedUser.username);
                  } else {
                    handleActivateOneDay(selectedUser.username);
                  }
                }
              }}
              className="sm:w-auto w-full"
            >
              Activar Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para mostrar el enlace generado */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enlace Generado</DialogTitle>
            <DialogDescription>
              Se ha generado un nuevo enlace de cliente con el siguiente código.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-center">
              <span className="font-bold text-xl px-3 py-1 rounded-md bg-green-600/20 text-green-400">
                Código: <span className="text-2xl tracking-wider">{generatedCode}</span>
              </span>
            </div>
            
            <div className="bg-muted/30 p-4 rounded-md break-all">
              <p className="text-primary font-medium mb-2">Enlace del cliente:</p>
              <a 
                href={generatedLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline break-all"
              >
                {generatedLink}
              </a>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsLinkDialogOpen(false)}
              className="sm:w-auto w-full"
            >
              Cerrar
            </Button>
            <Button
              type="button"
              onClick={copyGeneratedLink}
              className="sm:w-auto w-full"
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              Copiar Enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RegisteredUsersManagement;