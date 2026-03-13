import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Phone,
  Lock,
  Mic,
  MicOff,
  Volume2,
  RefreshCw,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Server as ServerType } from "@shared/schema";

interface ConferenceRoom {
  id: string;
  name: string;
  roomNumber: string;
  pin: string | null;
  adminPin: string | null;
  maxParticipants: number | null;
  recordConference: boolean;
  musicOnHold: string | null;
  announceJoinLeave: boolean;
  waitForLeader: boolean;
  quietMode: boolean;
  active: boolean;
  companyId: string;
  serverId: string;
}

const conferenceRoomFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  roomNumber: z.string().min(1, "Número é obrigatório"),
  pin: z.string().optional(),
  adminPin: z.string().optional(),
  maxParticipants: z.coerce.number().min(0).optional(),
  serverId: z.string().min(1, "Servidor é obrigatório"),
  musicOnHold: z.string().optional(),
  recordConference: z.boolean().default(false),
  announceJoinLeave: z.boolean().default(false),
  waitForLeader: z.boolean().default(false),
  quietMode: z.boolean().default(false),
  active: z.boolean().default(true),
});

type ConferenceRoomForm = z.infer<typeof conferenceRoomFormSchema>;

export default function ConferenceRooms() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConferenceRoom | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConferenceRoom | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: rooms, isLoading } = useQuery<ConferenceRoom[]>({
    queryKey: ["/api/conference-rooms"],
  });

  const { data: serversList } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const form = useForm<ConferenceRoomForm>({
    resolver: zodResolver(conferenceRoomFormSchema),
    defaultValues: {
      name: "",
      roomNumber: "",
      pin: "",
      adminPin: "",
      maxParticipants: 50,
      serverId: "",
      musicOnHold: "default",
      recordConference: false,
      announceJoinLeave: true,
      waitForLeader: false,
      quietMode: false,
      active: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ConferenceRoomForm) => {
      const res = await apiRequest("POST", "/api/conference-rooms", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conference-rooms"] });
      setOpen(false);
      form.reset();
      toast({
        title: "Sala criada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar sala", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ConferenceRoomForm & { id: string }) => {
      const { id, ...body } = data;
      const res = await apiRequest("PUT", `/api/conference-rooms/${id}`, body);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conference-rooms"] });
      setOpen(false);
      setEditing(null);
      form.reset();
      toast({
        title: "Sala atualizada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar sala", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/conference-rooms/${id}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conference-rooms"] });
      setDeleteTarget(null);
      toast({
        title: "Sala removida com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover sala", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: ConferenceRoomForm) => {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (room: ConferenceRoom) => {
    setEditing(room);
    form.reset({
      name: room.name,
      roomNumber: room.roomNumber,
      pin: room.pin || "",
      adminPin: room.adminPin || "",
      maxParticipants: room.maxParticipants || 0,
      serverId: room.serverId,
      musicOnHold: room.musicOnHold || "default",
      recordConference: room.recordConference,
      announceJoinLeave: room.announceJoinLeave,
      waitForLeader: room.waitForLeader,
      quietMode: room.quietMode,
      active: room.active,
    });
    setOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.reset({
      name: "",
      roomNumber: "",
      pin: "",
      adminPin: "",
      maxParticipants: 0,
      serverId: serversList?.[0]?.id || "",
      musicOnHold: "default",
      recordConference: false,
      announceJoinLeave: false,
      waitForLeader: false,
      quietMode: false,
      active: true,
    });
    setOpen(true);
  };

  const getServerName = (serverId: string) => {
    return serversList?.find((s) => s.id === serverId)?.name || serverId;
  };

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="page-conference-rooms-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-conference-rooms">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Salas de Conferência</h1>
          <p className="text-sm text-muted-foreground">Gerencie salas de conferência ConfBridge</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { queryClient.invalidateQueries({ queryKey: ["/api/conference-rooms"] }); }} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} data-testid="button-add-conference-room">
                <Plus className="w-4 h-4 mr-2" /> Nova Sala
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Sala de Conferência" : "Nova Sala de Conferência"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl><Input {...field} placeholder="Sala Principal" data-testid="input-conference-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="roomNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número da Sala</FormLabel>
                      <FormControl><Input {...field} placeholder="800" data-testid="input-conference-number" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="pin" render={({ field }) => (
                    <FormItem>
                      <FormLabel>PIN</FormLabel>
                      <FormControl><Input {...field} placeholder="1234" data-testid="input-conference-pin" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="adminPin" render={({ field }) => (
                    <FormItem>
                      <FormLabel>PIN Admin</FormLabel>
                      <FormControl><Input {...field} placeholder="5678" data-testid="input-conference-admin-pin" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="maxParticipants" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Participantes</FormLabel>
                      <FormControl><Input type="number" {...field} placeholder="10" data-testid="input-conference-max-participants" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="serverId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Servidor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-conference-server">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
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
                <FormField control={form.control} name="musicOnHold" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Música de Espera</FormLabel>
                    <FormControl><Input {...field} placeholder="default" data-testid="input-conference-moh" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="space-y-3">
                  <FormLabel>Opções</FormLabel>
                  <FormField control={form.control} name="recordConference" render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-conference-record"
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Gravar Conferência</FormLabel>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="announceJoinLeave" render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-conference-announce"
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Anunciar Entrada/Saída</FormLabel>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="waitForLeader" render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-conference-wait-leader"
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Aguardar Líder</FormLabel>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="quietMode" render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-conference-quiet"
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Modo Silencioso</FormLabel>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="active" render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-conference-active"
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Ativa</FormLabel>
                    </FormItem>
                  )} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-conference-cancel">
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-conference-submit"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {editing ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {!rooms || rooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Phone className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-sm">Nenhuma sala de conferência cadastrada</p>
            <Button variant="outline" className="mt-4" onClick={openCreate} data-testid="button-add-conference-room-empty">
              <Plus className="w-4 h-4 mr-2" /> Criar Sala
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>Participantes Máx</TableHead>
                  <TableHead>Gravação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Servidor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <TableRow key={room.id} data-testid={`row-conference-${room.id}`}>
                    <TableCell className="font-medium" data-testid={`text-conference-name-${room.id}`}>
                      {room.name}
                    </TableCell>
                    <TableCell data-testid={`text-conference-number-${room.id}`}>
                      {room.roomNumber}
                    </TableCell>
                    <TableCell data-testid={`text-conference-pin-${room.id}`}>
                      {room.pin || "—"}
                    </TableCell>
                    <TableCell data-testid={`text-conference-max-${room.id}`}>
                      {room.maxParticipants || "—"}
                    </TableCell>
                    <TableCell data-testid={`text-conference-record-${room.id}`}>
                      {room.recordConference ? (
                        <Badge variant="secondary" className="text-xs">Sim</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Não</span>
                      )}
                    </TableCell>
                    <TableCell data-testid={`badge-conference-status-${room.id}`}>
                      {room.active ? (
                        <Badge variant="default" className="text-xs">Ativa</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Inativa</Badge>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-conference-server-${room.id}`}>
                      {getServerName(room.serverId)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(room)}
                          data-testid={`button-edit-conference-${room.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(room)}
                            data-testid={`button-delete-conference-${room.id}`}
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
              Tem certeza que deseja remover a sala de conferência "{deleteTarget?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-conference">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete-conference"
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
