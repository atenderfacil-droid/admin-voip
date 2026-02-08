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
  Cpu,
  HardDrive,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { Server as ServerType, Company, Extension, SipTrunk, CallLog } from "@shared/schema";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  testId,
}: {
  title: string;
  value: string | number;
  icon: any;
  description?: string;
  trend?: { value: number; positive: boolean };
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
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            {trend && (
              <div className="flex items-center gap-1">
                {trend.positive ? (
                  <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-red-500" />
                )}
                <span className={`text-[11px] font-medium ${trend.positive ? "text-emerald-500" : "text-red-500"}`}>
                  {trend.value}%
                </span>
              </div>
            )}
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

  return (
    <Card data-testid={`server-card-${server.id}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{server.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${statusColor[server.status]}`} />
            <span className="text-[11px] text-muted-foreground">{statusLabel[server.status]}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Cpu className="w-3 h-3" /> CPU
              </span>
              <span className="text-[11px] font-medium">{server.cpuUsage}%</span>
            </div>
            <Progress value={server.cpuUsage} className="h-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <HardDrive className="w-3 h-3" /> Memória
              </span>
              <span className="text-[11px] font-medium">{server.memoryUsage}%</span>
            </div>
            <Progress value={server.memoryUsage} className="h-1.5" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Activity className="w-3 h-3" /> Canais
            </span>
            <span className="text-[11px] font-medium">
              {server.activeChannels}/{server.maxChannels}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Uptime
            </span>
            <span className="text-[11px] font-medium">{server.uptime || "N/A"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t">
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
  const statusIcon: Record<string, any> = {
    answered: PhoneCall,
    missed: PhoneOff,
    forwarded: PhoneForwarded,
  };

  const statusColor: Record<string, string> = {
    answered: "text-emerald-500",
    missed: "text-red-500",
    forwarded: "text-amber-500",
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
            const Icon = statusIcon[call.status] || PhoneCall;
            return (
              <div key={call.id} className="flex items-center gap-3 px-5 py-2.5">
                <Icon className={`w-4 h-4 flex-shrink-0 ${statusColor[call.status] || "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{call.source}</span>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{call.destination}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-muted-foreground">
                    {call.duration > 0 ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, "0")}` : "--:--"}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{call.type}</Badge>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
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
  const { data: calls, isLoading: loadingCalls } = useQuery<CallLog[]>({
    queryKey: ["/api/call-logs"],
  });

  const isLoading = loadingServers || loadingCompanies || loadingExtensions || loadingTrunks || loadingCalls;

  if (isLoading) return <DashboardSkeleton />;

  const activeServers = servers?.filter((s) => s.status === "online").length || 0;
  const activeExtensions = extensions?.filter((e) => e.status === "active").length || 0;
  const registeredTrunks = trunks?.filter((t) => t.status === "registered").length || 0;

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do sistema Admin VOIP</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Servidores Ativos"
          value={activeServers}
          icon={Server}
          description={`${servers?.length || 0} total`}
          trend={{ value: 12, positive: true }}
          testId="stat-servers"
        />
        <StatCard
          title="Empresas"
          value={companies?.length || 0}
          icon={Building2}
          description={`${companies?.filter((c) => c.active).length || 0} ativas`}
          trend={{ value: 8, positive: true }}
          testId="stat-companies"
        />
        <StatCard
          title="Ramais Ativos"
          value={activeExtensions}
          icon={Phone}
          description={`${extensions?.length || 0} total`}
          trend={{ value: 5, positive: true }}
          testId="stat-extensions"
        />
        <StatCard
          title="Troncos SIP"
          value={registeredTrunks}
          icon={Globe}
          description={`${trunks?.length || 0} configurados`}
          trend={{ value: 3, positive: true }}
          testId="stat-trunks"
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
