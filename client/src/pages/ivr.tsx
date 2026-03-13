import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AudioLines,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Play,
  Pause,
  FileEdit,
  Hash,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { IvrMenu, Company, Server as ServerType, IvrOption } from "@shared/schema";

const ivrFormSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  description: z.string().optional(),
  welcomeMessage: z.string().optional(),
  status: z.enum(["active", "inactive", "draft"]).default("draft"),
  timeout: z.coerce.number().min(1).default(10),
  companyId: z.string().min(1, "Selecione uma empresa"),
  serverId: z.string().min(1, "Selecione um servidor"),
  options: z.array(z.object({
    digit: z.string(),
    action: z.string(),
    destination: z.string(),
    label: z.string(),
  })).default([]),
});

type IvrForm = z.infer<typeof ivrFormSchema>;

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  active: { icon: Play, color: "text-emerald-500", label: "Ativo" },
  inactive: { icon: Pause, color: "text-muted-foreground", label: "Inativo" },
  draft: { icon: FileEdit, color: "text-amber-500", label: "Rascunho" },
};

export default function IVR() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IvrMenu | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [ivrOptions, setIvrOptions] = useState<IvrOption[]>([]);
  const { toast } = useToast();

  const { data: ivrMenus, isLoading } = useQuery<IvrMenu[]>({
    queryKey: ["/api/ivr-menus"],
  });
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });
  const { data: servers } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const form = useForm<IvrForm>({
    resolver: zodResolver(ivrFormSchema),
    defaultValues: {
      name: "",
      description: "",
      welcomeMessage: "",
      status: "draft",
      timeout: 10,
      companyId: "",
      serverId: "",
      options: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: IvrForm) => {
      const res = await apiRequest("POST", "/api/ivr-menus", { ...data, options: ivrOptions });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ivr-menus"] });
      setOpen(false);
      form.reset();
      setIvrOptions([]);
      toast({
        title: "Menu IVR criado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar menu IVR", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: IvrForm & { id: string }) => {
      const { id, ...body } = data;
      const res = await apiRequest("PATCH", `/api/ivr-menus/${id}`, { ...body, options: ivrOptions });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ivr-menus"] });
      setOpen(false);
      setEditing(null);
      form.reset();
      setIvrOptions([]);
      toast({
        title: "Menu IVR atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar menu IVR", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/ivr-menus/${id}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ivr-menus"] });
      toast({
        title: "Menu IVR removido com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover menu IVR", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: IvrForm) => {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const addOption = () => {
    setIvrOptions([...ivrOptions, { digit: String(ivrOptions.length + 1), action: "dial", destination: "", label: "" }]);
  };

  const removeOption = (index: number) => {
    setIvrOptions(ivrOptions.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, field: keyof IvrOption, value: string) => {
    const updated = [...ivrOptions];
    updated[index] = { ...updated[index], [field]: value };
    setIvrOptions(updated);
  };

  const openEdit = (ivr: IvrMenu) => {
    setEditing(ivr);
    setIvrOptions(ivr.options || []);
    form.reset({
      name: ivr.name,
      description: ivr.description || "",
      welcomeMessage: ivr.welcomeMessage || "",
      status: ivr.status,
      timeout: ivr.timeout,
      companyId: ivr.companyId,
      serverId: ivr.serverId,
      options: ivr.options || [],
    });
    setOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setIvrOptions([]);
    form.reset();
    setOpen(true);
  };

  const filtered = ivrMenus?.filter(
    (m) => m.name.toLowerCase().includes(searchTerm.toLowerCase())
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
    <div className="space-y-6" data-testid="page-ivr">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">IVR / URA</h1>
          <p className="text-sm text-muted-foreground">Gerencie os menus de atendimento automático</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { queryClient.invalidateQueries({ queryKey: ["/api/ivr-menus"] }); }} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} data-testid="button-add-ivr">
                <Plus className="w-4 h-4 mr-2" /> Novo Menu IVR
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Menu IVR" : "Novo Menu IVR"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl><Input {...field} data-testid="input-ivr-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl><Textarea {...field} className="resize-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="welcomeMessage" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem de Boas-Vindas</FormLabel>
                    <FormControl><Textarea {...field} className="resize-none" placeholder="Bem-vindo à empresa X. Pressione 1 para..." /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="timeout" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeout (seg)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Opções do Menu</span>
                    <Button type="button" variant="outline" size="sm" onClick={addOption}>
                      <Plus className="w-3 h-3 mr-1" /> Adicionar
                    </Button>
                  </div>
                  {ivrOptions.map((opt, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-2">
                        <label className="text-[11px] text-muted-foreground">Tecla</label>
                        <Input
                          value={opt.digit}
                          onChange={(e) => updateOption(i, "digit", e.target.value)}
                          className="text-center"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[11px] text-muted-foreground">Ação</label>
                        <Select value={opt.action} onValueChange={(v) => updateOption(i, "action", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dial">Discar</SelectItem>
                            <SelectItem value="queue">Fila</SelectItem>
                            <SelectItem value="voicemail">Voicemail</SelectItem>
                            <SelectItem value="submenu">Sub-menu</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <label className="text-[11px] text-muted-foreground">Destino</label>
                        <Input
                          value={opt.destination}
                          onChange={(e) => updateOption(i, "destination", e.target.value)}
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[11px] text-muted-foreground">Label</label>
                        <Input
                          value={opt.label}
                          onChange={(e) => updateOption(i, "label", e.target.value)}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(i)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-ivr">
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
          placeholder="Buscar menus IVR..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search-ivr"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered?.map((ivr) => {
          const config = statusConfig[ivr.status];
          const StatusIcon = config.icon;
          return (
            <Card key={ivr.id} className="hover-elevate" data-testid={`card-ivr-${ivr.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                      <AudioLines className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{ivr.name}</h3>
                      <span className="text-[11px] text-muted-foreground">{getCompanyName(ivr.companyId)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <StatusIcon className={`w-4 h-4 ${config.color}`} />
                      <span className={`text-[11px] ${config.color}`}>{config.label}</span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(ivr)}>
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteMutation.mutate(ivr.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {ivr.description && (
                  <p className="text-xs text-muted-foreground mb-3">{ivr.description}</p>
                )}

                {ivr.options && ivr.options.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {ivr.options.map((opt: IvrOption, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="flex items-center justify-center w-5 h-5 rounded bg-muted text-[10px] font-bold">
                          {opt.digit}
                        </div>
                        <span className="text-muted-foreground">{opt.label || opt.destination}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">{opt.action}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-3 border-t flex-wrap">
                  <Badge variant="outline" className="text-[10px]">
                    <Hash className="w-3 h-3 mr-1" /> {ivr.options?.length || 0} opções
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">Timeout: {ivr.timeout}s</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered?.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
            <AudioLines className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>Nenhum menu IVR encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
