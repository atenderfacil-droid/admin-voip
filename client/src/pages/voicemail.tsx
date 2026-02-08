import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Voicemail,
  Play,
  Pause,
  Trash2,
  Server,
  RefreshCw,
  Loader2,
  Download,
  Mail,
  Phone,
  Clock,
  User,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface ServerInfo {
  id: string;
  name: string;
  amiEnabled: boolean;
  sshEnabled: boolean;
  ipAddress: string;
}

interface VoicemailUser {
  mailbox: string;
  context: string;
  email: string;
  fullName: string;
  newMessages: number;
  oldMessages: number;
}

interface VoicemailMessage {
  context: string;
  mailbox: string;
  folder: string;
  callerid: string;
  origtime: number;
  duration: number;
  msgnum: number;
  txtFile: string;
  wavFile: string;
}

interface VoicemailMessagesResponse {
  messages: VoicemailMessage[];
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatUnixTimestamp(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

export default function VoicemailPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedServer, setSelectedServer] = useState("");
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VoicemailMessage | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: servers } = useQuery<ServerInfo[]>({
    queryKey: ["/api/servers"],
  });

  const eligibleServers = servers?.filter((s) => s.amiEnabled || s.sshEnabled) || [];
  const selectedServerInfo = eligibleServers.find((s) => s.id === selectedServer);

  const {
    data: voicemailUsers,
    isLoading: isLoadingUsers,
    refetch: refetchUsers,
  } = useQuery<VoicemailUser[]>({
    queryKey: ["/api/servers", selectedServer, "ami", "voicemail-list"],
    enabled: !!selectedServer,
  });

  const {
    data: messagesData,
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
  } = useQuery<VoicemailMessagesResponse>({
    queryKey: ["/api/servers", selectedServer, "voicemail-messages"],
    enabled: !!selectedServer,
  });

  const messages = messagesData?.messages || [];

  const deleteMutation = useMutation({
    mutationFn: async (filePath: string) => {
      await apiRequest(
        "DELETE",
        `/api/servers/${selectedServer}/voicemail-messages?file=${encodeURIComponent(filePath)}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/servers", selectedServer, "voicemail-messages"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/servers", selectedServer, "ami", "voicemail-list"],
      });
      setDeleteTarget(null);
      toast({ title: "Mensagem de voz excluída com sucesso" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir mensagem de voz",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePlay = (msg: VoicemailMessage) => {
    if (playingFile === msg.wavFile) {
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
      `/api/servers/${selectedServer}/voicemail-messages/download?file=${encodeURIComponent(msg.wavFile)}`
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
    setPlayingFile(msg.wavFile);
  };

  const handleDownload = (msg: VoicemailMessage) => {
    const url = `/api/servers/${selectedServer}/voicemail-messages/download?file=${encodeURIComponent(msg.wavFile)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `voicemail_${msg.mailbox}_${msg.msgnum}.wav`;
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

  const handleRefresh = () => {
    refetchUsers();
    refetchMessages();
  };

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  if (!servers) {
    return (
      <div className="space-y-6" data-testid="page-voicemail">
        <Skeleton className="h-8 w-64" />
        <div className="flex items-center gap-3 flex-wrap">
          <Skeleton className="h-9 w-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-voicemail">
      <div>
        <h1 className="text-xl font-bold tracking-tight" data-testid="text-page-title">
          Voicemail
        </h1>
        <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">
          Gerenciar mensagens de voz dos servidores Asterisk
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedServer} onValueChange={handleServerChange}>
          <SelectTrigger className="w-56" data-testid="select-server">
            <Server className="w-3 h-3 mr-2" />
            <SelectValue placeholder="Selecione um servidor" />
          </SelectTrigger>
          <SelectContent>
            {eligibleServers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Nenhum servidor configurado
              </div>
            ) : (
              eligibleServers.map((s) => (
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
            onClick={handleRefresh}
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
                  Escolha um servidor para visualizar as caixas postais e mensagens de voz.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="mailboxes" data-testid="tabs-voicemail">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="mailboxes" data-testid="tab-mailboxes">
              <Mail className="w-4 h-4 mr-2" />
              Caixas Postais
            </TabsTrigger>
            <TabsTrigger value="messages" data-testid="tab-messages">
              <Voicemail className="w-4 h-4 mr-2" />
              Mensagens
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mailboxes" className="mt-4">
            {isLoadingUsers ? (
              <Card>
                <CardContent className="p-0">
                  <div className="space-y-0">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0"
                      >
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : !voicemailUsers || voicemailUsers.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <div className="flex flex-col items-center justify-center text-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-md bg-muted">
                      <Mail className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">
                        Nenhuma Caixa Postal Encontrada
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Nenhuma caixa postal configurada neste servidor.
                        {selectedServerInfo &&
                          ` Servidor: ${selectedServerInfo.name}`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="text-total-mailboxes"
                  >
                    {voicemailUsers.length} caixa(s) postal(is) encontrada(s)
                    {selectedServerInfo &&
                      ` — ${selectedServerInfo.name}`}
                  </p>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Caixa Postal</TableHead>
                            <TableHead>Contexto</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Nome Completo</TableHead>
                            <TableHead>Novas</TableHead>
                            <TableHead>Antigas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {voicemailUsers.map((vm, index) => (
                            <TableRow
                              key={`${vm.context}-${vm.mailbox}`}
                              data-testid={`row-mailbox-${index}`}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span
                                    className="text-sm font-medium"
                                    data-testid={`text-mailbox-${index}`}
                                  >
                                    {vm.mailbox}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span
                                  className="text-sm"
                                  data-testid={`text-context-${index}`}
                                >
                                  {vm.context}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span
                                  className="text-sm text-muted-foreground"
                                  data-testid={`text-email-${index}`}
                                >
                                  {vm.email || "—"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span
                                    className="text-sm"
                                    data-testid={`text-fullname-${index}`}
                                  >
                                    {vm.fullName || "—"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={vm.newMessages > 0 ? "default" : "secondary"}
                                  data-testid={`badge-new-${index}`}
                                >
                                  {vm.newMessages}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  data-testid={`badge-old-${index}`}
                                >
                                  {vm.oldMessages}
                                </Badge>
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
          </TabsContent>

          <TabsContent value="messages" className="mt-4">
            {isLoadingMessages ? (
              <Card>
                <CardContent className="p-0">
                  <div className="space-y-0">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0"
                      >
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-8 w-24" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : messages.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <div className="flex flex-col items-center justify-center text-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-md bg-muted">
                      <Voicemail className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">
                        Nenhuma Mensagem Encontrada
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Nenhuma mensagem de voz encontrada neste servidor.
                        {selectedServerInfo &&
                          ` Servidor: ${selectedServerInfo.name}`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="text-total-messages"
                  >
                    {messages.length} mensagem(ns) encontrada(s)
                    {selectedServerInfo &&
                      ` — ${selectedServerInfo.name}`}
                  </p>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Caixa Postal</TableHead>
                            <TableHead>Pasta</TableHead>
                            <TableHead>CallerID</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Duração</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {messages.map((msg, index) => (
                            <TableRow
                              key={`${msg.mailbox}-${msg.msgnum}`}
                              data-testid={`row-message-${index}`}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span
                                    className="text-sm font-medium"
                                    data-testid={`text-msg-mailbox-${index}`}
                                  >
                                    {msg.mailbox}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  data-testid={`text-msg-folder-${index}`}
                                >
                                  {msg.folder}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span
                                  className="text-sm"
                                  data-testid={`text-msg-callerid-${index}`}
                                >
                                  {msg.callerid || "—"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                                  <span
                                    className="text-sm text-muted-foreground"
                                    data-testid={`text-msg-date-${index}`}
                                  >
                                    {formatUnixTimestamp(msg.origtime)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span
                                  className="text-sm"
                                  data-testid={`text-msg-duration-${index}`}
                                >
                                  {formatDuration(msg.duration)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handlePlay(msg)}
                                    data-testid={`button-play-${index}`}
                                  >
                                    {playingFile === msg.wavFile ? (
                                      <Pause className="w-4 h-4" />
                                    ) : (
                                      <Play className="w-4 h-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDownload(msg)}
                                    data-testid={`button-download-${index}`}
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                  {isAdmin && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setDeleteTarget(msg)}
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
          </TabsContent>
        </Tabs>
      )}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent data-testid="dialog-delete-voicemail">
          <DialogHeader>
            <DialogTitle>Excluir Mensagem de Voz</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta mensagem de voz da caixa postal{" "}
              <strong>{deleteTarget?.mailbox}</strong>? Esta ação não pode ser
              desfeita.
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
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.wavFile)}
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
    </div>
  );
}
