import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Shield } from "lucide-react";

export default function ExecutiveLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [requiresOtp, setRequiresOtp] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/executive/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error en el login");
      }

      const data = await response.json();

      if (data.requiresOtp) {
        setRequiresOtp(true);
        toast({
          title: "OTP Enviado",
          description: "Se ha enviado un código al Telegram de la oficina",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error de autenticación",
        description: error.message || "Credenciales inválidas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/executive/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ otpCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error en la verificación");
      }

      const data = await response.json();

      toast({
        title: "Acceso concedido",
        description: `Bienvenido ${data.user.username}`,
      });

      // Forzar recarga para actualizar el estado de autenticación
      window.location.href = "/admin";
    } catch (error: any) {
      toast({
        title: "Error de verificación",
        description: error.message || "Código OTP inválido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">
            {requiresOtp ? "Verificación OTP" : "Acceso Ejecutivo"}
          </CardTitle>
          <CardDescription className="text-center">
            {requiresOtp
              ? "Ingresa el código enviado al Telegram de la oficina"
              : "Ingresa tus credenciales de ejecutivo"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!requiresOtp ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  data-testid="input-executive-username"
                  type="text"
                  placeholder="usuario_ejecutivo"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  data-testid="input-executive-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <Button
                type="submit"
                data-testid="button-executive-login"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Código OTP</Label>
                <Input
                  id="otp"
                  data-testid="input-otp-code"
                  type="text"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  required
                  disabled={isLoading}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
              </div>
              <Button
                type="submit"
                data-testid="button-verify-otp"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Verificar OTP"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setRequiresOtp(false);
                  setOtpCode("");
                }}
              >
                Volver
              </Button>
            </form>
          )}

          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>¿Eres usuario regular?</p>
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => setLocation("/auth")}
            >
              Ir al login normal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
