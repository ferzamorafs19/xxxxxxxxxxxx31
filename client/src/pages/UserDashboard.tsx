import { UserSmsPanel } from "@/components/user/UserSmsPanel";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MessageSquare, User, Calendar } from "lucide-react";

export function UserDashboard() {
  const { user } = useAuth();

  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return "Nunca";
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleString('es-MX');
  };

  const getExpirationStatus = () => {
    if (!user?.expiresAt) return { text: "No establecido", color: "text-gray-600" };
    
    const expiresAt = new Date(user.expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return { text: "Expirado", color: "text-red-600" };
    if (daysLeft <= 3) return { text: `${daysLeft} días restantes`, color: "text-orange-600" };
    return { text: `${daysLeft} días restantes`, color: "text-green-600" };
  };

  const expirationStatus = getExpirationStatus();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Panel de Usuario</h1>
        <div className="text-sm text-gray-600">
          Bienvenido, {user?.username}
        </div>
      </div>

      {/* Información del usuario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Información de la Cuenta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Usuario</p>
              <p className="font-medium">{user?.username}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Estado</p>
              <p className={`font-medium ${user?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                {user?.isActive ? 'Activo' : 'Inactivo'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Último acceso</p>
              <p className="font-medium">{formatDate(user?.lastLogin)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Vencimiento</p>
              <p className={`font-medium ${expirationStatus.color}`}>
                {expirationStatus.text}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panel de SMS */}
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          Sistema de Mensajes SMS
        </h2>
        <UserSmsPanel />
      </div>
    </div>
  );
}