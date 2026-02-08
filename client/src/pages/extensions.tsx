import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Phone,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  PhoneCall,
  PhoneOff,
  Voicemail,
  Mic,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Extension, Company, Server as ServerType } from "@shared/schema";

const extensionFormSchema = z.object({
  number: z.string().min(3, "Número do ramal obrigatório"),
  name: z.string().min(2, "Nome obrigatório"),
  secret: z.string().min(4, "Senha deve ter pelo menos 4 caracteres"),
  context: z.string().default("internal"),
  protocol: z.string().default("SIP"),
  callerId: z.string().optional(),
  mailbox: z.string().optional(),
  voicemailEnabled: z.boolean().default(false),
  callRecording: z.boolean().default(false),
  callForwardNumber: z.string().optional(),
  companyId: z.string().min(1, "Selecione uma empresa"),
  serverId: z.string().min(1, "Selecione um servidor"),
});

type ExtensionForm = z.infer<typeof extensionFormSchema>;

const statusConfig: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  active: { color: "text-emerald-500", bg: "bg-emerald-500", label: "Ativo", icon: PhoneCall },
  inactive: { color: "text-muted-foreground", bg: "bg-muted-foreground", label: "Inativo", icon: PhoneOff },
  busy: { color: "text-amber-500", bg: "bg-amber-500", label: "Ocupado", icon: Phone },
  unavailable: { color: "text-red-500", bg: "bg-red-500", label: "Indisponível", icon: PhoneOff },
};

export default function Extensions() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Extension | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: extensions, isLoading } = useQuery<Extension[]>({
    queryKey: ["/api/extensions"],
  });
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });
  const { data: servers } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const form = useForm<ExtensionForm>({
    resolver: zodResolver(extensionFormSchema),
    defaultValues: {
      number: "",
      name: "",
      secret: "",
      context: "internal",
      protocol: "SIP",
      callerId: "",
      mailbox: "",
      voicemailEnabled: false,
      callRecording: false,
      callForwardNumber: "",
      companyId: "",
      serverId: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExtensionForm) => {
      const res = await apiRequest("POST", "/api/extensions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/extensions"] });
      setOpen(false);
      form.reset();
      toast({ title: "Ramal criado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar ramal", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ExtensionForm & { id: string }) => {
      const { id, ...body } = data;
      const res = await apiRequest("PATCH", `/api/extensions/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/extensions"] });
      setOpen(false);
      setEditing(null);
      form.reset();
      toast({ title: "Ramal atualizado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar ramal", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/extensions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/extensions"] });
      toast({ title: "Ramal removido com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover ramal", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: ExtensionForm) => {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (ext: Extension) => {
    setEditing(ext);
    form.reset({
      number: ext.number,
      name: ext.name,
      secret: ext.secret,
      context: ext.context,
      protocol: ext.protocol,
      callerId: ext.callerId || "",
      mailbox: ext.mailbox || "",
      voicemailEnabled: ext.voicemailEnabled,
      callRecording: ext.callRecording,
      callForwardNumber: ext.callForwardNumber || "",
      companyId: ext.companyId,
      serverId: ext.serverId,
    });
    setOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.reset({
      number: "",
      name: "",
      secret: "",
      context: "internal",
      protocol: "SIP",
      callerId: "",
      mailbox: "",
      voicemailEnabled: false,
      callRecording: false,
      callForwardNumber: "",
      companyId: "",
      serverId: "",
    });
    setOpen(true);
  };

  const filtered = extensions?.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.number.includes(searchTerm)
  );

  const getCompanyName = (id: string) => companies?.find((c) => c.id === id)?.name || "—";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-extensions">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Ramais / Extensões</h1>
          <p className="text-sm text-muted-foreground">Gerencie os ramais SIP dos seus servidores</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-add-extension">
              <Plus className="w-4 h-4 mr-2" /> Novo Ramal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Ramal" : "Novo Ramal"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="number" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl><Input {...field} placeholder="1001" data-testid="input-ext-number" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl><Input {...field} data-testid="input-ext-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="secret" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha SIP</FormLabel>
                      <FormControl><Input {...field} type="password" data-testid="input-ext-secret" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="protocol" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Protocolo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-ext-protocol"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="SIP">SIP</SelectItem>
                          <SelectItem value="PJSIP">PJSIP</SelectItem>
                          <SelectItem value="IAX2">IAX2</SelectItem>
                          <SelectItem value="WebRTC">WebRTC</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="companyId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-ext-company"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
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
                        <FormControl><SelectTrigger data-testid="select-ext-server"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
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
                <FormField control={form.control} name="callerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Caller ID</FormLabel>
                    <FormControl><Input {...field} placeholder='"Nome" <1001>' data-testid="input-ext-callerid" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="callForwardNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Encaminhar para</FormLabel>
                    <FormControl><Input {...field} placeholder="Número para encaminhamento" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="voicemailEnabled" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <FormLabel className="text-xs">Correio de Voz</FormLabel>
                        <FormDescription className="text-[10px]">Ativar voicemail</FormDescription>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="callRecording" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <FormLabel className="text-xs">Gravação</FormLabel>
                        <FormDescription className="text-[10px]">Gravar chamadas</FormDescription>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-extension">
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
          placeholder="Buscar ramais..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search-extensions"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered?.map((ext) => {
          const config = statusConfig[ext.status];
          return (
            <Card key={ext.id} className="hover-elevate" data-testid={`card-ext-${ext.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{ext.number}</h3>
                        <div className={`w-2 h-2 rounded-full ${config.bg}`} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{ext.name}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(ext)}>
                        <Edit className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteMutation.mutate(ext.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p>Empresa: <span className="font-medium text-foreground">{getCompanyName(ext.companyId)}</span></p>
                  <p>Protocolo: <span className="font-medium">{ext.protocol}</span> | Contexto: <span className="font-medium">{ext.context}</span></p>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap">
                  <Badge variant={ext.status === "active" ? "default" : "secondary"} className="text-[10px]">
                    {config.label}
                  </Badge>
                  {ext.voicemailEnabled && (
                    <Badge variant="outline" className="text-[10px]">
                      <Voicemail className="w-3 h-3 mr-1" /> Voicemail
                    </Badge>
                  )}
                  {ext.callRecording && (
                    <Badge variant="outline" className="text-[10px]">
                      <Mic className="w-3 h-3 mr-1" /> Gravação
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered?.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
            <Phone className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>Nenhum ramal encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
