import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Phone,
  Globe,
  Users,
  Crown,
  Server as ServerIcon,
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
import type { Company, Server as ServerType } from "@shared/schema";

const companyFormSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  domain: z.string().optional(),
  type: z.enum(["master", "tenant", "dedicated"]),
  maxExtensions: z.coerce.number().min(1).default(50),
  maxTrunks: z.coerce.number().min(1).default(5),
  contactName: z.string().optional(),
  contactEmail: z.string().email("E-mail inválido").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  active: z.boolean().default(true),
  serverId: z.string().optional(),
});

type CompanyForm = z.infer<typeof companyFormSchema>;

const typeLabels: Record<string, string> = {
  master: "Master",
  tenant: "Multi-Tenant",
  dedicated: "Dedicado",
};

const typeIcons: Record<string, any> = {
  master: Crown,
  tenant: Users,
  dedicated: ServerIcon,
};

export default function Companies() {
  const [open, setOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: servers } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const form = useForm<CompanyForm>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      domain: "",
      type: "tenant",
      maxExtensions: 50,
      maxTrunks: 5,
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      active: true,
      serverId: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CompanyForm) => {
      const res = await apiRequest("POST", "/api/companies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setOpen(false);
      form.reset();
      toast({ title: "Empresa criada com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar empresa", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CompanyForm & { id: string }) => {
      const { id, ...body } = data;
      const res = await apiRequest("PATCH", `/api/companies/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setOpen(false);
      setEditingCompany(null);
      form.reset();
      toast({ title: "Empresa atualizada com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar empresa", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Empresa removida com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover empresa", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: CompanyForm) => {
    if (editingCompany) {
      updateMutation.mutate({ ...data, id: editingCompany.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (company: Company) => {
    setEditingCompany(company);
    form.reset({
      name: company.name,
      domain: company.domain || "",
      type: company.type,
      maxExtensions: company.maxExtensions,
      maxTrunks: company.maxTrunks,
      contactName: company.contactName || "",
      contactEmail: company.contactEmail || "",
      contactPhone: company.contactPhone || "",
      active: company.active,
      serverId: company.serverId || "",
    });
    setOpen(true);
  };

  const openCreate = () => {
    setEditingCompany(null);
    form.reset({
      name: "",
      domain: "",
      type: "tenant",
      maxExtensions: 50,
      maxTrunks: 5,
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      active: true,
      serverId: "",
    });
    setOpen(true);
  };

  const filtered = companies?.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-companies">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground">Gerencie as empresas e clientes da plataforma</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-add-company">
              <Plus className="w-4 h-4 mr-2" /> Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingCompany ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl><Input {...field} data-testid="input-company-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-company-type"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="master">Master</SelectItem>
                          <SelectItem value="tenant">Multi-Tenant</SelectItem>
                          <SelectItem value="dedicated">Dedicado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="domain" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Domínio</FormLabel>
                      <FormControl><Input {...field} placeholder="empresa.com" data-testid="input-company-domain" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="maxExtensions" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Máx. Ramais</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-max-extensions" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="maxTrunks" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Máx. Troncos</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-max-trunks" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="contactName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contato</FormLabel>
                    <FormControl><Input {...field} data-testid="input-contact-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="contactEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl><Input {...field} type="email" data-testid="input-contact-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="contactPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl><Input {...field} data-testid="input-contact-phone" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                {(form.watch("type") === "dedicated") && (
                  <FormField control={form.control} name="serverId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Servidor Dedicado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione um servidor" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {servers?.filter(s => s.mode === "dedicated").map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                          {(!servers || servers.filter(s => s.mode === "dedicated").length === 0) && (
                            <SelectItem value="none" disabled>Nenhum servidor dedicado</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-company">
                    {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingCompany ? "Atualizar" : "Criar"}
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
          placeholder="Buscar empresas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search-companies"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered?.map((company) => {
          const TypeIcon = typeIcons[company.type] || Building2;
          return (
            <Card key={company.id} className="hover-elevate" data-testid={`card-company-${company.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                      <TypeIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{company.name}</h3>
                      <span className="text-[11px] text-muted-foreground">{company.domain || "Sem domínio"}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-menu-company-${company.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(company)}>
                        <Edit className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteMutation.mutate(company.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {company.maxExtensions} ramais
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" /> {company.maxTrunks} troncos
                    </span>
                  </div>
                  {company.contactName && (
                    <p className="text-xs text-muted-foreground">
                      {company.contactName} {company.contactEmail ? `• ${company.contactEmail}` : ""}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                  <Badge variant={company.active ? "default" : "secondary"} className="text-[10px]">
                    {company.active ? "Ativa" : "Inativa"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{typeLabels[company.type]}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered?.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>Nenhuma empresa encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
}
