import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, CreditCard } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export function SmsCreditsManager() {
  const [username, setUsername] = useState("");
  const [credits, setCredits] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutación para agregar créditos
  const addCreditsMutation = useMutation({
    mutationFn: async (data: { username: string; credits: number }) => {
      const response = await apiRequest("/api/admin/sms/add-credits", "POST", data);
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Créditos agregados",
        description: data?.message || "Los créditos se agregaron correctamente",
      });
      setUsername("");
      setCredits("");
      // Invalidar queries relacionadas si es necesario
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al agregar créditos",
        description: error.message || "No se pudieron agregar los créditos",
        variant: "destructive",
      });
    },
  });

  const handleAddCredits = () => {
    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Debes ingresar un nombre de usuario",
        variant: "destructive",
      });
      return;
    }

    const creditsNumber = parseInt(credits);
    if (!credits || creditsNumber <= 0) {
      toast({
        title: "Error",
        description: "Debes ingresar una cantidad válida de créditos",
        variant: "destructive",
      });
      return;
    }

    addCreditsMutation.mutate({
      username: username.trim(),
      credits: creditsNumber
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Gestión de Créditos SMS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="username">Nombre de usuario</Label>
            <Input
              id="username"
              placeholder="Ejemplo: Brandon19"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={addCreditsMutation.isPending}
            />
          </div>

          <div>
            <Label htmlFor="credits">Cantidad de créditos</Label>
            <Input
              id="credits"
              type="number"
              placeholder="10"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              disabled={addCreditsMutation.isPending}
              min="1"
            />
          </div>
        </div>

        <Button 
          onClick={handleAddCredits}
          disabled={addCreditsMutation.isPending}
          className="w-full"
        >
          {addCreditsMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Agregando créditos...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Créditos
            </>
          )}
        </Button>

        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Instrucciones:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Ingresa el nombre exacto del usuario (ej: Brandon19)</li>
            <li>Los créditos se suman a los existentes</li>
            <li>1 crédito = 1 SMS</li>
            <li>Los administradores no necesitan créditos para enviar SMS</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}