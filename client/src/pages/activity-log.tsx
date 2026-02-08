import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  RefreshCw,
  Loader2,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Shield,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  ipAddress: string;
  createdAt: string;
  companyId: string;
}

interface ActivityLogsResponse {
  logs: ActivityLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const actionConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  create: { label: "Criar", variant: "default" },
  update: { label: "Atualizar", variant: "secondary" },
  delete: { label: "Excluir", variant: "destructive" },
  backup: { label: "Backup", variant: "outline" },
  restore: { label: "Restaurar", variant: "outline" },
  login: { label: "Login", variant: "secondary" },
};

const resourceLabels: Record<string, string> = {
  contact: "Contato",
  server: "Servidor",
  extension: "Ramal",
  queue: "Fila",
  trunk: "Tronco",
  ivr: "URA",
  did: "DID",
  rule: "Regra",
  user: "Usuário",
  company: "Empresa",
  backup: "Backup",
  restore: "Restauração",
};

const PAGE_SIZE = 50;

export default function ActivityLog() {
  const { toast } = useToast();
  const [resourceFilter, setResourceFilter] = useState("all");
  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", String(PAGE_SIZE));
  if (resourceFilter !== "all") queryParams.set("resource", resourceFilter);

  const { data, isLoading, refetch, isFetching } = useQuery<ActivityLogsResponse>({
    queryKey: ["/api/activity-logs", queryParams.toString()],
    queryFn: () =>
      fetch(`/api/activity-logs?${queryParams.toString()}`, {
        credentials: "include",
      }).then((r) => r.json()),
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const formatDateTime = (date: string | null) => {
    if (!date) return "—";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR");
  };

  const getActionBadge = (action: string) => {
    const config = actionConfig[action] || { label: action, variant: "outline" as const };
    return (
      <Badge variant={config.variant} className="text-[10px]">
        {config.label}
      </Badge>
    );
  };

  const getResourceLabel = (resource: string) => {
    return resourceLabels[resource] || resource;
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Atualizado",
      description: "Log de atividades atualizado com sucesso.",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6" data-testid="page-activity-log-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-testid="page-activity-log">
      <div>
        <h1 className="text-xl font-bold tracking-tight" data-testid="text-page-title">
          Log de Atividades
        </h1>
        <p className="text-sm text-muted-foreground">
          Histórico de ações dos usuários no sistema
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={resourceFilter}
          onValueChange={(v) => {
            setResourceFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-52" data-testid="select-resource-filter">
            <Filter className="w-3 h-3 mr-2" />
            <SelectValue placeholder="Filtrar por recurso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Recursos</SelectItem>
            <SelectItem value="contact">Contato</SelectItem>
            <SelectItem value="server">Servidor</SelectItem>
            <SelectItem value="extension">Ramal</SelectItem>
            <SelectItem value="queue">Fila</SelectItem>
            <SelectItem value="trunk">Tronco</SelectItem>
            <SelectItem value="ivr">URA</SelectItem>
            <SelectItem value="did">DID</SelectItem>
            <SelectItem value="rule">Regra</SelectItem>
            <SelectItem value="user">Usuário</SelectItem>
            <SelectItem value="company">Empresa</SelectItem>
            <SelectItem value="backup">Backup</SelectItem>
            <SelectItem value="restore">Restauração</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
          data-testid="button-refresh"
        >
          {isFetching ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-1" />
          )}
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Data/Hora
                    </div>
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Usuário
                    </div>
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Ação</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Recurso</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Detalhes</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      IP
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover-elevate"
                    data-testid={`row-activity-${log.id}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs" data-testid={`text-datetime-${log.id}`}>
                        {formatDateTime(log.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium" data-testid={`text-user-${log.id}`}>
                        {log.userName || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3" data-testid={`text-action-${log.id}`}>
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" data-testid={`text-resource-${log.id}`}>
                        {getResourceLabel(log.resource)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs text-muted-foreground truncate max-w-[250px] block"
                        data-testid={`text-details-${log.id}`}
                        title={log.details || ""}
                      >
                        {log.details || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-mono text-muted-foreground"
                        data-testid={`text-ip-${log.id}`}
                      >
                        {log.ipAddress || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {logs.length === 0 && (
            <div
              className="px-5 py-12 text-center text-sm text-muted-foreground"
              data-testid="empty-state"
            >
              <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p>Nenhum registro de atividade encontrado</p>
              <p className="text-xs mt-1">
                As atividades dos usuários serão registradas automaticamente
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground" data-testid="text-pagination-info">
            Página {page} de {totalPages} — {total} registro(s)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              data-testid="button-next-page"
            >
              Próxima
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
