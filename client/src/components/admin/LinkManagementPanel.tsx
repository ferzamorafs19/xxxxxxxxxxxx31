import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Link2, Clock, XCircle, Plus, RefreshCw, Copy, CheckCircle } from 'lucide-react';

interface LinkQuota {
  used: number;
  limit: number;
  allowed: boolean;
  resetsAt: string;
}

interface Link {
  id: number;
  token: string;
  bankCode: string;
  originalUrl: string;
  shortUrl: string | null;
  status: 'active' | 'consumed' | 'expired' | 'cancelled';
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  timeRemainingMs?: number;
  timeRemainingFormatted?: string;
  isExpired?: boolean;
}

const BANKS = [
  'afirme', 'citibanamex', 'banorte', 'bbva', 'santander',
  'hsbc', 'scotiabank', 'inbursa', 'bancoazteca'
].sort();

export function LinkManagementPanel() {
  const { toast } = useToast();
  const [selectedBank, setSelectedBank] = useState<string>('citibanamex');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: quota, refetch: refetchQuota } = useQuery<LinkQuota>({
    queryKey: ['/api/links/quota']
  });

  const { data: links = [], refetch: refetchLinks } = useQuery<Link[]>({
    queryKey: ['/api/links/history']
  });

  const generateMutation = useMutation({
    mutationFn: async (bankCode: string) => {
      const response = await apiRequest('POST', '/api/links', { bankCode });
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Link generado',
        description: `Link acortado con Bitly creado exitosamente`
      });
      refetchQuota();
      refetchLinks();
      if (data?.shortUrl) {
        copyToClipboard(data.shortUrl, 0);
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo generar el link',
        variant: 'destructive'
      });
    }
  });

  const extendMutation = useMutation({
    mutationFn: ({ linkId, minutes }: { linkId: number; minutes: number }) =>
      apiRequest('POST', `/api/links/${linkId}/extend`, { minutes }),
    onSuccess: () => {
      toast({
        title: 'Link extendido',
        description: 'Se extendió el tiempo de expiración del link'
      });
      refetchLinks();
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (linkId: number) =>
      apiRequest('POST', `/api/links/${linkId}/cancel`),
    onSuccess: () => {
      toast({
        title: 'Link cancelado',
        description: 'El link ha sido cancelado y ya no se puede usar'
      });
      refetchLinks();
    }
  });

  const copyToClipboard = (text: string, linkId: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(linkId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: 'Copiado',
      description: 'Link copiado al portapapeles'
    });
  };

  const getStatusBadge = (link: Link) => {
    if (link.status === 'consumed') {
      return <Badge variant="secondary" data-testid={`badge-status-${link.id}`}>Usado</Badge>;
    }
    if (link.status === 'expired' || link.isExpired) {
      return <Badge variant="destructive" data-testid={`badge-status-${link.id}`}>Expirado</Badge>;
    }
    if (link.status === 'cancelled') {
      return <Badge variant="outline" data-testid={`badge-status-${link.id}`}>Cancelado</Badge>;
    }
    return <Badge className="bg-green-500" data-testid={`badge-status-${link.id}`}>Activo</Badge>;
  };

  const quotaPercentage = quota ? (quota.used / quota.limit) * 100 : 0;
  const quotaColor = quotaPercentage > 90 ? 'text-red-500' : quotaPercentage > 70 ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="space-y-6">
      {/* Link Generator Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                Generar Link con Subdominio
              </CardTitle>
              <CardDescription>
                Genera links de un solo uso con subdominios personalizados y acortamiento con Bitly
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Cuota Semanal</p>
              <p className={`text-2xl font-bold ${quotaColor}`} data-testid="text-quota">
                {quota?.used || 0} / {quota?.limit || 150}
              </p>
              {quota?.resetsAt && (
                <p className="text-xs text-muted-foreground">
                  Renueva: {new Date(quota.resetsAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={selectedBank} onValueChange={setSelectedBank}>
              <SelectTrigger className="w-[200px]" data-testid="select-bank">
                <SelectValue placeholder="Seleccionar banco" />
              </SelectTrigger>
              <SelectContent>
                {BANKS.map((bank) => (
                  <SelectItem key={bank} value={bank} data-testid={`option-bank-${bank}`}>
                    {bank.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => generateMutation.mutate(selectedBank)}
              disabled={generateMutation.isPending || !quota?.allowed}
              data-testid="button-generate-link"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Generar Link
                </>
              )}
            </Button>
          </div>
          {!quota?.allowed && (
            <p className="text-sm text-red-500 mt-2" data-testid="text-quota-exceeded">
              Has alcanzado el límite semanal de {quota?.limit || 150} links
            </p>
          )}
        </CardContent>
      </Card>

      {/* Link History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Links</CardTitle>
          <CardDescription>
            Links generados con subdominios y su estado actual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banco</TableHead>
                <TableHead>Link Corto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Tiempo Restante</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay links generados aún
                  </TableCell>
                </TableRow>
              ) : (
                links.map((link) => (
                  <TableRow key={link.id} data-testid={`row-link-${link.id}`}>
                    <TableCell>
                      <Badge variant="outline" data-testid={`badge-bank-${link.id}`}>
                        {link.bankCode.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {link.shortUrl || link.originalUrl}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(link.shortUrl || link.originalUrl, link.id)}
                          data-testid={`button-copy-${link.id}`}
                        >
                          {copiedId === link.id ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(link)}</TableCell>
                    <TableCell>
                      {link.status === 'active' ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span data-testid={`text-time-${link.id}`}>
                            {link.timeRemainingFormatted || 'Calculando...'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-created-${link.id}`}>
                      {new Date(link.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {link.status === 'active' && !link.isExpired && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => extendMutation.mutate({ linkId: link.id, minutes: 30 })}
                            data-testid={`button-extend-${link.id}`}
                          >
                            +30m
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => cancelMutation.mutate(link.id)}
                            data-testid={`button-cancel-${link.id}`}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
