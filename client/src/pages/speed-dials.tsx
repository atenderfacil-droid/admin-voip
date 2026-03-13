import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Zap,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Phone,
  Hash,
  Server,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Server as ServerType } from "@shared/schema";

interface SpeedDial {
  id: string;
  label: string;
  number: string;
  extension: string | null;
  blf: boolean;
  position: number;
  companyId: string;
  serverId: string | null;
}

const speedDialFormSchema = z.object({
  label: z.string().min(1, "Nome é obrigatório"),
  number: z.string().min(1, "Número é obrigatório"),
  extension: z.string().optional(),
  position: z.number().min(0).default(0),
  blf: z.boolean().default(false),
  serverId: z.string().optional(),
});

type SpeedDialForm = z.infer<typeof speedDialFormSchema>;

export default function SpeedDials() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SpeedDial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SpeedDial | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const { data: speedDials, isLoading } = useQuery<SpeedDial[]>({
    queryKey: ["/api/speed-dials"],
  });

  const { data: servers } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const form = useForm<SpeedDialForm>({
    resolver: zodResolver(speedDialFormSchema),
    defaultValues: {
      label: "",
      number: "",
      extension: "",
      position: 0,
      blf: false,
      serverId: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SpeedDialForm) => {
      const payload = {
        ...data,
        extension: data.extension || null,
        serverId: data.serverId || null,
      };
      const res = await apiRequest("POST", "/api/speed-dials", payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/speed-dials"] });
      setOpen(false);
      form.reset();
      toast({
        title: "Speed Dial criado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar Speed Dial", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SpeedDialForm & { id: string }) => {
      const { id, ...body } = data;
      const payload = {
        ...body,
        extension: body.extension || null,
        serverId: body.serverId || null,
      };
      const res = await apiRequest("PUT", `/api/speed-dials/${id}`, payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/speed-dials"] });
      setOpen(false);
      setEditing(null);
      form.reset();
      toast({
        title: "Speed Dial atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar Speed Dial", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/speed-dials/${id}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/speed-dials"] });
      setDeleteTarget(null);
      toast({
        title: "Speed Dial removido com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover Speed Dial", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: SpeedDialForm) => {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (sd: SpeedDial) => {
    setEditing(sd);
    form.reset({
      label: sd.label,
      number: sd.number,
      extension: sd.extension || "",
      position: sd.position,
      blf: sd.blf,
      serverId: sd.serverId || "",
    });
    setOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.reset({
      label: "",
      number: "",
      extension: "",
      position: 0,
      blf: false,
      serverId: "",
    });
    setOpen(true);
  };

  const getServerName = (id: string | null) => {
    if (!id) return "—";
    return servers?.find((s) => s.id === id)?.name || "—";
  };

  const sorted = speedDials
    ? [...speedDials].sort((a, b) => a.position - b.position)
    : [];

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="page-speed-dials-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-speed-dials">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight" data-testid="text-page-title">
            Speed Dial / BLF
          </h1>
          <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">
            Gerenciar teclas de discagem rápida e BLF
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { queryClient.invalidateQueries({ queryKey: ["/api/speed-dials"] }); }} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} data-testid="button-add-speed-dial">
                <Plus className="w-4 h-4 mr-2" /> Novo Speed Dial
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Speed Dial" : "Novo Speed Dial"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nome do Speed Dial" data-testid="input-speed-dial-label" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: +5511999999999" data-testid="input-speed-dial-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="extension"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ramal</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: 1001 (opcional)" data-testid="input-speed-dial-extension" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Posição</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-speed-dial-position"
                        />
                      </FormControl>
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
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-speed-dial-server">
                            <SelectValue placeholder="Selecione um servidor (opcional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
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

                <FormField
                  control={form.control}
                  name="blf"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                      <FormLabel className="cursor-pointer">BLF (Busy Lamp Field)</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-speed-dial-blf"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-speed-dial"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editing ? "Atualizar" : "Criar"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1" data-testid="text-empty-state">Nenhum Speed Dial cadastrado</h3>
            <p className="text-sm text-muted-foreground">
              Clique em "Novo Speed Dial" para adicionar o primeiro registro.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Posição</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Ramal</TableHead>
                  <TableHead>BLF</TableHead>
                  <TableHead>Servidor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((sd) => (
                  <TableRow key={sd.id} data-testid={`row-speed-dial-${sd.id}`}>
                    <TableCell data-testid={`text-position-${sd.id}`}>{sd.position}</TableCell>
                    <TableCell className="font-medium" data-testid={`text-label-${sd.id}`}>{sd.label}</TableCell>
                    <TableCell data-testid={`text-number-${sd.id}`}>
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        {sd.number}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-extension-${sd.id}`}>
                      {sd.extension ? (
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3 text-muted-foreground" />
                          {sd.extension}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell data-testid={`badge-blf-${sd.id}`}>
                      <Badge variant={sd.blf ? "default" : "secondary"} className="text-xs">
                        {sd.blf ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-server-${sd.id}`}>
                      {sd.serverId ? (
                        <div className="flex items-center gap-1">
                          <Server className="w-3 h-3 text-muted-foreground" />
                          {getServerName(sd.serverId)}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(sd)}
                          data-testid={`button-edit-speed-dial-${sd.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(sd)}
                            data-testid={`button-delete-speed-dial-${sd.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o Speed Dial "{deleteTarget?.label}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
