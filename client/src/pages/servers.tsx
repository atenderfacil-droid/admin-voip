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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
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
});

type ServerForm = z.infer<typeof serverFormSchema>;

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  online: { icon: Wifi, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Online" },
  offline: { icon: WifiOff, color: "text-red-500", bg: "bg-red-500/10", label: "Offline" },
  maintenance: { icon: Wrench, color: "text-amber-500", bg: "bg-amber-500/10", label: "Manutenção" },
  error: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10", label: "Erro" },
};

export default function Servers() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServerType | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
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
          <p className="text-sm text-muted-foreground">Gerencie seus servidores Asterisk</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-add-server">
              <Plus className="w-4 h-4 mr-2" /> Novo Servidor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
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
                      <FormLabel>Porta</FormLabel>
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
                    <FormControl><Input {...field} placeholder="22.8.2" data-testid="input-asterisk-version" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered?.map((server) => {
          const config = statusConfig[server.status];
          const StatusIcon = config.icon;
          return (
            <Card key={server.id} className="hover-elevate" data-testid={`card-server-${server.id}`}>
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
                        <DropdownMenuItem onClick={() => deleteMutation.mutate(server.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Canais Ativos
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
                </div>
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
