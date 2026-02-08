import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Phone,
  Hash,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Clock,
  Globe,
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
import type { Did, Company, Server as ServerType } from "@shared/schema";

const destTypeLabels: Record<string, string> = {
  extension: "Ramal",
  queue: "Fila",
  ivr: "IVR",
  external: "Externo",
};

const destTypePlaceholders: Record<string, string> = {
  extension: "Ex: 1001",
  queue: "Ex: vendas",
  ivr: "Ex: menu-principal",
  external: "Ex: +5511999999999",
};

const didFormSchema = z.object({
  number: z.string().min(1, "Número DID obrigatório"),
  description: z.string().optional(),
  destinationType: z.enum(["extension", "queue", "ivr", "external"]),
  destinationValue: z.string().min(1, "Destino obrigatório"),
  businessHoursStart: z.string().optional(),
  businessHoursEnd: z.string().optional(),
  businessDays: z.string().optional(),
  afterHoursDestType: z.string().optional(),
  afterHoursDestValue: z.string().optional(),
  active: z.boolean().default(true),
  companyId: z.string().min(1, "Selecione uma empresa"),
  serverId: z.string().min(1, "Selecione um servidor"),
});

type DidForm = z.infer<typeof didFormSchema>;

export default function Dids() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Did | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: dids, isLoading } = useQuery<Did[]>({
    queryKey: ["/api/dids"],
  });
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });
  const { data: servers } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const form = useForm<DidForm>({
    resolver: zodResolver(didFormSchema),
    defaultValues: {
      number: "",
      description: "",
      destinationType: "extension",
      destinationValue: "",
      businessHoursStart: "08:00",
      businessHoursEnd: "18:00",
      businessDays: "1,2,3,4,5",
      afterHoursDestType: "",
      afterHoursDestValue: "",
      active: true,
      companyId: "",
      serverId: "",
    },
  });

  const watchedDestType = form.watch("destinationType");

  const createMutation = useMutation({
    mutationFn: async (data: DidForm) => {
      const payload = {
        ...data,
        description: data.description || null,
        businessHoursStart: data.businessHoursStart || null,
        businessHoursEnd: data.businessHoursEnd || null,
        businessDays: data.businessDays || null,
        afterHoursDestType: data.afterHoursDestType || null,
        afterHoursDestValue: data.afterHoursDestValue || null,
      };
      const res = await apiRequest("POST", "/api/dids", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dids"] });
      setOpen(false);
      form.reset();
      toast({ title: "DID criado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar DID", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: DidForm & { id: string }) => {
      const { id, ...rest } = data;
      const payload = {
        ...rest,
        description: rest.description || null,
        businessHoursStart: rest.businessHoursStart || null,
        businessHoursEnd: rest.businessHoursEnd || null,
        businessDays: rest.businessDays || null,
        afterHoursDestType: rest.afterHoursDestType || null,
        afterHoursDestValue: rest.afterHoursDestValue || null,
      };
      const res = await apiRequest("PATCH", `/api/dids/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dids"] });
      setOpen(false);
      setEditing(null);
      form.reset();
      toast({ title: "DID atualizado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar DID", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/dids/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dids"] });
      toast({ title: "DID removido com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover DID", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: DidForm) => {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (did: Did) => {
    setEditing(did);
    form.reset({
      number: did.number,
      description: did.description || "",
      destinationType: did.destinationType,
      destinationValue: did.destinationValue,
      businessHoursStart: did.businessHoursStart || "08:00",
      businessHoursEnd: did.businessHoursEnd || "18:00",
      businessDays: did.businessDays || "1,2,3,4,5",
      afterHoursDestType: did.afterHoursDestType || "",
      afterHoursDestValue: did.afterHoursDestValue || "",
      active: did.active,
      companyId: did.companyId,
      serverId: did.serverId,
    });
    setOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.reset({
      number: "",
      description: "",
      destinationType: "extension",
      destinationValue: "",
      businessHoursStart: "08:00",
      businessHoursEnd: "18:00",
      businessDays: "1,2,3,4,5",
      afterHoursDestType: "",
      afterHoursDestValue: "",
      active: true,
      companyId: "",
      serverId: "",
    });
    setOpen(true);
  };

  const filtered = dids?.filter(
    (d) =>
      d.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCompanyName = (id: string) => companies?.find((c) => c.id === id)?.name || "—";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-dids">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">DID / DDR</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os números de entrada (DID/DDR)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} data-testid="button-add-did">
                <Plus className="w-4 h-4 mr-2" /> Novo DID
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar DID" : "Novo DID"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número DID</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: +551140001234" data-testid="input-did-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Descrição do DID" data-testid="input-did-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="destinationType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Destino</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-did-dest-type">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="extension">Ramal</SelectItem>
                              <SelectItem value="queue">Fila</SelectItem>
                              <SelectItem value="ivr">IVR</SelectItem>
                              <SelectItem value="external">Externo</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="destinationValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Destino</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={destTypePlaceholders[watchedDestType] || "Destino"}
                              data-testid="input-did-dest-value"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="businessHoursStart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Horário Comercial Início</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} data-testid="input-did-hours-start" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="businessHoursEnd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Horário Comercial Fim</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} data-testid="input-did-hours-end" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="businessDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dias Úteis</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="1,2,3,4,5" data-testid="input-did-business-days" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="afterHoursDestType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Destino Fora do Horário</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)}
                            value={field.value || "__none__"}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-did-after-dest-type">
                                <SelectValue placeholder="Nenhum" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">Nenhum</SelectItem>
                              <SelectItem value="extension">Ramal</SelectItem>
                              <SelectItem value="queue">Fila</SelectItem>
                              <SelectItem value="ivr">IVR</SelectItem>
                              <SelectItem value="external">Externo</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="afterHoursDestValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Destino Fora do Horário</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Destino fora do horário" data-testid="input-did-after-dest-value" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="companyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Empresa</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-did-company">
                                <SelectValue placeholder="Selecione uma empresa" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {companies?.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="serverId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Servidor</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-did-server">
                                <SelectValue placeholder="Selecione um servidor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {servers?.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3">
                        <FormLabel className="cursor-pointer">Ativo</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-did-active"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-did">
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-save-did"
                    >
                      {editing ? "Salvar" : "Criar"}
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
          placeholder="Buscar por número ou descrição..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search-dids"
        />
      </div>

      {filtered && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhum DID encontrado</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered?.map((did) => (
          <Card key={did.id} data-testid={`card-did-${did.id}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 flex-shrink-0">
                    <Hash className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" data-testid={`text-did-number-${did.id}`}>
                      {did.number}
                    </p>
                    {did.description && (
                      <p className="text-[11px] text-muted-foreground truncate" data-testid={`text-did-desc-${did.id}`}>
                        {did.description}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-menu-did-${did.id}`}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(did)} data-testid={`button-edit-did-${did.id}`}>
                      <Edit className="w-4 h-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteMutation.mutate(did.id)}
                      className="text-destructive"
                      data-testid={`button-delete-did-${did.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]" data-testid={`badge-dest-type-${did.id}`}>
                  {destTypeLabels[did.destinationType] || did.destinationType}
                </Badge>
                <Badge
                  variant={did.active ? "default" : "secondary"}
                  className="text-[10px]"
                  data-testid={`badge-active-${did.id}`}
                >
                  {did.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>

              <div className="space-y-1 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3" />
                  <span data-testid={`text-did-dest-${did.id}`}>{did.destinationValue}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3 h-3" />
                  <span data-testid={`text-did-company-${did.id}`}>{getCompanyName(did.companyId)}</span>
                </div>
                {(did.businessHoursStart || did.businessHoursEnd) && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span data-testid={`text-did-hours-${did.id}`}>
                      {did.businessHoursStart || "—"} - {did.businessHoursEnd || "—"}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
