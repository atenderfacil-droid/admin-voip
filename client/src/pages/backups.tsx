import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Database,
  Download,
  Trash2,
  Server,
  RefreshCw,
  Loader2,
  AlertTriangle,
  HardDrive,
  Upload,
  RotateCcw,
  ShieldAlert,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ServerInfo {
  id: string;
  name: string;
  sshEnabled: boolean;
  ipAddress: string;
}

interface BackupItem {
  fileName: string;
  filePath: string;
  size: number;
  date: string;
}

interface BackupsResponse {
  backups: BackupItem[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

export default function Backups() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedServer, setSelectedServer] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BackupItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupItem | null>(null);
  const [restoreConfirmStep, setRestoreConfirmStep] = useState(0);

  const { data: servers } = useQuery<ServerInfo[]>({
    queryKey: ["/api/servers"],
  });

  const sshServers = servers?.filter((s) => s.sshEnabled) || [];
  const selectedServerInfo = sshServers.find((s) => s.id === selectedServer);

  const {
    data: backupsData,
    isLoading: isLoadingBackups,
    refetch,
  } = useQuery<BackupsResponse>({
    queryKey: ["/api/servers", selectedServer, "backups"],
    queryFn: () =>
      fetch(`/api/servers/${selectedServer}/backups`, {
        credentials: "include",
      }).then((r) => {
        if (!r.ok) throw new Error("Erro ao buscar backups");
        return r.json();
      }),
    enabled: !!selectedServer,
  });

  const backups = backupsData?.backups || [];

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/servers/${selectedServer}/backup`);
      return res.json();
    },
    onSuccess: (data: { success: boolean; message: string; fileName: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers", selectedServer, "backups"] });
      toast({ title: "Backup criado com sucesso", description: data.fileName });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar backup", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (filePath: string) => {
      await apiRequest("DELETE", `/api/servers/${selectedServer}/backups?file=${encodeURIComponent(filePath)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers", selectedServer, "backups"] });
      setDeleteTarget(null);
      toast({ title: "Backup excluído com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir backup", description: error.message, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (filePath: string) => {
      const res = await apiRequest("POST", `/api/servers/${selectedServer}/backups/restore`, { file: filePath });
      return res.json();
    },
    onSuccess: (data: { success: boolean; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers", selectedServer, "backups"] });
      setRestoreTarget(null);
      setRestoreConfirmStep(0);
      toast({ title: "Backup restaurado com sucesso", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao restaurar backup", description: error.message, variant: "destructive" });
      setRestoreConfirmStep(0);
    },
  });

  const handleDownload = (backup: BackupItem) => {
    const url = `/api/servers/${selectedServer}/backups/download?file=${encodeURIComponent(backup.filePath)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = backup.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleServerChange = (value: string) => {
    setSelectedServer(value);
  };

  const handleRestoreClose = () => {
    setRestoreTarget(null);
    setRestoreConfirmStep(0);
  };

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isSuperAdmin = user?.role === "super_admin";

  if (!servers) {
    return (
      <div className="space-y-6" data-testid="page-backups">
        <Skeleton className="h-8 w-64" />
        <div className="flex items-center gap-3 flex-wrap">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-backups">
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Database className="w-5 h-5" />
          Backup & Restauração
        </h1>
        <p className="text-sm text-muted-foreground">
          Gerenciar backups das configurações do Asterisk
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedServer} onValueChange={handleServerChange}>
          <SelectTrigger className="w-56" data-testid="select-server">
            <Server className="w-3 h-3 mr-2" />
            <SelectValue placeholder="Selecione um servidor" />
          </SelectTrigger>
          <SelectContent>
            {sshServers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Nenhum servidor com SSH configurado
              </div>
            ) : (
              sshServers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.ipAddress})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {selectedServer && (
          <>
            <Button
              onClick={() => createBackupMutation.mutate()}
              disabled={createBackupMutation.isPending}
              data-testid="button-create-backup"
            >
              {createBackupMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Criar Backup
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {!selectedServer ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-md bg-muted">
                <HardDrive className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold" data-testid="text-no-server">Selecione um Servidor</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Escolha um servidor com SSH habilitado para gerenciar os backups.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : sshServers.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-md bg-amber-500/10">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold" data-testid="text-ssh-disabled">SSH Não Configurado</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum servidor possui SSH habilitado. Configure o SSH nas configurações do servidor para gerenciar backups.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isLoadingBackups ? (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : backups.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-md bg-muted">
                <Database className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold" data-testid="text-no-backups">Nenhum Backup Encontrado</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum backup encontrado para este servidor. Clique em "Criar Backup" para gerar um novo.
                  {selectedServerInfo && ` Servidor: ${selectedServerInfo.name}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup, index) => (
                  <TableRow key={backup.filePath} data-testid={`row-backup-${index}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium" data-testid={`text-filename-${index}`}>
                          {backup.fileName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground" data-testid={`text-date-${index}`}>
                        {formatDate(backup.date)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" data-testid={`text-size-${index}`}>
                        {formatFileSize(backup.size)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(backup)}
                          data-testid={`button-download-${index}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setRestoreTarget(backup);
                              setRestoreConfirmStep(1);
                            }}
                            data-testid={`button-restore-${index}`}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(backup)}
                            data-testid={`button-delete-${index}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent data-testid="dialog-delete-backup">
          <DialogHeader>
            <DialogTitle>Excluir Backup</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o backup <strong>{deleteTarget?.fileName}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              data-testid="button-cancel-delete"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.filePath)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!restoreTarget && restoreConfirmStep > 0} onOpenChange={(open) => !open && handleRestoreClose()}>
        <DialogContent data-testid="dialog-restore-backup">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              {restoreConfirmStep === 1 ? "Restaurar Backup" : "Confirmar Restauração"}
            </DialogTitle>
            <DialogDescription>
              {restoreConfirmStep === 1 ? (
                <>
                  Você está prestes a restaurar o backup <strong>{restoreTarget?.fileName}</strong>.
                </>
              ) : (
                <>
                  Esta é a confirmação final. O backup <strong>{restoreTarget?.fileName}</strong> será restaurado.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive font-medium" data-testid="text-restore-warning">
                ATENÇÃO: Esta ação irá sobrescrever todas as configurações atuais do Asterisk. Um backup automático será criado antes da restauração.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleRestoreClose}
              data-testid="button-cancel-restore"
            >
              Cancelar
            </Button>
            {restoreConfirmStep === 1 ? (
              <Button
                variant="destructive"
                onClick={() => setRestoreConfirmStep(2)}
                data-testid="button-next-restore"
              >
                <ShieldAlert className="w-4 h-4 mr-2" />
                Continuar
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => restoreTarget && restoreMutation.mutate(restoreTarget.filePath)}
                disabled={restoreMutation.isPending}
                data-testid="button-confirm-restore"
              >
                {restoreMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-2" />
                )}
                Restaurar Agora
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
