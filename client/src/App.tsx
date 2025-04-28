import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AdminPanel from "@/pages/AdminPanel";
import ClientScreen from "@/pages/ClientScreen";
import AuthPage from "@/pages/AuthPage";
import BankSelectionPage from "@/pages/BankSelectionPage";
import DiagnosticPage from "@/pages/DiagnosticPage";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function Router() {
  return (
    <Switch>
      <Route path="/" component={BankSelectionPage} />
      <Route path="/Balonx" component={AuthPage} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/admin" component={AdminPanel} adminOnly={false} />
      {/* Ruta principal para la pantalla del cliente usando el sessionId */}
      <Route path="/client/:sessionId" component={ClientScreen} />
      {/* Ruta para la página de diagnóstico */}
      <Route path="/diagnostic/:sessionId?" component={DiagnosticPage} />
      {/* Ruta adicional para permitir acceso directo a través del código en la URL principal */}
      <Route path="/:sessionId(\d{8})" component={ClientScreen} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
