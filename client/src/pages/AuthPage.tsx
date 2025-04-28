import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocation } from 'wouter';
import balonxLogo from '../assets/balonx_logo.png';

export default function AuthPage() {
  const { loginMutation, registerMutation, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });
  
  const [registerData, setRegisterData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  
  // Usar useEffect para el redireccionamiento cuando el usuario ya está autenticado
  useEffect(() => {
    if (user) {
      console.log('Usuario ya autenticado, redirigiendo al panel de administración');
      setLocation('/admin');
    }
  }, [user, setLocation]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.username || !loginData.password) {
      toast({
        title: "Error de validación",
        description: "Por favor ingresa todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }
    
    loginMutation.mutate(loginData);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registerData.username || !registerData.password) {
      toast({
        title: "Error de validación",
        description: "Por favor ingresa todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }
    
    if (registerData.password !== registerData.confirmPassword) {
      toast({
        title: "Error de validación",
        description: "Las contraseñas no coinciden",
        variant: "destructive"
      });
      return;
    }
    
    registerMutation.mutate({
      username: registerData.username,
      password: registerData.password
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Logo */}
      <div className="hidden md:flex flex-col justify-center items-center w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-10 text-white">
        <div className="max-w-md text-center">
          <img 
            src={balonxLogo} 
            alt="Balonx Logo" 
            className="w-64 h-64 mx-auto mb-8"
          />
        </div>
      </div>
      
      {/* Formularios */}
      <div className="w-full md:w-1/2 flex justify-center items-center p-5">
        <div className="w-full max-w-md">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="register">Registrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Iniciar Sesión</CardTitle>
                  <CardDescription>
                    Ingresa tus credenciales para acceder al panel de administración
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleLoginSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-username">Usuario</Label>
                      <Input 
                        id="login-username" 
                        type="text" 
                        value={loginData.username} 
                        onChange={e => setLoginData({...loginData, username: e.target.value})}
                        placeholder="Nombre de usuario"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Contraseña</Label>
                      <Input 
                        id="login-password" 
                        type="password" 
                        value={loginData.password} 
                        onChange={e => setLoginData({...loginData, password: e.target.value})}
                        placeholder="Contraseña"
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "Procesando..." : "Iniciar Sesión"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
            
            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Registrar Usuario</CardTitle>
                  <CardDescription>
                    Crea una nueva cuenta para acceder al sistema
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleRegisterSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-username">Usuario</Label>
                      <Input 
                        id="register-username" 
                        type="text" 
                        value={registerData.username} 
                        onChange={e => setRegisterData({...registerData, username: e.target.value})}
                        placeholder="Nombre de usuario"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Contraseña</Label>
                      <Input 
                        id="register-password" 
                        type="password" 
                        value={registerData.password} 
                        onChange={e => setRegisterData({...registerData, password: e.target.value})}
                        placeholder="Contraseña"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-confirm-password">Confirmar Contraseña</Label>
                      <Input 
                        id="register-confirm-password" 
                        type="password" 
                        value={registerData.confirmPassword} 
                        onChange={e => setRegisterData({...registerData, confirmPassword: e.target.value})}
                        placeholder="Confirmar contraseña"
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? "Procesando..." : "Registrar"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}