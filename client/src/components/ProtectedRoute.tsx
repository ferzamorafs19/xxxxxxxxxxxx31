import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
  adminOnly?: boolean;
}

export function ProtectedRoute({
  path,
  component: Component,
  adminOnly = false,
}: ProtectedRouteProps) {
  const { user, isLoading, isAdmin } = useAuth();

  return (
    <Route path={path}>
      {() => {
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          );
        }

        if (!user) {
          return <Redirect to="/auth" />;
        }

        if (adminOnly && !isAdmin) {
          return (
            <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
              <h1 className="text-2xl font-bold text-red-500">Acceso denegado</h1>
              <p className="text-gray-600">No tienes permisos de administrador para acceder a esta página.</p>
            </div>
          );
        }

        return <Component />;
      }}
    </Route>
  );
}