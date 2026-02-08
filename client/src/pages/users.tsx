import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Users as UsersIcon,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Shield,
  UserCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Company } from "@shared/schema";

const userFormSchema = z.object({
  username: z.string().min(3, "Usuário deve ter pelo menos 3 caracteres"),
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional().or(z.literal("")),
  role: z.enum(["super_admin", "admin", "operator", "viewer"]),
  companyId: z.string().min(1, "Selecione uma empresa"),
  active: z.boolean().default(true),
});

type UserForm = z.infer<typeof userFormSchema>;

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  operator: "Operador",
  viewer: "Visualizador",
};

const roleColors: Record<string, string> = {
  super_admin: "destructive",
  admin: "default",
  operator: "secondary",
  viewer: "outline",
};

type AuthUser = Omit<User, "password">;

export default function UsersPage() {
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const { data: users, isLoading } = useQuery<AuthUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const form = useForm<UserForm>({
    resolver: zodResolver(
      editingUser
        ? userFormSchema.extend({ password: z.string().optional().or(z.literal("")) })
        : userFormSchema.extend({ password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres") })
    ),
    defaultValues: {
      username: "",
      fullName: "",
      email: "",
      password: "",
      role: "viewer",
      companyId: "",
      active: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: UserForm) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setOpen(false);
      form.reset();
      toast({ title: "Usuário criado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar usuário", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UserForm & { id: string }) => {
      const { id, ...body } = data;
      if (!body.password) delete (body as any).password;
      const res = await apiRequest("PATCH", `/api/users/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setOpen(false);
      setEditingUser(null);
      form.reset();
      toast({ title: "Usuário atualizado com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar usuário", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuário removido com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover usuário", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: UserForm) => {
    if (editingUser) {
      updateMutation.mutate({ ...data, id: editingUser.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (user: AuthUser) => {
    setEditingUser(user);
    form.reset({
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      password: "",
      role: user.role,
      companyId: user.companyId || "",
      active: user.active,
    });
    setOpen(true);
  };

  const openCreate = () => {
    setEditingUser(null);
    form.reset({
      username: "",
      fullName: "",
      email: "",
      password: "",
      role: "viewer",
      companyId: currentUser?.role === "super_admin" ? "" : (currentUser?.companyId || ""),
      active: true,
    });
    setOpen(true);
  };

  const filtered = users?.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return "Sem empresa";
    return companies?.find((c) => c.id === companyId)?.name || "—";
  };

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
    <div className="space-y-6" data-testid="page-users">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie os usuários do sistema</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-add-user">
              <Plus className="w-4 h-4 mr-2" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl><Input {...field} data-testid="input-user-fullname" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuário</FormLabel>
                      <FormControl><Input {...field} data-testid="input-user-username" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl><Input {...field} type="email" data-testid="input-user-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{editingUser ? "Nova Senha (opcional)" : "Senha"}</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder={editingUser ? "Deixe vazio para manter" : "Mínimo 6 caracteres"}
                            data-testid="input-user-password"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Perfil</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {currentUser?.role === "super_admin" && (
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          )}
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="operator">Operador</SelectItem>
                          <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="companyId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-user-company"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {companies?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="active" render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Ativo</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-user-active"
                      />
                    </FormControl>
                  </FormItem>
                )} />
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-user">
                    {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingUser ? "Atualizar" : "Criar"}
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
          placeholder="Buscar usuários..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search-users"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered?.map((user) => (
          <Card key={user.id} className="hover-elevate" data-testid={`card-user-${user.id}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                    {user.role === "super_admin" ? (
                      <Shield className="w-5 h-5 text-primary" />
                    ) : (
                      <UserCheck className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{user.fullName}</h3>
                    <span className="text-[11px] text-muted-foreground">@{user.username}</span>
                  </div>
                </div>
                {currentUser?.id !== user.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-menu-user-${user.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(user)}>
                        <Edit className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteMutation.mutate(user.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <p className="text-xs text-muted-foreground">{getCompanyName(user.companyId)}</p>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Badge variant={user.active ? "default" : "secondary"} className="text-[10px]">
                  {user.active ? "Ativo" : "Inativo"}
                </Badge>
                <Badge variant={roleColors[user.role] as any} className="text-[10px]">
                  {roleLabels[user.role]}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered?.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
            <UsersIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>Nenhum usuário encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
