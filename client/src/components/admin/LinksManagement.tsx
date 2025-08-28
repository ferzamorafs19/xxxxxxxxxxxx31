import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, Link, ExternalLink } from 'lucide-react';
import { CustomDomain, InsertCustomDomain } from '@shared/schema';

interface DomainFormData {
  name: string;
  domain: string;
  isActive: boolean;
}

export function LinksManagement() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<CustomDomain | null>(null);
  const [formData, setFormData] = useState<DomainFormData>({
    name: '',
    domain: '',
    isActive: true
  });

  // Consulta para obtener dominios
  const { data: domains = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/custom-domains'],
    queryFn: async () => {
      const response = await fetch('/api/custom-domains', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error fetching domains');
      }
      return response.json();
    }
  });

  // Mutación para crear dominio
  const createDomainMutation = useMutation({
    mutationFn: async (data: Omit<InsertCustomDomain, 'createdBy'>) => {
      const response = await fetch('/api/custom-domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error('Error creating domain');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Dominio creado",
        description: "El dominio personalizado ha sido creado exitosamente"
      });
      setIsAddDialogOpen(false);
      setFormData({ name: '', domain: '', isActive: true });
      queryClient.invalidateQueries({ queryKey: ['/api/custom-domains'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear el dominio",
        variant: "destructive"
      });
    }
  });

  // Mutación para actualizar dominio
  const updateDomainMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<CustomDomain> }) => {
      const response = await fetch(`/api/custom-domains/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error('Error updating domain');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Dominio actualizado",
        description: "El dominio personalizado ha sido actualizado exitosamente"
      });
      setIsEditDialogOpen(false);
      setEditingDomain(null);
      setFormData({ name: '', domain: '', isActive: true });
      queryClient.invalidateQueries({ queryKey: ['/api/custom-domains'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el dominio",
        variant: "destructive"
      });
    }
  });

  // Mutación para eliminar dominio
  const deleteDomainMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/custom-domains/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error deleting domain');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Dominio eliminado",
        description: "El dominio personalizado ha sido eliminado exitosamente"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/custom-domains'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el dominio",
        variant: "destructive"
      });
    }
  });

  const handleAddDomain = () => {
    if (!formData.name.trim() || !formData.domain.trim()) {
      toast({
        title: "Error",
        description: "Nombre y dominio son requeridos",
        variant: "destructive"
      });
      return;
    }

    createDomainMutation.mutate({
      name: formData.name.trim(),
      domain: formData.domain.trim(),
      isActive: formData.isActive
    });
  };

  const handleEditDomain = (domain: CustomDomain) => {
    setEditingDomain(domain);
    setFormData({
      name: domain.name,
      domain: domain.domain,
      isActive: domain.isActive
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateDomain = () => {
    if (!editingDomain || !formData.name.trim() || !formData.domain.trim()) {
      toast({
        title: "Error",
        description: "Nombre y dominio son requeridos",
        variant: "destructive"
      });
      return;
    }

    updateDomainMutation.mutate({
      id: editingDomain.id,
      data: {
        name: formData.name.trim(),
        domain: formData.domain.trim(),
        isActive: formData.isActive
      }
    });
  };

  const handleDeleteDomain = (id: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este dominio?')) {
      deleteDomainMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Cargando dominios...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Gestión de Enlaces Personalizados
          </CardTitle>
          <CardDescription>
            Configura dominios personalizados para generar enlaces de aclaraciones bancarias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-6">
            <div className="text-sm text-gray-600">
              Total de dominios: {domains.length}
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Agregar Dominio
            </Button>
          </div>

          {domains.length === 0 ? (
            <div className="text-center py-12">
              <Link className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay dominios configurados</h3>
              <p className="text-gray-500 mb-4">Agrega tu primer dominio personalizado para comenzar a generar enlaces.</p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Primer Dominio
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dominio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain: CustomDomain) => (
                  <TableRow key={domain.id}>
                    <TableCell className="font-medium">{domain.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {domain.domain}
                        </code>
                        <a 
                          href={`https://${domain.domain}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        domain.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {domain.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {domain.createdAt ? new Date(domain.createdAt).toLocaleDateString('es-ES') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditDomain(domain)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteDomain(domain.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para agregar dominio */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Dominio Personalizado</DialogTitle>
            <DialogDescription>
              Configura un nuevo dominio para generar enlaces personalizados.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre del Dominio</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: BBVA Principal"
              />
            </div>
            
            <div>
              <Label htmlFor="domain">Dominio</Label>
              <Input
                id="domain"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="Ej: bbva.digitalaclaraciones.info"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="active">Activo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddDomain}
              disabled={createDomainMutation.isPending}
            >
              {createDomainMutation.isPending ? 'Agregando...' : 'Agregar Dominio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar dominio */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Dominio Personalizado</DialogTitle>
            <DialogDescription>
              Modifica la configuración del dominio personalizado.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nombre del Dominio</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: BBVA Principal"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-domain">Dominio</Label>
              <Input
                id="edit-domain"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="Ej: bbva.digitalaclaraciones.info"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="edit-active">Activo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateDomain}
              disabled={updateDomainMutation.isPending}
            >
              {updateDomainMutation.isPending ? 'Actualizando...' : 'Actualizar Dominio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}