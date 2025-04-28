import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Clock, AlertCircle, Calendar } from 'lucide-react';
import { formatDate } from '@/utils/helpers';
import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';

interface SubscriptionData {
  isActive: boolean;
  isPaid: boolean;
  isAdmin: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  message: string;
}

const SubscriptionInfo: React.FC = () => {
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);
  
  // Consultar la información de suscripción
  const { data, isLoading, error } = useQuery<SubscriptionData>({
    queryKey: ['/api/user/subscription'],
    queryFn: getQueryFn(),
    refetchInterval: 3600000, // Refrescar cada hora (3600000 ms)
  });
  
  useEffect(() => {
    if (data && !data.isAdmin && data.expiresAt) {
      // Si queda menos de un día, consideramos que está expirando pronto
      const isExpiring = (data.daysRemaining === 0 && data.hoursRemaining !== null && data.hoursRemaining < 24) || 
                          (data.daysRemaining !== null && data.daysRemaining <= 1);
      setIsExpiringSoon(isExpiring);
    }
  }, [data]);
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Estado de Suscripción</CardTitle>
          <CardDescription>Cargando información...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (error || !data) {
    return (
      <Card className="border-red-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Estado de Suscripción</CardTitle>
          <CardDescription>Error al cargar información</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-500">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span>No se pudo cargar la información de suscripción</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Si es administrador, mostrar un mensaje especial
  if (data.isAdmin) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Estado de Cuenta</CardTitle>
          <CardDescription>Administrador del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center">
            <Badge className="bg-blue-500 text-white hover:bg-blue-500/80">
              <Check className="w-3 h-3 mr-1" /> Administrador
            </Badge>
            <span className="ml-2 text-sm text-muted-foreground">
              Acceso completo al sistema
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={isExpiringSoon ? 'border-orange-300' : (data.isPaid ? 'border-green-200' : 'border-red-200')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Estado de Suscripción</CardTitle>
        <CardDescription>
          {data.isPaid ? 'Suscripción activa' : 'Suscripción inactiva'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center">
            {data.isActive ? (
              <Badge className="bg-green-500 text-white hover:bg-green-500/80">
                <Check className="w-3 h-3 mr-1" /> Activo
              </Badge>
            ) : (
              <Badge variant="destructive">
                <X className="w-3 h-3 mr-1" /> Inactivo
              </Badge>
            )}
            
            {data.expiresAt && (
              <span className="ml-2 text-sm flex items-center">
                <Clock className="w-3 h-3 mr-1" /> 
                Expira: {formatDate(new Date(data.expiresAt))}
              </span>
            )}
          </div>
          
          {data.expiresAt && data.isPaid && (
            <div className="text-sm flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              <span className={isExpiringSoon ? 'text-orange-500 font-medium' : 'text-muted-foreground'}>
                {data.daysRemaining === 0 
                  ? `${data.hoursRemaining} horas restantes` 
                  : `${data.daysRemaining} días y ${data.hoursRemaining} horas restantes`}
              </span>
            </div>
          )}
          
          <div className={`text-sm mt-2 ${isExpiringSoon ? 'text-orange-500' : (data.isPaid ? 'text-green-600' : 'text-red-500')}`}>
            {data.message}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubscriptionInfo;