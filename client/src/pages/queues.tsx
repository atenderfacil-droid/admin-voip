import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Phone,
  Clock,
  UserPlus,
  UserMinus,
  Pause,
  Play,
  Activity,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Queue, Company, Server as ServerType } from "@shared/schema";

const queueFormSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  displayName: z.string().min(1, "Nome de exibição obrigatório"),
  strategy: z.enum(["ringall", "leastrecent", "fewestcalls", "random", "rrmemory", "linear", "wrandom"]),
  timeout: z.coerce.number().min(1).default(30),
  wrapupTime: z.coerce.number().min(0).default(5),
  maxWaitTime: z.coerce.number().min(1).default(300),
  maxCallers: z.coerce.number().min(1).default(10),
  musicOnHold: z.string().default("default"),
  announce: z.string().optional(),
  announceFrequency: z.coerce.number().min(0).default(30),
  joinEmpty: z.boolean().default(false),
  leaveWhenEmpty: z.boolean().default(true),
  active: z.boolean().default(true),
  companyId: z.string().min(1, "Empresa obrigatória"),
  serverId: z.string().min(1, "Servidor obrigatório"),
});

type QueueForm = z.infer<typeof queueFormSchema>;

const strategyLabels: Record<string, string> = {
  ringall: "Tocar Todos",
  leastrecent: "Menos Recente",
  fewestcalls: "Menos Chamadas",
  random: "Aleatório",
  rrmemory: "Round Robin",
  linear: "Linear",
  wrandom: "Aleatório Ponderado",
};

export default function Queues() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Queue | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: queuesList, isLoading } = useQuery<Queue[]>({
    queryKey: ["/api/queues"],
  });
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });
  const { data: serversList } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const amiServers = serversList?.filter((s) => s.amiEnabled) || [];

  const { data: amiQueueStatus, isLoading: loadingAmiQueues, refetch: refetchAmiQueues } = useQuery({
    queryKey: ["/api/servers", selectedServer, "ami", "queues"],
    queryFn: async () => {
      if (!selectedServer) return [];
      const res = await fetch(`/api/servers/${selectedServer}/ami/queues`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedServer,
    refetchInterval: 15000,
  });

  const form = useForm<QueueForm>({
    resolver: zodResolver(queueFormSchema),
    defaultValues: {
      name: "",
      displayName: "",
      strategy: "ringall",
      timeout: 30,
      wrapupTime: 5,
      maxWaitTime: 300,
      maxCallers: 10,
      musicOnHold: "default",
      announce: "",
      announceFrequency: 30,
      joinEmpty: false,
      leaveWhenEmpty: true,
      active: true,
      companyId: "",
      serverId: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: QueueForm) => {
      const res = await apiRequest("POST", "/api/queues", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/queues"] });
      setOpen(false);
      form.reset();
      toast({
        title: "Fila criada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar fila", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: QueueForm & { id: string }) => {
      const { id, ...body } = data;
      const res = await apiRequest("PATCH", `/api/queues/${id}`, body);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/queues"] });
      setOpen(false);
      setEditing(null);
      form.reset();
      toast({
        title: "Fila atualizada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar fila", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/queues/${id}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/queues"] });
      toast({
        title: "Fila removida com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover fila", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: QueueForm) => {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (queue: Queue) => {
    setEditing(queue);
    form.reset({
      name: queue.name,
      displayName: queue.displayName,
      strategy: queue.strategy,
      timeout: queue.timeout,
      wrapupTime: queue.wrapupTime,
      maxWaitTime: queue.maxWaitTime,
      maxCallers: queue.maxCallers,
      musicOnHold: queue.musicOnHold,
      announce: queue.announce || "",
      announceFrequency: queue.announceFrequency,
      joinEmpty: queue.joinEmpty,
      leaveWhenEmpty: queue.leaveWhenEmpty,
      active: queue.active,
      companyId: queue.companyId,
      serverId: queue.serverId,
    });
    setOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.reset({
      name: "",
      displayName: "",
      strategy: "ringall",
      timeout: 30,
      wrapupTime: 5,
      maxWaitTime: 300,
      maxCallers: 10,
      musicOnHold: "default",
      announce: "",
      announceFrequency: 30,
      joinEmpty: false,
      leaveWhenEmpty: true,
      active: true,
      companyId: companies?.[0]?.id || "",
      serverId: serversList?.[0]?.id || "",
    });
    setOpen(true);
  };

  const filtered = queuesList?.filter(
    (q) =>
      q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-queues">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Filas de Atendimento</h1>
          <p className="text-sm text-muted-foreground">Gerencie filas de chamadas do Asterisk</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { queryClient.invalidateQueries({ queryKey: ["/api/queues"] }); }} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} data-testid="button-add-queue">
                <Plus className="w-4 h-4 mr-2" /> Nova Fila
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Fila" : "Nova Fila"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome (interno)</FormLabel>
                      <FormControl><Input {...field} placeholder="suporte" data-testid="input-queue-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="displayName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome de Exibição</FormLabel>
                      <FormControl><Input {...field} placeholder="Suporte Técnico" data-testid="input-queue-display-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="companyId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-queue-company"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {companies?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="serverId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Servidor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-queue-server"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {serversList?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="strategy" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estratégia</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-queue-strategy"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(strategyLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="timeout" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeout (s)</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-queue-timeout" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="wrapupTime" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wrap-up (s)</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-queue-wrapup" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="maxCallers" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Máx. Chamadores</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-queue-max-callers" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="maxWaitTime" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Espera Máx. (s)</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-queue-max-wait" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="musicOnHold" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Música de Espera</FormLabel>
                      <FormControl><Input {...field} placeholder="default" data-testid="input-queue-moh" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="announce" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Anúncio</FormLabel>
                      <FormControl><Input {...field} placeholder="queue-announce" data-testid="input-queue-announce" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="announceFrequency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Freq. Anúncio (s)</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-queue-announce-freq" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="joinEmpty" render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div>
                        <FormLabel className="text-sm">Entrar Vazia</FormLabel>
                        <FormDescription className="text-xs">Permitir entrada sem agentes</FormDescription>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-join-empty" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="leaveWhenEmpty" render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div>
                        <FormLabel className="text-sm">Sair se Vazia</FormLabel>
                        <FormDescription className="text-xs">Desconectar se sem agentes</FormDescription>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-leave-empty" /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="active" render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <FormLabel className="text-sm">Ativa</FormLabel>
                      <FormDescription className="text-xs">Fila disponível para receber chamadas</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-queue-active" /></FormControl>
                  </FormItem>
                )} />

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-queue">
                    {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editing ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar filas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-queues"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered?.map((queue) => {
          const serverName = serversList?.find((s) => s.id === queue.serverId)?.name || "N/A";
          const companyName = companies?.find((c) => c.id === queue.companyId)?.name || "N/A";
          return (
            <Card key={queue.id} className="hover-elevate" data-testid={`card-queue-${queue.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-md ${queue.active ? "bg-emerald-500/10" : "bg-muted"}`}>
                      <Users className={`w-5 h-5 ${queue.active ? "text-emerald-500" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{queue.displayName}</h3>
                      <span className="text-[11px] text-muted-foreground">{queue.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={queue.active ? "default" : "secondary"} className="text-[10px]">
                      {queue.active ? "Ativa" : "Inativa"}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(queue)}>
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteMutation.mutate(queue.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Estratégia</span>
                    <Badge variant="outline" className="text-[10px]">{strategyLabels[queue.strategy]}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Timeout
                    </span>
                    <span className="text-[11px] font-medium">{queue.timeout}s</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> Máx. Chamadores
                    </span>
                    <span className="text-[11px] font-medium">{queue.maxCallers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Wrap-up
                    </span>
                    <span className="text-[11px] font-medium">{queue.wrapupTime}s</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{serverName}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{companyName}</Badge>
                  <Badge variant="outline" className="text-[10px]">MoH: {queue.musicOnHold}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered?.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>Nenhuma fila encontrada</p>
          </div>
        )}
      </div>

      {amiServers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-sm font-semibold">Status das Filas no Asterisk (Tempo Real)</h2>
            <div className="flex items-center gap-2">
              <Select value={selectedServer || ""} onValueChange={(v) => setSelectedServer(v || null)}>
                <SelectTrigger className="w-[200px]" data-testid="select-ami-server">
                  <SelectValue placeholder="Selecione servidor" />
                </SelectTrigger>
                <SelectContent>
                  {amiServers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedServer && (
                <Button variant="outline" size="sm" onClick={() => refetchAmiQueues()} disabled={loadingAmiQueues}>
                  {loadingAmiQueues ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
              )}
            </div>
          </div>

          {selectedServer && (
            loadingAmiQueues ? (
              <Skeleton className="h-32 w-full" />
            ) : amiQueueStatus && amiQueueStatus.length > 0 ? (
              <div className="space-y-3">
                {amiQueueStatus.map((q: any, i: number) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          <span className="text-sm font-semibold">{q.queue}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{q.strategy}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{q.calls || 0} chamadas</Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                        <div className="p-2 rounded-md bg-muted/50">
                          <span className="text-[10px] text-muted-foreground block">Completadas</span>
                          <span className="text-xs font-medium">{q.completed || 0}</span>
                        </div>
                        <div className="p-2 rounded-md bg-muted/50">
                          <span className="text-[10px] text-muted-foreground block">Abandonadas</span>
                          <span className="text-xs font-medium">{q.abandoned || 0}</span>
                        </div>
                        <div className="p-2 rounded-md bg-muted/50">
                          <span className="text-[10px] text-muted-foreground block">Tempo Espera</span>
                          <span className="text-xs font-medium">{q.holdtime || 0}s</span>
                        </div>
                        <div className="p-2 rounded-md bg-muted/50">
                          <span className="text-[10px] text-muted-foreground block">Tempo Fala</span>
                          <span className="text-xs font-medium">{q.talktime || 0}s</span>
                        </div>
                        <div className="p-2 rounded-md bg-muted/50">
                          <span className="text-[10px] text-muted-foreground block">Membros</span>
                          <span className="text-xs font-medium">{q.members?.length || 0}</span>
                        </div>
                      </div>
                      {q.members && q.members.length > 0 && (
                        <div className="mt-3 overflow-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Membro</TableHead>
                                <TableHead className="text-xs">Interface</TableHead>
                                <TableHead className="text-xs">Chamadas</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs">Pausado</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {q.members.map((m: any, mi: number) => (
                                <TableRow key={mi}>
                                  <TableCell className="text-xs font-medium">{m.name || "-"}</TableCell>
                                  <TableCell className="text-xs">{m.location || m.stateinterface || "-"}</TableCell>
                                  <TableCell className="text-xs">{m.callstaken || 0}</TableCell>
                                  <TableCell>
                                    <Badge variant={m.status === "1" ? "default" : "secondary"} className="text-[10px]">
                                      {m.status === "1" ? "Disponível" : m.status === "2" ? "Em uso" : m.status === "6" ? "Tocando" : "Offline"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={m.paused === "1" ? "destructive" : "outline"} className="text-[10px]">
                                      {m.paused === "1" ? "Pausado" : "Ativo"}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma fila encontrada no servidor Asterisk
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
