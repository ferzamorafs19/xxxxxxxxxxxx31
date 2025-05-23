import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { BotDetector } from '@/utils/botDetector';
import { Captcha, MathCaptcha } from '@/components/Captcha';
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
  
  const [botDetection, setBotDetection] = useState({
    isBot: false,
    confidence: 0,
    reasons: [] as string[],
    showDetection: false
  });
  
  const [allowBotLogin, setAllowBotLogin] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaType, setCaptchaType] = useState<'visual' | 'math'>('visual');
  
  // Inicializar detector de bots
  useEffect(() => {
    BotDetector.initialize();
    
    // Verificar detección de bots cada 3 segundos
    const interval = setInterval(() => {
      const detection = BotDetector.detectBot();
      setBotDetection({
        ...detection,
        showDetection: detection.confidence > 30
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
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
    
    if (!captchaVerified) {
      toast({
        title: "Verificación requerida",
        description: "Por favor completa la verificación anti-bot",
        variant: "destructive"
      });
      return;
    }
    
    // Verificar detección de bots antes del login
    const currentDetection = BotDetector.detectBot();
    
    if (currentDetection.isBot && !allowBotLogin) {
      toast({
        title: "Acceso denegado",
        description: `Se detectó comportamiento automatizado (${currentDetection.confidence}% confianza). Usa la opción de administrador para permitir bots.`,
        variant: "destructive"
      });
      
      // Mostrar detalles de la detección
      setBotDetection({
        ...currentDetection,
        showDetection: true
      });
      
      return;
    }
    
    // Registrar intento de login
    BotDetector.recordInteraction('login_attempt');
    
    // Agregar información de detección al login
    const loginDataWithDetection = {
      ...loginData,
      botDetection: BotDetector.generateReport()
    };
    
    loginMutation.mutate(loginDataWithDetection);
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
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Iniciar Sesión
                  </CardTitle>
                  <CardDescription>
                    Ingresa tus credenciales para acceder al panel de administración
                  </CardDescription>
                  
                  {/* Indicador de detección de bots */}
                  {botDetection.showDetection && (
                    <Alert className={botDetection.isBot ? "border-red-500" : "border-yellow-500"}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          <span>
                            {botDetection.isBot ? "Bot detectado" : "Comportamiento sospechoso"} 
                            ({botDetection.confidence}% confianza)
                          </span>
                          <Badge variant={botDetection.isBot ? "destructive" : "secondary"}>
                            {botDetection.isBot ? "BOT" : "SOSPECHOSO"}
                          </Badge>
                        </div>
                        {botDetection.reasons.length > 0 && (
                          <ul className="mt-2 text-xs">
                            {botDetection.reasons.map((reason, index) => (
                              <li key={index}>• {reason}</li>
                            ))}
                          </ul>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Opción para permitir bots (solo para administradores) */}
                  {botDetection.isBot && (
                    <div className="flex items-center space-x-2 p-3 bg-yellow-50 rounded-lg">
                      <input
                        type="checkbox"
                        id="allowBot"
                        checked={allowBotLogin}
                        onChange={(e) => setAllowBotLogin(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="allowBot" className="text-sm">
                        Permitir acceso de bots (Solo administradores)
                      </Label>
                    </div>
                  )}
                </CardHeader>
                <form onSubmit={handleLoginSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-username">Usuario</Label>
                      <Input 
                        id="login-username" 
                        type="text" 
                        value={loginData.username} 
                        onChange={e => {
                          setLoginData({...loginData, username: e.target.value});
                          BotDetector.recordInteraction('username_input');
                        }}
                        onFocus={() => BotDetector.recordInteraction('username_focus')}
                        placeholder="Nombre de usuario"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Contraseña</Label>
                      <Input 
                        id="login-password" 
                        type="password" 
                        value={loginData.password} 
                        onChange={e => {
                          setLoginData({...loginData, password: e.target.value});
                          BotDetector.recordInteraction('password_input');
                        }}
                        onFocus={() => BotDetector.recordInteraction('password_focus')}
                        placeholder="Contraseña"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col space-y-2">
                    <Button 
                      type="submit" 
                      className={`w-full ${
                        (botDetection.isBot && !allowBotLogin) || !captchaVerified 
                          ? 'bg-red-600 hover:bg-red-700' 
                          : captchaVerified 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : ''
                      }`}
                      disabled={
                        loginMutation.isPending || 
                        (botDetection.isBot && !allowBotLogin) ||
                        !captchaVerified
                      }
                      onClick={() => BotDetector.recordInteraction('login_button_click')}
                    >
                      {loginMutation.isPending ? "Procesando..." : 
                       botDetection.isBot && !allowBotLogin ? "Bot Bloqueado" :
                       !captchaVerified ? "Complete Verificación" :
                       "Iniciar Sesión"}
                    </Button>
                    
                    {/* Indicador de estado de detección y verificación */}
                    <div className="flex flex-col items-center space-y-1 text-xs text-gray-500">
                      <div className="flex items-center space-x-2">
                        {botDetection.confidence < 30 ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>Comportamiento humano detectado</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3 text-yellow-500" />
                            <span>Monitoreando comportamiento...</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {captchaVerified ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>Captcha verificado</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3 text-orange-500" />
                            <span>Esperando verificación captcha</span>
                          </>
                        )}
                      </div>
                    </div>
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