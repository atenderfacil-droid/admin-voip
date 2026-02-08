import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Music,
  Play,
  Pause,
  Download,
  Trash2,
  Server,
  RefreshCw,
  Loader2,
  AlertTriangle,
  HardDrive,
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

interface MohFile {
  fileName: string;
  filePath: string;
  size: number;
  date: string;
  mohClass: string;
  extension: string;
}

interface MohResponse {
  files: MohFile[];
  classes: string[];
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

export default function MusicOnHold() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedServer, setSelectedServer] = useState("");
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MohFile | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: servers } = useQuery<ServerInfo[]>({
    queryKey: ["/api/servers"],
  });

  const sshServers = servers?.filter((s) => s.sshEnabled) || [];
  const selectedServerInfo = sshServers.find((s) => s.id === selectedServer);

  const { data: mohData, isLoading: isLoadingMoh, refetch } = useQuery<MohResponse>({
    queryKey: ["/api/servers", selectedServer, "moh"],
    enabled: !!selectedServer,
  });

  const files = mohData?.files || [];
  const classes = mohData?.classes || [];

  const deleteMutation = useMutation({
    mutationFn: async (filePath: string) => {
      await apiRequest("DELETE", `/api/servers/${selectedServer}/moh?file=${encodeURIComponent(filePath)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers", selectedServer, "moh"] });
      setDeleteTarget(null);
      toast({ title: "Arquivo excluído com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir arquivo", description: error.message, variant: "destructive" });
    },
  });

  const handlePlay = (file: MohFile) => {
    if (playingFile === file.filePath) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingFile(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(
      `/api/servers/${selectedServer}/moh/download?file=${encodeURIComponent(file.filePath)}`
    );
    audio.play().catch(() => {
      toast({ title: "Erro ao reproduzir áudio", variant: "destructive" });
      setPlayingFile(null);
    });
    audio.onended = () => {
      setPlayingFile(null);
      audioRef.current = null;
    };
    audioRef.current = audio;
    setPlayingFile(file.filePath);
  };

  const handleDownload = (file: MohFile) => {
    const url = `/api/servers/${selectedServer}/moh/download?file=${encodeURIComponent(file.filePath)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleServerChange = (value: string) => {
    setSelectedServer(value);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingFile(null);
  };

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const canDeleteFile = (file: MohFile): boolean => {
    const isDefaultFile = file.mohClass === "default" || file.mohClass === "Default" ||
      (!file.filePath.includes("/custom/") && !file.filePath.includes("/uploaded/"));
    if (isDefaultFile) {
      return isSuperAdmin;
    }
    return isAdmin;
  };

  if (!servers) {
    return (
      <div className="space-y-6" data-testid="page-music-on-hold">
        <Skeleton className="h-8 w-64" />
        <div className="flex items-center gap-3 flex-wrap">
          <Skeleton className="h-9 w-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-music-on-hold">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Music on Hold</h1>
        <p className="text-sm text-muted-foreground">
          Gerenciar músicas de espera dos servidores Asterisk
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
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
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
                <h3 className="text-sm font-semibold">Selecione um Servidor</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Escolha um servidor com SSH habilitado para listar os arquivos de música de espera.
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
                <h3 className="text-sm font-semibold">SSH Não Configurado</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum servidor possui SSH habilitado. Configure o SSH nas configurações do servidor para acessar os arquivos de música de espera.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isLoadingMoh ? (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-md bg-muted">
                <Music className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Nenhum Arquivo Encontrado</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum arquivo de música de espera encontrado neste servidor.
                  {selectedServerInfo && ` Servidor: ${selectedServerInfo.name}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {classes.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap" data-testid="moh-classes">
              <span className="text-sm text-muted-foreground">Classes:</span>
              {classes.map((cls) => (
                <Badge key={cls} variant="secondary" data-testid={`badge-class-${cls}`}>
                  {cls}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground" data-testid="text-total-files">
              {files.length} arquivo(s) encontrado(s)
              {selectedServerInfo && ` — ${selectedServerInfo.name}`}
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Classe</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Formato</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((file, index) => (
                      <TableRow key={file.filePath} data-testid={`row-moh-${index}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Music className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate max-w-[300px]" data-testid={`text-filename-${index}`}>
                              {file.fileName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" data-testid={`text-class-${index}`}>
                            {file.mohClass}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground" data-testid={`text-date-${index}`}>
                          {formatDate(file.date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground" data-testid={`text-size-${index}`}>
                          {formatFileSize(file.size)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {file.extension}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePlay(file)}
                              data-testid={`button-play-${index}`}
                            >
                              {playingFile === file.filePath ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(file)}
                              data-testid={`button-download-${index}`}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            {canDeleteFile(file) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(file)}
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
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o arquivo{" "}
              <strong>{deleteTarget?.fileName}</strong>? Esta ação não pode ser desfeita.
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
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
