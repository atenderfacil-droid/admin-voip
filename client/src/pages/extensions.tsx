import { useState, useCallback } from "react";
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
  Download,
  Loader2,
  Check,
  AlertTriangle,
  ServerCog,
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
import { Checkbox } from "@/components/ui/checkbox";
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

interface ServerExtension {
  number: string;
  name: string;
  protocol: string;
  status: string;
  ipAddress: string;
  exists: boolean;
  existingId?: string;
}

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
  const [fetchOpen, setFetchOpen] = useState(false);
  const [fetchServerId, setFetchServerId] = useState("");
  const [serverExtensions, setServerExtensions] = useState<ServerExtension[]>([]);
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
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

  const amiServers = servers?.filter((s) => s.amiEnabled) || [];

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

  const watchedServerId = form.watch("serverId");
  const watchedNumber = form.watch("number");

  const checkDuplicate = useCallback(async (serverId: string, number: string) => {
    if (!serverId || !number || number.length < 3) {
      setDuplicateWarning(null);
      return;
    }
    try {
      const res = await apiRequest("GET", `/api/servers/${serverId}/extensions/check-duplicate/${number}`);
      const data = await res.json();
      if (data.exists) {
        setDuplicateWarning(`Ramal ${number} já existe neste servidor`);
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      setDuplicateWarning(null);
    }
  }, []);

  const createMutation = useMutation({
    mutationFn: async (data: ExtensionForm) => {
      const res = await apiRequest("POST", "/api/extensions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/extensions"] });
      setOpen(false);
      form.reset();
      setDuplicateWarning(null);
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

  const fetchMutation = useMutation({
    mutationFn: async (serverId: string) => {
      const res = await apiRequest("POST", `/api/servers/${serverId}/ami/fetch-extensions`);
      return res.json();
    },
    onSuccess: (data) => {
      setServerExtensions(data.extensions || []);
      setSelectedForImport(new Set());
      if (data.extensions?.length === 0) {
        toast({ title: "Nenhum ramal encontrado no servidor", variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao buscar ramais do servidor", description: error.message, variant: "destructive" });
      setServerExtensions([]);
    },
  });

  const importMutation = useMutation({
    mutationFn: async ({ serverId, extensions }: { serverId: string; extensions: Array<{ number: string; name: string; protocol: string }> }) => {
      const res = await apiRequest("POST", `/api/servers/${serverId}/ami/import-extensions`, { extensions });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/extensions"] });
      toast({
        title: "Importação concluída",
        description: `${data.imported} ramal(is) importado(s)${data.skipped > 0 ? `, ${data.skipped} já existente(s)` : ""}`,
      });
      setFetchOpen(false);
      setServerExtensions([]);
      setSelectedForImport(new Set());
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao importar ramais", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = async (data: ExtensionForm) => {
    if (!editing && data.serverId && data.number) {
      try {
        const res = await apiRequest("GET", `/api/servers/${data.serverId}/extensions/check-duplicate/${data.number}`);
        const check = await res.json();
        if (check.exists) {
          toast({ title: "Ramal já existe", description: `O ramal ${data.number} já está cadastrado neste servidor`, variant: "destructive" });
          return;
        }
      } catch {}
    }
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (ext: Extension) => {
    setEditing(ext);
    setDuplicateWarning(null);
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
    setDuplicateWarning(null);
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

  const handleFetchFromServer = () => {
    if (!fetchServerId) {
      toast({ title: "Selecione um servidor", variant: "destructive" });
      return;
    }
    fetchMutation.mutate(fetchServerId);
  };

  const handleImportSelected = () => {
    if (selectedForImport.size === 0) {
      toast({ title: "Selecione pelo menos um ramal para importar", variant: "destructive" });
      return;
    }
    const toImport = serverExtensions
      .filter((e) => selectedForImport.has(e.number) && !e.exists)
      .map((e) => ({ number: e.number, name: e.name, protocol: e.protocol }));
    if (toImport.length === 0) {
      toast({ title: "Todos os ramais selecionados já existem", variant: "destructive" });
      return;
    }
    importMutation.mutate({ serverId: fetchServerId, extensions: toImport });
  };

  const toggleSelectAll = () => {
    const newOnes = serverExtensions.filter((e) => !e.exists);
    if (selectedForImport.size === newOnes.length) {
      setSelectedForImport(new Set());
    } else {
      setSelectedForImport(new Set(newOnes.map((e) => e.number)));
    }
  };

  const toggleSelect = (number: string) => {
    setSelectedForImport((prev) => {
      const next = new Set(prev);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
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
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={fetchOpen} onOpenChange={(v) => { setFetchOpen(v); if (!v) { setServerExtensions([]); setSelectedForImport(new Set()); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-fetch-extensions">
                <Download className="w-4 h-4 mr-2" /> Obter do Servidor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Obter Ramais do Servidor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1.5 block">Servidor</label>
                    <Select value={fetchServerId} onValueChange={setFetchServerId}>
                      <SelectTrigger data-testid="select-fetch-server">
                        <SelectValue placeholder="Selecione um servidor com AMI" />
                      </SelectTrigger>
                      <SelectContent>
                        {amiServers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleFetchFromServer} disabled={fetchMutation.isPending || !fetchServerId} data-testid="button-do-fetch">
                    {fetchMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Buscando...</>
                    ) : (
                      <><ServerCog className="w-4 h-4 mr-2" /> Buscar</>
                    )}
                  </Button>
                </div>

                {fetchMutation.isPending && (
                  <div className="flex items-center justify-center py-8 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Conectando ao servidor e buscando ramais...</span>
                  </div>
                )}

                {serverExtensions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {serverExtensions.length} ramal(is) encontrado(s) no servidor
                        {serverExtensions.filter((e) => e.exists).length > 0 && (
                          <span className="ml-1">({serverExtensions.filter((e) => e.exists).length} já cadastrado(s))</span>
                        )}
                      </p>
                      {serverExtensions.some((e) => !e.exists) && (
                        <Button variant="ghost" size="sm" onClick={toggleSelectAll} data-testid="button-select-all">
                          Selecionar todos novos
                        </Button>
                      )}
                    </div>

                    <div className="border rounded-md divide-y max-h-[400px] overflow-y-auto">
                      {serverExtensions.map((ext) => (
                        <div
                          key={ext.number}
                          className={`flex items-center gap-3 px-4 py-3 ${ext.exists ? "opacity-60" : ""}`}
                          data-testid={`fetch-ext-${ext.number}`}
                        >
                          <Checkbox
                            checked={selectedForImport.has(ext.number)}
                            onCheckedChange={() => toggleSelect(ext.number)}
                            disabled={ext.exists}
                            data-testid={`checkbox-ext-${ext.number}`}
                          />
                          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
                            <Phone className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{ext.number}</span>
                              <Badge variant="outline" className="text-[10px]">{ext.protocol}</Badge>
                            </div>
                            <span className="text-[11px] text-muted-foreground">{ext.name}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {ext.ipAddress !== "-" && (
                              <span className="text-[11px] text-muted-foreground">{ext.ipAddress}</span>
                            )}
                            {ext.exists ? (
                              <Badge variant="secondary" className="text-[10px]">
                                <Check className="w-3 h-3 mr-1" /> Cadastrado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400">
                                Novo
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {serverExtensions.some((e) => !e.exists) && (
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setFetchOpen(false)}>Cancelar</Button>
                        <Button
                          onClick={handleImportSelected}
                          disabled={selectedForImport.size === 0 || importMutation.isPending}
                          data-testid="button-import-extensions"
                        >
                          {importMutation.isPending ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</>
                          ) : (
                            <><Download className="w-4 h-4 mr-2" /> Importar {selectedForImport.size} ramal(is)</>
                          )}
                        </Button>
                      </div>
                    )}

                    {serverExtensions.every((e) => e.exists) && (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        <Check className="w-5 h-5 mx-auto mb-2 text-emerald-500" />
                        Todos os ramais do servidor já estão cadastrados
                      </div>
                    )}
                  </div>
                )}

                {!fetchMutation.isPending && serverExtensions.length === 0 && fetchMutation.isSuccess && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <Phone className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p>Nenhum ramal encontrado no servidor</p>
                  </div>
                )}

                {amiServers.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                    <p>Nenhum servidor com AMI habilitado disponível</p>
                    <p className="text-[11px] mt-1">Configure a conexão AMI em um servidor primeiro</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

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
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="1001"
                            data-testid="input-ext-number"
                            onBlur={(e) => {
                              field.onBlur();
                              if (!editing) checkDuplicate(watchedServerId, e.target.value);
                            }}
                          />
                        </FormControl>
                        {duplicateWarning && !editing && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {duplicateWarning}
                          </p>
                        )}
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
                        <Select
                          onValueChange={(val) => {
                            field.onChange(val);
                            if (!editing && watchedNumber) checkDuplicate(val, watchedNumber);
                          }}
                          value={field.value}
                        >
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
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending || (!!duplicateWarning && !editing)}
                      data-testid="button-submit-extension"
                    >
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
