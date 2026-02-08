import { useQuery } from "@tanstack/react-query";
import {
  Server,
  Phone,
  Globe,
  Building2,
  PhoneCall,
  PhoneOff,
  PhoneForwarded,
  Clock,
  Activity,
  ArrowUpRight,
  Plug,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Server as ServerType, Company, Extension, SipTrunk, CallLog, Queue } from "@shared/schema";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  testId,
}: {
  title: string;
  value: string | number;
  icon: any;
  description?: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">{title}</span>
            <span className="text-2xl font-bold tracking-tight" data-testid={`${testId}-value`}>{value}</span>
            {description && (
              <span className="text-[11px] text-muted-foreground">{description}</span>
            )}
          </div>
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ServerStatusCard({ server }: { server: ServerType }) {
  const statusColor = {
    online: "bg-emerald-500",
    offline: "bg-red-500",
    maintenance: "bg-amber-500",
    error: "bg-red-500",
  };

  const statusLabel = {
    online: "Online",
    offline: "Offline",
    maintenance: "Manutenção",
    error: "Erro",
  };

  const { data: amiStatus, isLoading: loadingAmi, refetch } = useQuery({
    queryKey: ["/api/servers", server.id, "ami", "core-status"],
    queryFn: async () => {
      const res = await fetch(`/api/servers/${server.id}/ami/core-status`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!server.amiEnabled,
    refetchInterval: 60000,
  });

  return (
    <Card data-testid={`server-card-${server.id}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{server.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {server.amiEnabled && (
              <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-600 dark:text-emerald-400 mr-1">
                <Plug className="w-2.5 h-2.5 mr-0.5" /> AMI
              </Badge>
            )}
            <div className={`w-2 h-2 rounded-full ${statusColor[server.status]}`} />
            <span className="text-[11px] text-muted-foreground">{statusLabel[server.status]}</span>
          </div>
        </div>

        {server.amiEnabled && amiStatus ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-md bg-muted/50">
                <span className="text-[10px] text-muted-foreground block">Versão</span>
                <span className="text-xs font-medium">{amiStatus.version || "N/A"}</span>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <span className="text-[10px] text-muted-foreground block">Uptime</span>
                <span className="text-xs font-medium">{amiStatus.uptime || "N/A"}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Activity className="w-3 h-3" /> Chamadas Ativas
              </span>
              <span className="text-[11px] font-medium">{amiStatus.currentCalls ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Último Reload
              </span>
              <span className="text-[11px] font-medium">{amiStatus.reloadDate || "N/A"}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Activity className="w-3 h-3" /> Máx. Canais
              </span>
              <span className="text-[11px] font-medium">{server.maxChannels}</span>
            </div>
            <div className="text-center py-2">
              <span className="text-[11px] text-muted-foreground">
                {server.amiEnabled ? "Conectando ao AMI..." : "AMI não habilitado - habilite para ver dados em tempo real"}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mt-4 pt-3 border-t flex-wrap">
          <Badge variant="outline" className="text-[10px]">{server.ipAddress}</Badge>
          <Badge variant="outline" className="text-[10px]">{server.asteriskVersion || "N/A"}</Badge>
          <Badge variant="secondary" className="text-[10px]">
            {server.mode === "shared" ? "Compartilhado" : "Dedicado"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentCallsCard({ calls }: { calls: CallLog[] }) {
  const dispositionIcon: Record<string, any> = {
    "ANSWERED": PhoneCall,
    "NO ANSWER": PhoneOff,
    "BUSY": PhoneOff,
    "FAILED": PhoneOff,
  };

  const dispositionColor: Record<string, string> = {
    "ANSWERED": "text-emerald-500",
    "NO ANSWER": "text-red-500",
    "BUSY": "text-amber-500",
    "FAILED": "text-red-500",
  };

  const dispositionLabel: Record<string, string> = {
    "ANSWERED": "Atendida",
    "NO ANSWER": "N/A",
    "BUSY": "Ocupado",
    "FAILED": "Falha",
  };

  return (
    <Card data-testid="card-recent-calls">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-sm font-semibold">Chamadas Recentes</CardTitle>
        <Badge variant="secondary" className="text-[10px]">{calls.length}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {calls.slice(0, 8).map((call) => {
            const Icon = dispositionIcon[call.disposition] || PhoneCall;
            return (
              <div key={call.id} className="flex items-center gap-3 px-5 py-2.5">
                <Icon className={`w-4 h-4 flex-shrink-0 ${dispositionColor[call.disposition] || "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{call.source}</span>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{call.destination}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-muted-foreground">
                    {call.billsec > 0 ? `${Math.floor(call.billsec / 60)}:${String(call.billsec % 60).padStart(2, "0")}` : "--:--"}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{dispositionLabel[call.disposition] || call.disposition}</Badge>
                </div>
              </div>
            );
          })}
          {calls.length === 0 && (
            <div className="px-5 py-8 text-center text-xs text-muted-foreground">
              Nenhuma chamada registrada
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: servers, isLoading: loadingServers } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });
  const { data: companies, isLoading: loadingCompanies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });
  const { data: extensions, isLoading: loadingExtensions } = useQuery<Extension[]>({
    queryKey: ["/api/extensions"],
  });
  const { data: trunks, isLoading: loadingTrunks } = useQuery<SipTrunk[]>({
    queryKey: ["/api/sip-trunks"],
  });
  const { data: callsData, isLoading: loadingCalls } = useQuery<{ logs: CallLog[]; total: number }>({
    queryKey: ["/api/call-logs"],
    queryFn: () => fetch("/api/call-logs?limit=10", { credentials: "include" }).then(r => r.json()),
  });
  const calls = callsData?.logs;
  const { data: queuesList } = useQuery<Queue[]>({
    queryKey: ["/api/queues"],
  });

  const isLoading = loadingServers || loadingCompanies || loadingExtensions || loadingTrunks || loadingCalls;

  if (isLoading) return <DashboardSkeleton />;

  const activeServers = servers?.filter((s) => s.status === "online").length || 0;
  const amiServers = servers?.filter((s) => s.amiEnabled).length || 0;
  const activeExtensions = extensions?.filter((e) => e.status === "active").length || 0;
  const registeredTrunks = trunks?.filter((t) => t.status === "registered").length || 0;
  const activeQueues = queuesList?.filter((q) => q.active).length || 0;

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do sistema Admin VOIP</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Servidores"
          value={activeServers}
          icon={Server}
          description={`${servers?.length || 0} total | ${amiServers} AMI`}
          testId="stat-servers"
        />
        <StatCard
          title="Empresas"
          value={companies?.length || 0}
          icon={Building2}
          description={`${companies?.filter((c) => c.active).length || 0} ativas`}
          testId="stat-companies"
        />
        <StatCard
          title="Ramais"
          value={activeExtensions}
          icon={Phone}
          description={`${extensions?.length || 0} total`}
          testId="stat-extensions"
        />
        <StatCard
          title="Troncos SIP"
          value={registeredTrunks}
          icon={Globe}
          description={`${trunks?.length || 0} configurados`}
          testId="stat-trunks"
        />
        <StatCard
          title="Filas"
          value={activeQueues}
          icon={Users}
          description={`${queuesList?.length || 0} total`}
          testId="stat-queues"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold">Status dos Servidores</h2>
          {servers && servers.length > 0 ? (
            servers.map((server) => <ServerStatusCard key={server.id} server={server} />)
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhum servidor cadastrado
              </CardContent>
            </Card>
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold mb-4">Chamadas Recentes</h2>
          <RecentCallsCard calls={calls || []} />
        </div>
      </div>
    </div>
  );
}
