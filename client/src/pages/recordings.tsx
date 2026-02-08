import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  FileAudio,
  Play,
  Pause,
  Download,
  Trash2,
  Search,
  Server,
  Calendar,
  RefreshCw,
  HardDrive,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface Recording {
  fileName: string;
  filePath: string;
  size: number;
  date: string;
  extension: string;
}

interface RecordingsResponse {
  recordings: Recording[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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

export default function Recordings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedServer, setSelectedServer] = useState("");
  const [date, setDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recording | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const limit = 50;

  const { data: servers } = useQuery<ServerInfo[]>({
    queryKey: ["/api/servers"],
  });

  const sshServers = servers?.filter((s) => s.sshEnabled) || [];

  const selectedServerInfo = sshServers.find((s) => s.id === selectedServer);

  const queryParams = new URLSearchParams();
  if (date) queryParams.set("date", date);
  if (searchTerm) queryParams.set("search", searchTerm);
  queryParams.set("page", String(page));
  queryParams.set("limit", String(limit));

  const { data: recordingsData, isLoading: isLoadingRecordings, refetch } = useQuery<RecordingsResponse>({
    queryKey: ["/api/servers", selectedServer, "recordings", queryParams.toString()],
    queryFn: () =>
      fetch(`/api/servers/${selectedServer}/recordings?${queryParams.toString()}`, {
        credentials: "include",
      }).then((r) => {
        if (!r.ok) throw new Error("Erro ao buscar gravações");
        return r.json();
      }),
    enabled: !!selectedServer,
  });

  const recordings = recordingsData?.recordings || [];
  const total = recordingsData?.total || 0;
  const totalPages = recordingsData?.totalPages || 0;

  const deleteMutation = useMutation({
    mutationFn: async (filePath: string) => {
      await apiRequest("DELETE", `/api/servers/${selectedServer}/recordings?file=${encodeURIComponent(filePath)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers", selectedServer, "recordings"] });
      setDeleteTarget(null);
      toast({ title: "Gravação excluída com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir gravação", description: error.message, variant: "destructive" });
    },
  });

  const handlePlay = (recording: Recording) => {
    if (playingFile === recording.filePath) {
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
      `/api/servers/${selectedServer}/recordings/download?file=${encodeURIComponent(recording.filePath)}`
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
    setPlayingFile(recording.filePath);
  };

  const handleDownload = (recording: Recording) => {
    const url = `/api/servers/${selectedServer}/recordings/download?file=${encodeURIComponent(recording.filePath)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = recording.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleServerChange = (value: string) => {
    setSelectedServer(value);
    setPage(1);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingFile(null);
  };

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  if (!servers) {
    return (
      <div className="space-y-6" data-testid="page-recordings">
        <Skeleton className="h-8 w-64" />
        <div className="flex items-center gap-3 flex-wrap">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-64" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-recordings">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Gravações de Chamadas</h1>
        <p className="text-sm text-muted-foreground">
          Ouça e gerencie gravações de chamadas dos servidores Asterisk via SSH
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

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); setPage(1); }}
            className="w-40"
            data-testid="input-date-filter"
          />
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do arquivo..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="pl-9"
            data-testid="input-search-recordings"
          />
        </div>

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
                  Escolha um servidor com SSH habilitado para listar as gravações disponíveis.
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
                  Nenhum servidor possui SSH habilitado. Configure o SSH nas configurações do servidor para acessar as gravações.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isLoadingRecordings ? (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-0">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : recordings.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-md bg-muted">
                <FileAudio className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Nenhuma Gravação Encontrada</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhuma gravação encontrada para os filtros selecionados.
                  {selectedServerInfo && ` Servidor: ${selectedServerInfo.name}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground" data-testid="text-total-recordings">
              {total} gravação(ões) encontrada(s)
              {selectedServerInfo && ` — ${selectedServerInfo.name}`}
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome do Arquivo</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Formato</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordings.map((rec, index) => (
                      <TableRow key={rec.filePath} data-testid={`row-recording-${index}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileAudio className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate max-w-[300px]" data-testid={`text-filename-${index}`}>
                              {rec.fileName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground" data-testid={`text-date-${index}`}>
                          {formatDate(rec.date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground" data-testid={`text-size-${index}`}>
                          {formatFileSize(rec.size)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {rec.extension}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePlay(rec)}
                              data-testid={`button-play-${index}`}
                            >
                              {playingFile === rec.filePath ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(rec)}
                              data-testid={`button-download-${index}`}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(rec)}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Página {page} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a gravação{" "}
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
