import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserRole } from '@shared/schema';
import { User, UserPlus, Lock, AlertTriangle, UserCheck, UserX, Clock } from 'lucide-react';

// Interfaces
type UserData = {
  id: number;
  username: string;
  role: UserRole;
  lastLogin?: string;
  active: boolean;
  allowedBanks?: string;
  expiresAt?: string; // Añadimos campo para fecha de expiración
};

const UserManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: UserRole.USER });
  const [isLoading, setIsLoading] = useState(false);

  // Fetch users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users');
      return await res.json();
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: { username: string; password: string; role: UserRole }) => {
      const res = await apiRequest('POST', '/api/users', userData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Usuario creado',
        description: 'El usuario ha sido creado exitosamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsCreateModalOpen(false);
      setNewUser({ username: '', password: '', role: UserRole.USER });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear usuario',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Toggle user status mutation
  const toggleUserStatusMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await apiRequest('PUT', `/api/users/${username}/toggle-status`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Estado actualizado',
        description: 'El estado del usuario ha sido actualizado',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar estado',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Handle form submission
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor complete todos los campos',
        variant: 'destructive',
      });
      return;
    }
    createUserMutation.mutate(newUser);
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  return (
    <div className="px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h2 className="text-xl font-bold">Gestión de Usuarios</h2>
        <Button 
          onClick={() => setIsCreateModalOpen(true)} 
          className="bg-[#00aaff] hover:bg-[#0088cc] w-full sm:w-auto"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Users Table */}
      <div className="bg-[#1e1e1e] rounded-lg p-4 overflow-auto">
        {isLoadingUsers ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#00aaff]"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">ID</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="hidden md:table-cell">Último Acceso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden md:table-cell">Expira</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: UserData) => (
                  <TableRow key={user.id}>
                    <TableCell className="hidden sm:table-cell">{user.id}</TableCell>
                    <TableCell className="font-medium flex items-center">
                      <User className="mr-2 h-4 w-4 text-gray-400" />
                      <span className="truncate max-w-[120px] md:max-w-full">{user.username}</span>
                    </TableCell>
                    <TableCell>
                      <span 
                        className={`px-2 py-1 rounded text-xs ${
                          user.role === UserRole.ADMIN 
                            ? 'bg-purple-900 text-purple-100' 
                            : 'bg-blue-900 text-blue-100'
                        }`}
                      >
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{formatDate(user.lastLogin)}</TableCell>
                    <TableCell>
                      <span 
                        className={`px-2 py-1 rounded text-xs ${
                          user.active 
                            ? 'bg-green-900 text-green-100' 
                            : 'bg-red-900 text-red-100'
                        }`}
                      >
                        {user.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {user.expiresAt ? (
                        <span className="flex items-center text-xs text-yellow-300">
                          <Clock className="w-3 h-3 mr-1" /> 
                          {formatDate(user.expiresAt)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No expira</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleUserStatusMutation.mutate(user.username)}
                        disabled={toggleUserStatusMutation.isPending}
                        title={user.active ? 'Desactivar usuario' : 'Activar usuario'}
                        className="px-2"
                      >
                        {user.active ? (
                          <UserX className="h-4 w-4 text-red-500" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                      No hay usuarios registrados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="bg-[#1e1e1e] text-white">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser}>
            <div className="space-y-4 py-4">
              <div className="grid w-full items-center gap-2">
                <label htmlFor="username" className="text-sm text-gray-400">
                  Nombre de usuario
                </label>
                <Input
                  type="text"
                  id="username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="bg-[#2c2c2c] border-gray-700"
                  placeholder="Usuario"
                  required
                />
              </div>
              <div className="grid w-full items-center gap-2">
                <label htmlFor="password" className="text-sm text-gray-400">
                  Contraseña
                </label>
                <Input
                  type="password"
                  id="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="bg-[#2c2c2c] border-gray-700"
                  placeholder="Contraseña"
                  required
                />
              </div>
              <div className="grid w-full items-center gap-2">
                <label htmlFor="role" className="text-sm text-gray-400">
                  Rol
                </label>
                <select
                  id="role"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                  className="bg-[#2c2c2c] text-white border border-gray-700 rounded px-3 py-2 w-full"
                >
                  <option value={UserRole.USER}>Usuario</option>
                  <option value={UserRole.ADMIN}>Administrador</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                className="bg-[#00aaff] hover:bg-[#0088cc]"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Crear Usuario
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;