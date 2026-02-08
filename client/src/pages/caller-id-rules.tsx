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
  Shield,
  Hash,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CallerIdRule, Company, Server as ServerType } from "@shared/schema";

const callerIdRuleFormSchema = z.object({
  name: z.string().min(2, "Nome da regra obrigatório"),
  description: z.string().optional(),
  matchPattern: z.string().min(1, "Padrão de correspondência obrigatório"),
  action: z.enum(["set", "prefix", "suffix", "remove_prefix", "block"]),
  value: z.string().optional(),
  priority: z.number().default(0),
  active: z.boolean().default(true),
  companyId: z.string().min(1, "Selecione uma empresa"),
  serverId: z.string().optional(),
});

type CallerIdRuleForm = z.infer<typeof callerIdRuleFormSchema>;

const actionLabels: Record<string, string> = {
  set: "Definir CallerID",
  prefix: "Adicionar Prefixo",
  suffix: "Adicionar Sufixo",
  remove_prefix: "Remover Prefixo",
  block: "Bloquear",
};

const actionBadgeLabels: Record<string, string> = {
  set: "Definir",
  prefix: "Prefixar",
  suffix: "Sufixar",
  remove_prefix: "Remover Prefixo",
  block: "Bloquear",
};

export default function CallerIdRules() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CallerIdRule | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: rules, isLoading } = useQuery<CallerIdRule[]>({
    queryKey: ["/api/caller-id-rules"],
  });
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });
  const { data: servers } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const form = useForm<CallerIdRuleForm>({
    resolver: zodResolver(callerIdRuleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      matchPattern: "",
      action: "set",
      value: "",
      priority: 0,
      active: true,
      companyId: "",
      serverId: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CallerIdRuleForm) => {
      const payload = {
        ...data,
        description: data.description || null,
        value: data.value || null,
        serverId: data.serverId || null,
      };
      const res = await apiRequest("POST", "/api/caller-id-rules", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/caller-id-rules"] });
      setOpen(false);
      form.reset();
      toast({ title: "Regra criada com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar regra", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CallerIdRuleForm & { id: string }) => {
      const { id, ...body } = data;
      const payload = {
        ...body,
        description: body.description || null,
        value: body.value || null,
        serverId: body.serverId || null,
      };
      const res = await apiRequest("PATCH", `/api/caller-id-rules/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/caller-id-rules"] });
      setOpen(false);
      setEditing(null);
      form.reset();
      toast({ title: "Regra atualizada com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar regra", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/caller-id-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/caller-id-rules"] });
      toast({ title: "Regra removida com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover regra", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = async (data: CallerIdRuleForm) => {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (rule: CallerIdRule) => {
    setEditing(rule);
    form.reset({
      name: rule.name,
      description: rule.description || "",
      matchPattern: rule.matchPattern,
      action: rule.action,
      value: rule.value || "",
      priority: rule.priority,
      active: rule.active,
      companyId: rule.companyId,
      serverId: rule.serverId || "",
    });
    setOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.reset({
      name: "",
      description: "",
      matchPattern: "",
      action: "set",
      value: "",
      priority: 0,
      active: true,
      companyId: "",
      serverId: "",
    });
    setOpen(true);
  };

  const filtered = rules?.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.matchPattern.toLowerCase().includes(searchTerm.toLowerCase())
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
    <div className="space-y-6" data-testid="page-caller-id-rules">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">CallerID / Regras de Prefixo</h1>
          <p className="text-sm text-muted-foreground">Gerencie regras de manipulação de CallerID e prefixos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} data-testid="button-add-rule">
                <Plus className="w-4 h-4 mr-2" /> Nova Regra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar Regra" : "Nova Regra"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Regra</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nome da regra" data-testid="input-rule-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Descrição da regra" data-testid="input-rule-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="matchPattern" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Padrão de Correspondência</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="^55.* ou 0800" data-testid="input-rule-match-pattern" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="action" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ação</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-rule-action">
                            <SelectValue placeholder="Selecione a ação" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="set">Definir CallerID</SelectItem>
                          <SelectItem value="prefix">Adicionar Prefixo</SelectItem>
                          <SelectItem value="suffix">Adicionar Sufixo</SelectItem>
                          <SelectItem value="remove_prefix">Remover Prefixo</SelectItem>
                          <SelectItem value="block">Bloquear</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="value" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Novo CallerID ou prefixo/sufixo" data-testid="input-rule-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-rule-priority"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="active" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                      <FormLabel className="cursor-pointer">Ativa</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-rule-active"
                        />
                      </FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="companyId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-rule-company">
                            <SelectValue placeholder="Selecione uma empresa" />
                          </SelectTrigger>
                        </FormControl>
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
                      <FormLabel>Servidor (opcional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-rule-server">
                            <SelectValue placeholder="Nenhum (todas os servidores)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Nenhum</SelectItem>
                          {servers?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-rule">
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-save-rule"
                    >
                      {(createMutation.isPending || updateMutation.isPending) ? "Salvando..." : editing ? "Atualizar" : "Criar"}
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
          placeholder="Buscar por nome ou padrão..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search-rules"
        />
      </div>

      {filtered && filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm">Nenhuma regra encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map((rule) => (
            <Card key={rule.id} data-testid={`card-rule-${rule.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 flex-shrink-0">
                      <Phone className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold truncate" data-testid={`text-rule-name-${rule.id}`}>{rule.name}</h3>
                      {rule.description && (
                        <p className="text-[11px] text-muted-foreground truncate">{rule.description}</p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-menu-rule-${rule.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(rule)} data-testid={`button-edit-rule-${rule.id}`}>
                        <Edit className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteMutation.mutate(rule.id)}
                        className="text-red-600 dark:text-red-400"
                        data-testid={`button-delete-rule-${rule.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" data-testid={`badge-action-${rule.id}`}>
                    {actionBadgeLabels[rule.action] || rule.action}
                  </Badge>
                  <Badge variant={rule.active ? "default" : "outline"} data-testid={`badge-active-${rule.id}`}>
                    {rule.active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>

                <div className="space-y-1.5 text-[12px]">
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">Padrão:</span>
                    <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]" data-testid={`text-pattern-${rule.id}`}>
                      {rule.matchPattern}
                    </code>
                  </div>

                  {rule.value && (
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Valor:</span>
                      <span className="font-medium" data-testid={`text-value-${rule.id}`}>{rule.value}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">Prioridade:</span>
                    <span className="font-medium" data-testid={`text-priority-${rule.id}`}>{rule.priority}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">Empresa:</span>
                    <span className="font-medium" data-testid={`text-company-${rule.id}`}>{getCompanyName(rule.companyId)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
