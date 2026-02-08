import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Server,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Activity,
  Wifi,
  WifiOff,
  Wrench,
  AlertTriangle,
  Plug,
  TestTube,
  RefreshCw,
  Terminal,
  Phone,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  BookOpen,
  Shield,
  Info,
  Link2,
  Unplug,
  Zap,
  KeyRound,
  Lock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Server as ServerType } from "@shared/schema";

const serverFormSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  hostname: z.string().min(1, "Hostname obrigatório"),
  ipAddress: z.string().min(7, "IP inválido"),
  port: z.coerce.number().min(1).default(5060),
  mode: z.enum(["shared", "dedicated"]),
  status: z.enum(["online", "offline", "maintenance", "error"]).default("offline"),
  asteriskVersion: z.string().optional(),
  maxChannels: z.coerce.number().min(1).default(100),
  companyId: z.string().optional(),
  amiPort: z.coerce.number().min(1).default(5038),
  amiUsername: z.string().optional(),
  amiPassword: z.string().optional(),
  amiEnabled: z.boolean().default(false),
  sshEnabled: z.boolean().default(false),
  sshHost: z.string().optional(),
  sshPort: z.coerce.number().min(1).default(22),
  sshUsername: z.string().optional(),
  sshAuthMethod: z.enum(["password", "privatekey"]).default("password"),
  sshPassword: z.string().optional(),
  sshPrivateKey: z.string().optional(),
}).refine((data) => {
  if (data.sshEnabled && !data.sshUsername) return false;
  return true;
}, { message: "Usuário SSH é obrigatório quando SSH está habilitado", path: ["sshUsername"] })
.refine((data) => {
  if (data.sshEnabled && data.sshAuthMethod === "password" && !data.sshPassword) return false;
  return true;
}, { message: "Senha SSH é obrigatória para autenticação por senha", path: ["sshPassword"] })
.refine((data) => {
  if (data.sshEnabled && data.sshAuthMethod === "privatekey" && !data.sshPrivateKey) return false;
  return true;
}, { message: "Chave privada é obrigatória para autenticação por chave", path: ["sshPrivateKey"] });

type ServerForm = z.infer<typeof serverFormSchema>;

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  online: { icon: Wifi, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Online" },
  offline: { icon: WifiOff, color: "text-red-500", bg: "bg-red-500/10", label: "Offline" },
  maintenance: { icon: Wrench, color: "text-amber-500", bg: "bg-amber-500/10", label: "Manutenção" },
  error: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10", label: "Erro" },
};

function AMIConfigGuide({ server }: { server: ServerType }) {
  const { toast } = useToast();

  const managerConf = `; /etc/asterisk/manager.conf
[general]
enabled = yes
port = ${server.amiPort}
bindaddr = 0.0.0.0

[${server.amiUsername || "admin_voip"}]
secret = ${server.amiPassword ? "********" : "sua_senha_aqui"}
deny = 0.0.0.0/0.0.0.0
permit = 0.0.0.0/0.0.0.0
read = system,call,log,verbose,command,agent,user,config,originate,dialplan,dtmf,reporting,cdr,security
write = system,call,log,verbose,command,agent,user,config,originate,dialplan,dtmf,reporting`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado para a área de transferência" });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-muted/50 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <BookOpen className="w-4 h-4 mt-0.5 text-primary" />
          <div>
            <h4 className="text-xs font-semibold">Como Configurar o AMI no Asterisk</h4>
            <p className="text-[11px] text-muted-foreground mt-1">
              O AMI (Asterisk Manager Interface) permite gerenciar seu servidor Asterisk remotamente via TCP na porta {server.amiPort}.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" /> 1. Edite o arquivo manager.conf
          </h4>
          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(managerConf)} data-testid="button-copy-manager-conf">
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
          </Button>
        </div>
        <pre className="bg-muted p-3 rounded-md text-[11px] overflow-auto max-h-48 whitespace-pre-wrap font-mono" data-testid="text-manager-conf">
          {managerConf}
        </pre>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5" /> 2. Recarregue o Asterisk
        </h4>
        <div className="bg-muted p-3 rounded-md space-y-1">
          <code className="text-[11px] font-mono block">asterisk -rx "manager reload"</code>
          <span className="text-[10px] text-muted-foreground">ou reinicie o serviço:</span>
          <code className="text-[11px] font-mono block">systemctl restart asterisk</code>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" /> 3. Libere a porta no firewall
        </h4>
        <div className="bg-muted p-3 rounded-md space-y-1">
          <code className="text-[11px] font-mono block">firewall-cmd --permanent --add-port={server.amiPort}/tcp</code>
          <code className="text-[11px] font-mono block">firewall-cmd --reload</code>
          <span className="text-[10px] text-muted-foreground mt-1 block">ou com iptables:</span>
          <code className="text-[11px] font-mono block">iptables -A INPUT -p tcp --dport {server.amiPort} -j ACCEPT</code>
        </div>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400">Segurança</h4>
            <ul className="text-[11px] text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
              <li>Use senhas fortes (32+ caracteres)</li>
              <li>Restrinja IPs com permit/deny no manager.conf</li>
              <li>Considere usar SSH tunnel para acesso remoto seguro</li>
              <li>Habilite TLS na porta 5039 para conexões criptografadas</li>
              <li>Configure Fail2Ban para proteção contra brute-force</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-md bg-muted/50 p-3">
        <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-2">
          <Shield className="w-3.5 h-3.5" /> Permissões Necessárias (read/write)
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {[
            { perm: "system", desc: "Status e reload" },
            { perm: "call", desc: "Chamadas e canais" },
            { perm: "command", desc: "Comandos CLI" },
            { perm: "agent", desc: "Filas e agentes" },
            { perm: "config", desc: "Configurações" },
            { perm: "originate", desc: "Originar chamadas" },
            { perm: "reporting", desc: "CDR e relatórios" },
            { perm: "dialplan", desc: "Plano de discagem" },
          ].map((p) => (
            <div key={p.perm} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              <span className="text-[11px]"><strong>{p.perm}</strong> - {p.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AMIConnectionStatus({ server }: { server: ServerType }) {
  const { toast } = useToast();
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/servers/${server.id}/ami/test`);
      return res.json();
    },
    onSuccess: (data) => {
      setConnectionResult(data);
      toast({
        title: data.success ? "Conexão AMI estabelecida" : "Falha na conexão AMI",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      setConnectionResult({ success: false, message: error.message });
      toast({
        title: "Erro ao testar conexão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!server.amiEnabled) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
        <Unplug className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">AMI desabilitado</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={() => testMutation.mutate()}
        disabled={testMutation.isPending}
        data-testid={`button-test-connection-${server.id}`}
      >
        {testMutation.isPending ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <Zap className="w-3.5 h-3.5 mr-1.5" />
        )}
        Testar Conexão
      </Button>
      {connectionResult && (
        <Badge
          variant={connectionResult.success ? "default" : "destructive"}
          className="text-[10px]"
          data-testid={`badge-connection-result-${server.id}`}
        >
          {connectionResult.success ? (
            <CheckCircle2 className="w-3 h-3 mr-1" />
          ) : (
            <XCircle className="w-3 h-3 mr-1" />
          )}
          {connectionResult.success ? "Conectado" : "Falha"}
        </Badge>
      )}
    </div>
  );
}

function AMIStatusPanel({ server }: { server: ServerType }) {
  const [amiTab, setAmiTab] = useState("status");
  const [cliCommand, setCliCommand] = useState("");
  const [cliOutput, setCliOutput] = useState("");
  const { toast } = useToast();

  const { data: amiStatus, isLoading: loadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["/api/servers", server.id, "ami", "status"],
    queryFn: async () => {
      const res = await fetch(`/api/servers/${server.id}/ami/status`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao obter status AMI");
      return res.json();
    },
    enabled: !!server.amiEnabled,
    refetchInterval: 30000,
  });

  const { data: peers, isLoading: loadingPeers, refetch: refetchPeers } = useQuery({
    queryKey: ["/api/servers", server.id, "ami", "peers"],
    queryFn: async () => {
      const res = await fetch(`/api/servers/${server.id}/ami/peers`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao obter peers");
      return res.json();
    },
    enabled: !!server.amiEnabled && amiTab === "peers",
  });

  const { data: channels, isLoading: loadingChannels, refetch: refetchChannels } = useQuery({
    queryKey: ["/api/servers", server.id, "ami", "channels"],
    queryFn: async () => {
      const res = await fetch(`/api/servers/${server.id}/ami/channels`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao obter canais");
      return res.json();
    },
    enabled: !!server.amiEnabled && amiTab === "channels",
  });

  const reloadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/servers/${server.id}/ami/reload`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Reload Asterisk", description: data.message });
      refetchStatus();
    },
  });

  const commandMutation = useMutation({
    mutationFn: async (command: string) => {
      const res = await apiRequest("POST", `/api/servers/${server.id}/ami/command`, { command });
      return res.json();
    },
    onSuccess: (data) => {
      setCliOutput(data.output || "Sem saída");
    },
    onError: (error: Error) => {
      setCliOutput(`Erro: ${error.message}`);
    },
  });

  const hangupMutation = useMutation({
    mutationFn: async (channel: string) => {
      const res = await apiRequest("POST", `/api/servers/${server.id}/ami/hangup`, { channel });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Canal encerrado" });
      refetchChannels();
    },
  });

  if (!server.amiEnabled) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        <Unplug className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p>AMI não habilitado neste servidor</p>
        <p className="text-xs mt-1">Edite o servidor para configurar as credenciais AMI</p>
      </div>
    );
  }

  return (
    <Tabs value={amiTab} onValueChange={setAmiTab} className="mt-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <TabsList>
          <TabsTrigger value="status" data-testid="tab-ami-status">Status</TabsTrigger>
          <TabsTrigger value="peers" data-testid="tab-ami-peers">Peers</TabsTrigger>
          <TabsTrigger value="channels" data-testid="tab-ami-channels">Canais</TabsTrigger>
          <TabsTrigger value="cli" data-testid="tab-ami-cli">CLI</TabsTrigger>
          <TabsTrigger value="config" data-testid="tab-ami-config">Configuração</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => reloadMutation.mutate()} disabled={reloadMutation.isPending} data-testid="button-reload-ami">
            {reloadMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Reload
          </Button>
        </div>
      </div>

      <TabsContent value="status">
        {loadingStatus ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : amiStatus ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-md bg-muted/50">
                <span className="text-[10px] text-muted-foreground block mb-1">Versão</span>
                <span className="text-xs font-medium">{amiStatus.coreStatus?.version || "N/A"}</span>
              </div>
              <div className="p-3 rounded-md bg-muted/50">
                <span className="text-[10px] text-muted-foreground block mb-1">Uptime</span>
                <span className="text-xs font-medium">{amiStatus.coreStatus?.uptime || "N/A"}</span>
              </div>
              <div className="p-3 rounded-md bg-muted/50">
                <span className="text-[10px] text-muted-foreground block mb-1">Chamadas Ativas</span>
                <span className="text-xs font-medium">{amiStatus.coreStatus?.currentCalls ?? "N/A"}</span>
              </div>
              <div className="p-3 rounded-md bg-muted/50">
                <span className="text-[10px] text-muted-foreground block mb-1">Último Reload</span>
                <span className="text-xs font-medium">{amiStatus.coreStatus?.reloadDate || "N/A"}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-muted/50">
                <span className="text-[10px] text-muted-foreground block mb-1">Peers SIP</span>
                <span className="text-xs font-medium">{amiStatus.peers?.length ?? 0}</span>
              </div>
              <div className="p-3 rounded-md bg-muted/50">
                <span className="text-[10px] text-muted-foreground block mb-1">Canais Ativos</span>
                <span className="text-xs font-medium">{amiStatus.channels?.length ?? 0}</span>
              </div>
            </div>

            {amiStatus.coreSettings && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-md bg-muted/50">
                  <span className="text-[10px] text-muted-foreground block mb-1">Versão AMI</span>
                  <span className="text-xs font-medium">{amiStatus.coreSettings.amiVersion || "N/A"}</span>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <span className="text-[10px] text-muted-foreground block mb-1">Máx. Chamadas</span>
                  <span className="text-xs font-medium">{amiStatus.coreSettings.maxCalls ?? "N/A"}</span>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <span className="text-[10px] text-muted-foreground block mb-1">Usuário</span>
                  <span className="text-xs font-medium">{amiStatus.coreSettings.runUser || "N/A"}</span>
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={() => refetchStatus()} data-testid="button-refresh-status">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Atualizar
            </Button>
          </div>
        ) : (
          <div className="text-center py-6">
            <XCircle className="w-8 h-8 mx-auto mb-2 text-destructive/50" />
            <p className="text-sm text-muted-foreground">Não foi possível obter dados do AMI</p>
            <p className="text-xs text-muted-foreground mt-1">Verifique as credenciais e a conectividade na aba "Configuração"</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="peers">
        {loadingPeers ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {(peers?.sip?.length || 0) + (peers?.pjsip?.length || 0)} peers encontrados
              </span>
              <Button variant="outline" size="sm" onClick={() => refetchPeers()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Atualizar
              </Button>
            </div>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Nome</TableHead>
                    <TableHead className="text-xs">IP</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {peers?.sip?.map((peer: any, i: number) => (
                    <TableRow key={`sip-${i}`}>
                      <TableCell className="text-xs font-medium">{peer.objectname}</TableCell>
                      <TableCell className="text-xs">{peer.ipaddress}</TableCell>
                      <TableCell>
                        <Badge variant={peer.status?.includes("OK") ? "default" : "secondary"} className="text-[10px]">
                          {peer.status}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">SIP</Badge></TableCell>
                    </TableRow>
                  ))}
                  {peers?.pjsip?.map((peer: any, i: number) => (
                    <TableRow key={`pjsip-${i}`}>
                      <TableCell className="text-xs font-medium">{peer.objectname}</TableCell>
                      <TableCell className="text-xs">-</TableCell>
                      <TableCell>
                        <Badge variant={peer.devicestate === "Not in use" ? "default" : "secondary"} className="text-[10px]">
                          {peer.devicestate}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">PJSIP</Badge></TableCell>
                    </TableRow>
                  ))}
                  {(!peers?.sip?.length && !peers?.pjsip?.length) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                        Nenhum peer encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="channels">
        {loadingChannels ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{channels?.length || 0} canais ativos</span>
              <Button variant="outline" size="sm" onClick={() => refetchChannels()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Atualizar
              </Button>
            </div>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Canal</TableHead>
                    <TableHead className="text-xs">CallerID</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs">Duração</TableHead>
                    <TableHead className="text-xs">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channels?.map((ch: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium truncate max-w-[200px]">{ch.channel}</TableCell>
                      <TableCell className="text-xs">{ch.calleridnum || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{ch.state}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{ch.duration}s</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => hangupMutation.mutate(ch.channel)} disabled={hangupMutation.isPending} data-testid={`button-hangup-${i}`}>
                          <Phone className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!channels || channels.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                        Nenhum canal ativo
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="cli">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="core show channels, sip show peers, etc."
              value={cliCommand}
              onChange={(e) => setCliCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && cliCommand.trim()) {
                  commandMutation.mutate(cliCommand.trim());
                }
              }}
              className="flex-1"
              data-testid="input-cli-command"
            />
            <Button
              onClick={() => {
                if (cliCommand.trim()) commandMutation.mutate(cliCommand.trim());
              }}
              disabled={commandMutation.isPending || !cliCommand.trim()}
              data-testid="button-execute-cli"
            >
              {commandMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
            </Button>
          </div>
          {cliOutput && (
            <pre className="bg-muted/50 p-3 rounded-md text-xs overflow-auto max-h-64 whitespace-pre-wrap font-mono" data-testid="text-cli-output">
              {cliOutput}
            </pre>
          )}
        </div>
      </TabsContent>

      <TabsContent value="config">
        <AMIConfigGuide server={server} />
      </TabsContent>
    </Tabs>
  );
}

export default function Servers() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServerType | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: servers, isLoading } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const form = useForm<ServerForm>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      name: "",
      hostname: "",
      ipAddress: "",
      port: 5060,
      mode: "shared",
      status: "offline",
      asteriskVersion: "",
      maxChannels: 100,
      companyId: "",
      amiPort: 5038,
      amiUsername: "",
      amiPassword: "",
      amiEnabled: false,
      sshEnabled: false,
      sshHost: "",
      sshPort: 22,
      sshUsername: "",
      sshAuthMethod: "password",
      sshPassword: "",
      sshPrivateKey: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ServerForm) => {
      const res = await apiRequest("POST", "/api/servers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      setOpen(false);
      form.reset();
      toast({ title: "Servidor criado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar servidor", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ServerForm & { id: string }) => {
      const { id, ...body } = data;
      const res = await apiRequest("PATCH", `/api/servers/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      setOpen(false);
      setEditing(null);
      form.reset();
      toast({ title: "Servidor atualizado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar servidor", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/servers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      toast({ title: "Servidor removido com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover servidor", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: ServerForm) => {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (server: ServerType) => {
    setEditing(server);
    form.reset({
      name: server.name,
      hostname: server.hostname,
      ipAddress: server.ipAddress,
      port: server.port,
      mode: server.mode,
      status: server.status,
      asteriskVersion: server.asteriskVersion || "",
      maxChannels: server.maxChannels,
      companyId: server.companyId || "",
      amiPort: server.amiPort,
      amiUsername: server.amiUsername || "",
      amiPassword: server.amiPassword || "",
      amiEnabled: server.amiEnabled,
      sshEnabled: server.sshEnabled || false,
      sshHost: server.sshHost || "",
      sshPort: server.sshPort || 22,
      sshUsername: server.sshUsername || "",
      sshAuthMethod: server.sshAuthMethod || "password",
      sshPassword: server.sshPassword || "",
      sshPrivateKey: server.sshPrivateKey || "",
    });
    setOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.reset({
      name: "",
      hostname: "",
      ipAddress: "",
      port: 5060,
      mode: "shared",
      status: "offline",
      asteriskVersion: "",
      maxChannels: 100,
      companyId: "",
      amiPort: 5038,
      amiUsername: "",
      amiPassword: "",
      amiEnabled: false,
      sshEnabled: false,
      sshHost: "",
      sshPort: 22,
      sshUsername: "",
      sshAuthMethod: "password",
      sshPassword: "",
      sshPrivateKey: "",
    });
    setOpen(true);
  };

  const filtered = servers?.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.ipAddress.includes(searchTerm)
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-servers">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Servidores</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus servidores Asterisk com integração AMI</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-add-server">
              <Plus className="w-4 h-4 mr-2" /> Novo Servidor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Servidor" : "Novo Servidor"}</DialogTitle>
              <DialogDescription>
                {editing ? "Atualize as informações do servidor Asterisk" : "Cadastre um novo servidor Asterisk para gerenciamento via AMI"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Servidor</FormLabel>
                    <FormControl><Input {...field} placeholder="Asterisk Principal" data-testid="input-server-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="hostname" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hostname</FormLabel>
                      <FormControl><Input {...field} placeholder="pbx.empresa.com.br" data-testid="input-server-hostname" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="ipAddress" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço IP</FormLabel>
                      <FormControl><Input {...field} placeholder="192.168.1.100" data-testid="input-server-ip" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="port" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Porta SIP</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-server-port" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="mode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-server-mode"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="shared">Compartilhado</SelectItem>
                          <SelectItem value="dedicated">Dedicado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="maxChannels" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Máx. Canais</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-max-channels" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="asteriskVersion" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Versão Asterisk</FormLabel>
                    <FormControl><Input {...field} placeholder="22.2.0" data-testid="input-asterisk-version" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <Plug className="w-4 h-4 text-primary" /> Conexão AMI (Asterisk Manager Interface)
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Conecte ao Asterisk via AMI na porta TCP 5038 para gerenciamento em tempo real
                  </p>

                  <FormField control={form.control} name="amiEnabled" render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4 rounded-md border p-3 mb-3">
                      <div>
                        <FormLabel className="text-sm">Habilitar Conexão AMI</FormLabel>
                        <FormDescription className="text-xs">
                          Ativa o gerenciamento remoto via TCP socket
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-ami-enabled" />
                      </FormControl>
                    </FormItem>
                  )} />

                  {form.watch("amiEnabled") && (
                    <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span>Configure estas credenciais no <code className="bg-muted px-1 py-0.5 rounded text-[10px]">manager.conf</code> do seu servidor Asterisk</span>
                      </div>

                      <FormField control={form.control} name="amiPort" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Porta AMI</FormLabel>
                          <FormControl><Input type="number" {...field} data-testid="input-ami-port" /></FormControl>
                          <FormDescription className="text-[10px]">Porta padrão: 5038 (TCP)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="amiUsername" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Usuário AMI</FormLabel>
                            <FormControl><Input {...field} placeholder="admin" data-testid="input-ami-username" /></FormControl>
                            <FormDescription className="text-[10px]">Definido em manager.conf</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="amiPassword" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha AMI</FormLabel>
                            <FormControl><Input type="password" {...field} placeholder="********" data-testid="input-ami-password" /></FormControl>
                            <FormDescription className="text-[10px]">Campo "secret" do manager.conf</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="rounded-md bg-muted/50 p-2.5 mt-2">
                        <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                          <Shield className="w-3 h-3 mt-0.5 shrink-0" />
                          A conexão AMI usa TCP socket direto na porta {form.watch("amiPort")}. Certifique-se de que a porta esteja aberta no firewall e o IP deste servidor esteja permitido no manager.conf.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-primary" /> Túnel SSH (Conexão Segura)
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Conecte ao AMI através de um túnel SSH para maior segurança
                  </p>

                  <FormField control={form.control} name="sshEnabled" render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4 rounded-md border p-3 mb-3">
                      <div>
                        <FormLabel className="text-sm">Habilitar Túnel SSH</FormLabel>
                        <FormDescription className="text-xs">
                          Cria um túnel SSH criptografado antes de conectar ao AMI
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-ssh-enabled" />
                      </FormControl>
                    </FormItem>
                  )} />

                  {form.watch("sshEnabled") && (
                    <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>O túnel SSH encaminha a conexão AMI de forma segura. A porta AMI não precisa estar exposta na internet.</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="sshHost" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Host SSH</FormLabel>
                            <FormControl><Input {...field} placeholder="IP ou hostname do servidor SSH" data-testid="input-ssh-host" /></FormControl>
                            <FormDescription className="text-[10px]">Deixe vazio para usar o IP do servidor</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="sshPort" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Porta SSH</FormLabel>
                            <FormControl><Input type="number" {...field} data-testid="input-ssh-port" /></FormControl>
                            <FormDescription className="text-[10px]">Porta padrão: 22</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="sshUsername" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usuário SSH</FormLabel>
                          <FormControl><Input {...field} placeholder="root" data-testid="input-ssh-username" /></FormControl>
                          <FormDescription className="text-[10px]">Usuário com acesso SSH ao servidor</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="sshAuthMethod" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Método de Autenticação</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger data-testid="select-ssh-auth-method"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="password">Senha</SelectItem>
                              <SelectItem value="privatekey">Chave Privada (RSA/Ed25519)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />

                      {form.watch("sshAuthMethod") === "password" && (
                        <FormField control={form.control} name="sshPassword" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha SSH</FormLabel>
                            <FormControl><Input type="password" {...field} placeholder="********" data-testid="input-ssh-password" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}

                      {form.watch("sshAuthMethod") === "privatekey" && (
                        <FormField control={form.control} name="sshPrivateKey" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Chave Privada SSH</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"}
                                className="font-mono text-xs min-h-[120px] resize-y"
                                data-testid="textarea-ssh-private-key"
                              />
                            </FormControl>
                            <FormDescription className="text-[10px]">Cole o conteúdo da chave privada (id_rsa ou id_ed25519)</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}

                      <div className="rounded-md bg-muted/50 p-2.5 mt-2">
                        <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                          <Shield className="w-3 h-3 mt-0.5 shrink-0" />
                          Com SSH habilitado, a conexão AMI é tunelada: SSH conecta ao servidor → encaminha a porta AMI ({form.watch("amiPort")}) localmente → AMI conecta via localhost. A porta AMI não precisa estar aberta externamente.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-server">
                    {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editing ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar servidores..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search-servers"
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filtered?.map((server) => {
          const config = statusConfig[server.status];
          const StatusIcon = config.icon;
          const isExpanded = expandedServer === server.id;
          return (
            <Card key={server.id} data-testid={`card-server-${server.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-md ${config.bg}`}>
                      <StatusIcon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{server.name}</h3>
                      <span className="text-[11px] text-muted-foreground">{server.hostname} ({server.ipAddress})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={server.status === "online" ? "default" : "secondary"} className="text-[10px]">
                      {config.label}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-menu-server-${server.id}`}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(server)} data-testid={`menu-edit-server-${server.id}`}>
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setExpandedServer(isExpanded ? null : server.id)} data-testid={`menu-ami-panel-${server.id}`}>
                          <Eye className="w-4 h-4 mr-2" /> {isExpanded ? "Fechar Painel" : "Painel AMI"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteMutation.mutate(server.id)} className="text-destructive" data-testid={`menu-delete-server-${server.id}`}>
                          <Trash2 className="w-4 h-4 mr-2" /> Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Canais:</span>
                    <span className="text-[11px] font-medium">{server.maxChannels}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link2 className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Porta:</span>
                    <span className="text-[11px] font-medium">{server.port}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Plug className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">AMI:</span>
                    <span className="text-[11px] font-medium">
                      {server.amiEnabled
                        ? server.sshEnabled
                          ? `SSH → :${server.amiPort}`
                          : `Porta ${server.amiPort}`
                        : "Desabilitado"}
                    </span>
                  </div>
                  {server.asteriskVersion && (
                    <div className="flex items-center gap-1.5">
                      <Server className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Versão:</span>
                      <span className="text-[11px] font-medium">v{server.asteriskVersion}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">
                    {server.mode === "shared" ? "Compartilhado" : "Dedicado"}
                  </Badge>
                  {server.amiEnabled ? (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-600 dark:text-emerald-400">
                      <Plug className="w-3 h-3 mr-1" /> AMI Habilitado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      <Unplug className="w-3 h-3 mr-1" /> AMI Desabilitado
                    </Badge>
                  )}
                  {server.sshEnabled && (
                    <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-600 dark:text-blue-400">
                      <KeyRound className="w-3 h-3 mr-1" /> SSH Tunnel
                    </Badge>
                  )}
                  <div className="ml-auto">
                    <AMIConnectionStatus server={server} />
                  </div>
                </div>

                {isExpanded && <AMIStatusPanel server={server} />}
              </CardContent>
            </Card>
          );
        })}
        {filtered?.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
            <Server className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>Nenhum servidor encontrado</p>
            <p className="text-xs mt-1">Clique em "Novo Servidor" para cadastrar seu primeiro servidor Asterisk</p>
          </div>
        )}
      </div>
    </div>
  );
}
