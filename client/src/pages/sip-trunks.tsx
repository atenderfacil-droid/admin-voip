import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Globe,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Ban,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SipTrunk, Company, Server as ServerType } from "@shared/schema";

const trunkFormSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  provider: z.string().min(1, "Provedor obrigatório"),
  host: z.string().min(1, "Host obrigatório"),
  port: z.coerce.number().min(1).default(5060),
  username: z.string().optional(),
  password: z.string().optional(),
  codec: z.string().default("G.711"),
  dtmfMode: z.string().default("rfc2833"),
  maxChannels: z.coerce.number().min(1).default(30),
  context: z.string().default("from-trunk"),
  companyId: z.string().min(1, "Selecione uma empresa"),
  serverId: z.string().min(1, "Selecione um servidor"),
});

type TrunkForm = z.infer<typeof trunkFormSchema>;

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  registered: { icon: CheckCircle2, color: "text-emerald-500", label: "Registrado" },
  unregistered: { icon: XCircle, color: "text-muted-foreground", label: "Não Registrado" },
  failed: { icon: AlertCircle, color: "text-red-500", label: "Falha" },
  disabled: { icon: Ban, color: "text-muted-foreground", label: "Desativado" },
};

export default function SipTrunks() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SipTrunk | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: trunks, isLoading } = useQuery<SipTrunk[]>({
    queryKey: ["/api/sip-trunks"],
  });
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });
  const { data: servers } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const form = useForm<TrunkForm>({
    resolver: zodResolver(trunkFormSchema),
    defaultValues: {
      name: "",
      provider: "",
      host: "",
      port: 5060,
      username: "",
      password: "",
      codec: "G.711",
      dtmfMode: "rfc2833",
      maxChannels: 30,
      context: "from-trunk",
      companyId: "",
      serverId: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TrunkForm) => {
      const res = await apiRequest("POST", "/api/sip-trunks", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sip-trunks"] });
      setOpen(false);
      form.reset();
      toast({
        title: "Tronco SIP criado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar tronco SIP", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TrunkForm & { id: string }) => {
      const { id, ...body } = data;
      const res = await apiRequest("PATCH", `/api/sip-trunks/${id}`, body);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sip-trunks"] });
      setOpen(false);
      setEditing(null);
      form.reset();
      toast({
        title: "Tronco SIP atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar tronco SIP", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/sip-trunks/${id}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sip-trunks"] });
      toast({
        title: "Tronco SIP removido com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover tronco SIP", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: TrunkForm) => {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (trunk: SipTrunk) => {
    setEditing(trunk);
    form.reset({
      name: trunk.name,
      provider: trunk.provider,
      host: trunk.host,
      port: trunk.port,
      username: trunk.username || "",
      password: trunk.password || "",
      codec: trunk.codec,
      dtmfMode: trunk.dtmfMode,
      maxChannels: trunk.maxChannels,
      context: trunk.context,
      companyId: trunk.companyId,
      serverId: trunk.serverId,
    });
    setOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.reset();
    setOpen(true);
  };

  const filtered = trunks?.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.provider.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCompanyName = (id: string) => companies?.find((c) => c.id === id)?.name || "—";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-sip-trunks">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Troncos SIP</h1>
          <p className="text-sm text-muted-foreground">Gerencie as conexões com operadoras e provedores VoIP</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { queryClient.invalidateQueries({ queryKey: ["/api/sip-trunks"] }); }} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} data-testid="button-add-trunk">
                <Plus className="w-4 h-4 mr-2" /> Novo Tronco SIP
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Tronco SIP" : "Novo Tronco SIP"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl><Input {...field} data-testid="input-trunk-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="provider" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provedor</FormLabel>
                      <FormControl><Input {...field} placeholder="Ex: Telnyx, Twilio" data-testid="input-trunk-provider" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="host" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Host</FormLabel>
                      <FormControl><Input {...field} placeholder="sip.provedor.com" data-testid="input-trunk-host" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="port" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Porta</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="codec" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Codec</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="G.711">G.711</SelectItem>
                          <SelectItem value="G.722">G.722 (HD)</SelectItem>
                          <SelectItem value="G.729">G.729</SelectItem>
                          <SelectItem value="Opus">Opus</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dtmfMode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>DTMF</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="rfc2833">RFC 2833</SelectItem>
                          <SelectItem value="inband">In-Band</SelectItem>
                          <SelectItem value="info">SIP INFO</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuário</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl><Input {...field} type="password" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="companyId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
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
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {servers?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="maxChannels" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máximo de Canais</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-trunk">
                    {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editing ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar troncos SIP..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search-trunks"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered?.map((trunk) => {
          const config = statusConfig[trunk.status];
          const StatusIcon = config.icon;
          return (
            <Card key={trunk.id} className="hover-elevate" data-testid={`card-trunk-${trunk.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                      <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{trunk.name}</h3>
                      <span className="text-[11px] text-muted-foreground">{trunk.provider}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <StatusIcon className={`w-4 h-4 ${config.color}`} />
                      <span className={`text-[11px] font-medium ${config.color}`}>{config.label}</span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(trunk)}>
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteMutation.mutate(trunk.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p>Host: <span className="font-medium text-foreground">{trunk.host}:{trunk.port}</span></p>
                  <p>Empresa: <span className="font-medium">{getCompanyName(trunk.companyId)}</span></p>
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>Máx. Canais: {trunk.maxChannels}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{trunk.codec}</Badge>
                  <Badge variant="outline" className="text-[10px]">DTMF: {trunk.dtmfMode}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{trunk.context}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered?.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
            <Globe className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>Nenhum tronco SIP encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
