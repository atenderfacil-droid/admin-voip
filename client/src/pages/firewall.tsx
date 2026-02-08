import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Server,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Ban,
  Unlock,
  Network,
  Lock,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ServerItem {
  id: string;
  name: string;
  sshEnabled: boolean;
  ipAddress: string;
}

interface Jail {
  name: string;
  currentlyBanned: number;
  totalBanned: number;
  bannedIps: string[];
  currentlyFailed: number;
  totalFailed: number;
}

interface Fail2banData {
  installed: boolean;
  jails: Jail[];
}

interface IptablesRule {
  num: number;
  pkts: string;
  bytes: string;
  target: string;
  prot: string;
  source: string;
  destination: string;
  extra: string;
}

interface IptablesChain {
  name: string;
  policy: string;
  rules: IptablesRule[];
}

interface IptablesData {
  accessible: boolean;
  chains: IptablesChain[];
}

interface OverviewData {
  fail2banVersion: string;
  iptablesRuleCount: number;
  recentFailedLogins: number;
  openSipPorts: string[];
  lastAuthLogs: string[];
}

export default function Firewall() {
  const [selectedServer, setSelectedServer] = useState<string>("");
  const { toast } = useToast();

  const { data: servers, isLoading: serversLoading } = useQuery<ServerItem[]>({
    queryKey: ["/api/servers"],
  });

  const server = servers?.find((s) => s.id === selectedServer);
  const sshEnabled = server?.sshEnabled ?? false;

  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
  } = useQuery<OverviewData>({
    queryKey: ["/api/servers", selectedServer, "firewall", "overview"],
    queryFn: () =>
      fetch(`/api/servers/${selectedServer}/firewall/overview`, {
        credentials: "include",
      }).then((r) => r.json()),
    enabled: !!selectedServer && sshEnabled,
  });

  const {
    data: fail2ban,
    isLoading: fail2banLoading,
    refetch: refetchFail2ban,
  } = useQuery<Fail2banData>({
    queryKey: ["/api/servers", selectedServer, "firewall", "fail2ban"],
    queryFn: () =>
      fetch(`/api/servers/${selectedServer}/firewall/fail2ban`, {
        credentials: "include",
      }).then((r) => r.json()),
    enabled: !!selectedServer && sshEnabled,
  });

  const {
    data: iptables,
    isLoading: iptablesLoading,
    refetch: refetchIptables,
  } = useQuery<IptablesData>({
    queryKey: ["/api/servers", selectedServer, "firewall", "iptables"],
    queryFn: () =>
      fetch(`/api/servers/${selectedServer}/firewall/iptables`, {
        credentials: "include",
      }).then((r) => r.json()),
    enabled: !!selectedServer && sshEnabled,
  });

  const unbanMutation = useMutation({
    mutationFn: async ({ jail, ip }: { jail: string; ip: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/servers/${selectedServer}/firewall/fail2ban/unban`,
        { jail, ip }
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "IP desbanido com sucesso" });
      queryClient.invalidateQueries({
        queryKey: ["/api/servers", selectedServer, "firewall", "fail2ban"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao desbanir IP",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    if (selectedServer && sshEnabled) {
      refetchOverview();
      refetchFail2ban();
      refetchIptables();
    }
  };

  const policyVariant = (policy: string) => {
    if (policy === "ACCEPT") return "default";
    if (policy === "DROP") return "destructive";
    return "secondary";
  };

  if (serversLoading) {
    return (
      <div className="space-y-6" data-testid="page-firewall">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-firewall">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Firewall e Segurança
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie Fail2ban, IPTables e visão geral de segurança dos servidores
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={selectedServer}
            onValueChange={(v) => setSelectedServer(v)}
          >
            <SelectTrigger className="w-56" data-testid="select-server">
              <Server className="w-3 h-3 mr-2" />
              <SelectValue placeholder="Selecionar servidor" />
            </SelectTrigger>
            <SelectContent>
              {servers?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={!selectedServer || !sshEnabled}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {!selectedServer && (
        <Card>
          <CardContent className="p-8 text-center">
            <Server className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground" data-testid="text-no-server">
              Selecione um servidor para visualizar as informações de segurança
            </p>
          </CardContent>
        </Card>
      )}

      {selectedServer && !sshEnabled && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
            <p className="text-sm font-medium" data-testid="text-ssh-disabled">
              SSH não configurado
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Configure o SSH nas configurações do servidor para acessar as informações de firewall
            </p>
          </CardContent>
        </Card>
      )}

      {selectedServer && sshEnabled && (
        <Tabs defaultValue="overview">
          <TabsList data-testid="tabs-firewall">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Eye className="w-3 h-3 mr-1.5" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="fail2ban" data-testid="tab-fail2ban">
              <Ban className="w-3 h-3 mr-1.5" />
              Fail2ban
            </TabsTrigger>
            <TabsTrigger value="iptables" data-testid="tab-iptables">
              <Network className="w-3 h-3 mr-1.5" />
              IPTables
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {overviewLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : overview ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10">
                          <ShieldCheck className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground">
                            Fail2ban
                          </span>
                          <p
                            className="text-lg font-bold"
                            data-testid="stat-fail2ban-version"
                          >
                            {overview.fail2banVersion || "N/A"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10">
                          <Network className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground">
                            Regras IPTables
                          </span>
                          <p
                            className="text-lg font-bold"
                            data-testid="stat-iptables-rules"
                          >
                            {overview.iptablesRuleCount ?? 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-red-500/10">
                          <ShieldAlert className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground">
                            Logins Falhos Recentes
                          </span>
                          <p
                            className="text-lg font-bold"
                            data-testid="stat-failed-logins"
                          >
                            {overview.recentFailedLogins ?? 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-amber-500/10">
                          <Lock className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground">
                            Portas SIP Abertas
                          </span>
                          <p
                            className="text-lg font-bold"
                            data-testid="stat-open-sip-ports"
                          >
                            {overview.openSipPorts?.length ?? 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {overview.openSipPorts && overview.openSipPorts.length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Portas SIP Abertas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {overview.openSipPorts.map((port, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            data-testid={`badge-port-${i}`}
                          >
                            {port}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {overview.lastAuthLogs && overview.lastAuthLogs.length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Logs de Autenticação Recentes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-64 overflow-auto rounded-md bg-muted p-3">
                        <pre
                          className="text-[11px] font-mono whitespace-pre-wrap"
                          data-testid="text-auth-logs"
                        >
                          {overview.lastAuthLogs.join("\n")}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <ShieldX className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Não foi possível carregar os dados de segurança
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="fail2ban" className="space-y-4 mt-4">
            {fail2banLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            ) : fail2ban && !fail2ban.installed ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ShieldX className="w-10 h-10 mx-auto text-red-500 mb-3" />
                  <p
                    className="text-sm font-medium"
                    data-testid="text-fail2ban-not-installed"
                  >
                    Fail2ban não instalado
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Instale o Fail2ban no servidor para proteção contra ataques de força bruta
                  </p>
                </CardContent>
              </Card>
            ) : fail2ban && fail2ban.jails.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma jail configurada no Fail2ban
                  </p>
                </CardContent>
              </Card>
            ) : (
              fail2ban?.jails.map((jail) => (
                <Card key={jail.name} data-testid={`card-jail-${jail.name}`}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm font-medium">
                        {jail.name}
                      </CardTitle>
                      <Badge
                        variant={
                          jail.currentlyBanned > 0 ? "destructive" : "secondary"
                        }
                        data-testid={`badge-banned-${jail.name}`}
                      >
                        {jail.currentlyBanned} banido(s)
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-[11px] text-muted-foreground">
                          Banidos Agora
                        </span>
                        <p
                          className="text-sm font-semibold"
                          data-testid={`stat-currently-banned-${jail.name}`}
                        >
                          {jail.currentlyBanned}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground">
                          Total Banidos
                        </span>
                        <p
                          className="text-sm font-semibold"
                          data-testid={`stat-total-banned-${jail.name}`}
                        >
                          {jail.totalBanned}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground">
                          Falhas Atuais
                        </span>
                        <p
                          className="text-sm font-semibold"
                          data-testid={`stat-currently-failed-${jail.name}`}
                        >
                          {jail.currentlyFailed}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground">
                          Total Falhas
                        </span>
                        <p
                          className="text-sm font-semibold"
                          data-testid={`stat-total-failed-${jail.name}`}
                        >
                          {jail.totalFailed}
                        </p>
                      </div>
                    </div>

                    {jail.bannedIps && jail.bannedIps.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] text-muted-foreground font-medium">
                          IPs Banidos
                        </span>
                        <div className="space-y-1">
                          {jail.bannedIps.map((ip) => (
                            <div
                              key={ip}
                              className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-1.5"
                              data-testid={`row-banned-ip-${ip}`}
                            >
                              <code className="text-xs font-mono">{ip}</code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  unbanMutation.mutate({
                                    jail: jail.name,
                                    ip,
                                  })
                                }
                                disabled={unbanMutation.isPending}
                                data-testid={`button-unban-${ip}`}
                              >
                                {unbanMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <Unlock className="w-3 h-3 mr-1" />
                                )}
                                Desbanir
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="iptables" className="space-y-4 mt-4">
            {iptablesLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
              </div>
            ) : iptables && !iptables.accessible ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ShieldX className="w-10 h-10 mx-auto text-red-500 mb-3" />
                  <p
                    className="text-sm font-medium"
                    data-testid="text-iptables-not-accessible"
                  >
                    Sem acesso ao IPTables
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Verifique as permissões do usuário SSH no servidor
                  </p>
                </CardContent>
              </Card>
            ) : iptables && iptables.chains.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Network className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma chain encontrada no IPTables
                  </p>
                </CardContent>
              </Card>
            ) : (
              iptables?.chains.map((chain) => (
                <Card
                  key={chain.name}
                  data-testid={`card-chain-${chain.name}`}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm font-medium">
                        {chain.name}
                      </CardTitle>
                      <Badge
                        variant={policyVariant(chain.policy)}
                        data-testid={`badge-policy-${chain.name}`}
                      >
                        {chain.policy}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {chain.rules.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhuma regra nesta chain
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Pacotes</TableHead>
                              <TableHead>Bytes</TableHead>
                              <TableHead>Alvo</TableHead>
                              <TableHead>Protocolo</TableHead>
                              <TableHead>Origem</TableHead>
                              <TableHead>Destino</TableHead>
                              <TableHead>Extra</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {chain.rules.map((rule) => (
                              <TableRow
                                key={rule.num}
                                data-testid={`row-rule-${chain.name}-${rule.num}`}
                              >
                                <TableCell className="font-mono text-xs">
                                  {rule.num}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {rule.pkts}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {rule.bytes}
                                </TableCell>
                                <TableCell className="text-xs font-medium">
                                  {rule.target}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {rule.prot}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {rule.source}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {rule.destination}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {rule.extra}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}