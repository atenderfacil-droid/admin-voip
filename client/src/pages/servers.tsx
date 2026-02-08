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
  Cpu,
  HardDrive,
  Activity,
  Clock,
  Wifi,
  WifiOff,
  Wrench,
  AlertTriangle,
  Plug,
  TestTube,
  RefreshCw,
  Terminal,
  Phone,
  Globe,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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
});

type ServerForm = z.infer<typeof serverFormSchema>;

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  online: { icon: Wifi, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Online" },
  offline: { icon: WifiOff, color: "text-red-500", bg: "bg-red-500/10", label: "Offline" },
  maintenance: { icon: Wrench, color: "text-amber-500", bg: "bg-amber-500/10", label: "Manutenção" },
  error: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10", label: "Erro" },
};

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

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/servers/${server.id}/ami/test`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Conexão AMI OK" : "Falha na conexão AMI",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
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
        <Plug className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
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
        </TabsList>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => testMutation.mutate()} disabled={testMutation.isPending} data-testid="button-test-ami">
            {testMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5 mr-1.5" />}
            Testar
          </Button>
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
          <p className="text-sm text-muted-foreground">Sem dados AMI disponíveis</p>
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
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl><Input {...field} data-testid="input-server-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="hostname" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hostname</FormLabel>
                      <FormControl><Input {...field} data-testid="input-server-hostname" /></FormControl>
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
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Plug className="w-4 h-4" /> Configuração AMI
                  </h3>
                  <FormField control={form.control} name="amiEnabled" render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4 rounded-md border p-3 mb-3">
                      <div>
                        <FormLabel className="text-sm">Habilitar AMI</FormLabel>
                        <FormDescription className="text-xs">Conectar via Asterisk Manager Interface</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-ami-enabled" />
                      </FormControl>
                    </FormItem>
                  )} />
                  {form.watch("amiEnabled") && (
                    <>
                      <FormField control={form.control} name="amiPort" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Porta AMI</FormLabel>
                          <FormControl><Input type="number" {...field} data-testid="input-ami-port" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <FormField control={form.control} name="amiUsername" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Usuário AMI</FormLabel>
                            <FormControl><Input {...field} placeholder="admin" data-testid="input-ami-username" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="amiPassword" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha AMI</FormLabel>
                            <FormControl><Input type="password" {...field} placeholder="********" data-testid="input-ami-password" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </>
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
                      <span className="text-[11px] text-muted-foreground">{server.hostname}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {server.amiEnabled && (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-600 dark:text-emerald-400">
                        <Plug className="w-3 h-3 mr-1" /> AMI
                      </Badge>
                    )}
                    <Badge variant={server.status === "online" ? "default" : "secondary"} className="text-[10px]">
                      {config.label}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(server)}>
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        {server.amiEnabled && (
                          <DropdownMenuItem onClick={() => setExpandedServer(isExpanded ? null : server.id)}>
                            <Eye className="w-4 h-4 mr-2" /> {isExpanded ? "Fechar AMI" : "Painel AMI"}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => deleteMutation.mutate(server.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Canais
                    </span>
                    <span className="text-[11px] font-medium">{server.activeChannels}/{server.maxChannels}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Uptime
                    </span>
                    <span className="text-[11px] font-medium">{server.uptime || "N/A"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{server.ipAddress}:{server.port}</Badge>
                  {server.asteriskVersion && <Badge variant="outline" className="text-[10px]">v{server.asteriskVersion}</Badge>}
                  <Badge variant="secondary" className="text-[10px]">
                    {server.mode === "shared" ? "Compartilhado" : "Dedicado"}
                  </Badge>
                  {server.amiEnabled && (
                    <Badge variant="outline" className="text-[10px]">AMI:{server.amiPort}</Badge>
                  )}
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
          </div>
        )}
      </div>
    </div>
  );
}
