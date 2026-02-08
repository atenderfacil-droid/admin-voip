import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Phone,
  PhoneOff,
  Radio,
  Server,
  Clock,
  User,
  Hash,
  ArrowRight,
  Mic,
  MicOff,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface OnlineCall {
  channel: string;
  callerIdNum: string;
  callerIdName: string;
  extension: string;
  context: string;
  state: string;
  application: string;
  data: string;
  duration: string;
  bridgedChannel: string;
  uniqueId: string;
  serverId: string;
  serverName: string;
}

const stateConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  Up: { label: "Em Chamada", variant: "default" },
  Ring: { label: "Tocando", variant: "secondary" },
  Ringing: { label: "Tocando", variant: "secondary" },
  Down: { label: "Desligado", variant: "destructive" },
  Busy: { label: "Ocupado", variant: "destructive" },
  "Dialing": { label: "Discando", variant: "secondary" },
  "Pre-ring": { label: "Pré-toque", variant: "outline" },
};

function formatDuration(seconds: string | number): string {
  const s = typeof seconds === "string" ? parseInt(seconds, 10) : seconds;
  if (isNaN(s) || s <= 0) return "00:00:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function getCallDirection(channel: string, application: string): "inbound" | "outbound" | "internal" {
  const appLower = application.toLowerCase();
  if (appLower.includes("dial") || appLower.includes("queue")) {
    if (channel.toLowerCase().includes("trunk") || channel.toLowerCase().includes("dahdi")) {
      return "inbound";
    }
    return "outbound";
  }
  return "internal";
}

export default function OnlineCalls() {
  const { toast } = useToast();
  const [massHangupOpen, setMassHangupOpen] = useState(false);
  const [hangupPattern, setHangupPattern] = useState("");
  const [hangupServerId, setHangupServerId] = useState("");

  const { data: calls, isLoading } = useQuery<OnlineCall[]>({
    queryKey: ["/api/online-calls"],
    refetchInterval: 5000,
  });

  const hangupMutation = useMutation({
    mutationFn: async ({ serverId, channel }: { serverId: string; channel: string }) => {
      const res = await apiRequest("POST", `/api/servers/${serverId}/ami/hangup`, { channel });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Canal encerrado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/online-calls"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao encerrar canal", description: err.message, variant: "destructive" });
    },
  });

  const massHangupMutation = useMutation({
    mutationFn: async ({ serverId, pattern }: { serverId: string; pattern: string }) => {
      const res = await apiRequest("POST", `/api/servers/${serverId}/ami/hangup-multiple`, { pattern });
      return res.json();
    },
    onSuccess: (data) => {
      const count = data.results?.length || 0;
      toast({ title: `${count} canais encerrados` });
      setMassHangupOpen(false);
      setHangupPattern("");
      queryClient.invalidateQueries({ queryKey: ["/api/online-calls"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro no hangup em massa", description: err.message, variant: "destructive" });
    },
  });

  const mixMonitorMutation = useMutation({
    mutationFn: async ({ serverId, channel, file, options }: { serverId: string; channel: string; file: string; options?: string }) => {
      const res = await apiRequest("POST", `/api/servers/${serverId}/ami/mixmonitor`, { channel, file, options });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Gravação iniciada" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao iniciar gravação", description: err.message, variant: "destructive" });
    },
  });

  const stopMixMonitorMutation = useMutation({
    mutationFn: async ({ serverId, channel }: { serverId: string; channel: string }) => {
      const res = await apiRequest("POST", `/api/servers/${serverId}/ami/stopmixmonitor`, { channel });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Gravação encerrada" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao parar gravação", description: err.message, variant: "destructive" });
    },
  });

  const activeCalls = calls || [];
  const serverGroups = activeCalls.reduce((acc, call) => {
    if (!acc[call.serverName]) acc[call.serverName] = [];
    acc[call.serverName].push(call);
    return acc;
  }, {} as Record<string, OnlineCall[]>);

  const serverIds = activeCalls.reduce((acc, call) => {
    if (!acc[call.serverName]) acc[call.serverName] = call.serverId;
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="p-6 space-y-6 max-w-full overflow-hidden">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Chamadas Online</h1>
          <p className="text-sm text-muted-foreground">Monitoramento em tempo real das chamadas ativas nos servidores</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center w-3 h-3">
              <div className="absolute w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-40" />
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <span className="text-xs text-muted-foreground">Ao vivo</span>
          </div>
          <Badge variant="outline" className="text-xs" data-testid="badge-total-calls">
            <PhoneCall className="w-3 h-3 mr-1" />
            {activeCalls.length} {activeCalls.length === 1 ? "chamada" : "chamadas"}
          </Badge>
          {activeCalls.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setMassHangupOpen(true)}
              data-testid="button-mass-hangup"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Hangup em Massa
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!isLoading && activeCalls.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Phone className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-sm font-medium mb-1" data-testid="text-no-calls">Nenhuma chamada ativa</h3>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Quando houver chamadas passando pelos servidores, elas aparecerão aqui em tempo real.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <div className="relative flex items-center justify-center w-2.5 h-2.5">
                <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-40" />
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
              <span className="text-[11px] text-muted-foreground">Monitorando a cada 5 segundos</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && activeCalls.length > 0 && (
        <div className="space-y-4">
          {Object.entries(serverGroups).map(([serverName, serverCalls]) => (
            <Card key={serverName}>
              <CardContent className="p-0">
                <div className="flex items-center gap-2 px-4 py-3 border-b">
                  <Server className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium" data-testid={`text-server-name-${serverName}`}>{serverName}</span>
                  <Badge variant="secondary" className="text-[10px] ml-auto">
                    {serverCalls.length} {serverCalls.length === 1 ? "canal" : "canais"}
                  </Badge>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead></TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead>Aplicação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serverCalls.map((call) => {
                        const direction = getCallDirection(call.channel, call.application);
                        const stateInfo = stateConfig[call.state] || { label: call.state || "Desconhecido", variant: "outline" as const };
                        const DirectionIcon = direction === "inbound" ? PhoneIncoming : direction === "outbound" ? PhoneOutgoing : PhoneCall;
                        return (
                          <TableRow key={call.uniqueId} data-testid={`row-call-${call.uniqueId}`}>
                            <TableCell>
                              <DirectionIcon className={`w-4 h-4 ${direction === "inbound" ? "text-blue-500" : direction === "outbound" ? "text-emerald-500" : "text-muted-foreground"}`} />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <User className="w-3 h-3 text-muted-foreground shrink-0" />
                                <div>
                                  <span className="text-sm font-medium" data-testid={`text-caller-${call.uniqueId}`}>{call.callerIdNum || "—"}</span>
                                  {call.callerIdName && call.callerIdName !== call.callerIdNum && (
                                    <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{call.callerIdName}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Hash className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="text-sm" data-testid={`text-dest-${call.uniqueId}`}>{call.extension || call.data || "—"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={stateInfo.variant} className="text-[10px]" data-testid={`badge-state-${call.uniqueId}`}>
                                <Radio className="w-3 h-3 mr-1" />
                                {stateInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="text-xs font-mono" data-testid={`text-duration-${call.uniqueId}`}>{formatDuration(call.duration)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[200px] block">{call.channel}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-[11px] text-muted-foreground truncate max-w-[150px] block">{call.application}{call.data ? `(${call.data})` : ""}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const filename = `${call.callerIdNum || "unknown"}_${Date.now()}.wav`;
                                    mixMonitorMutation.mutate({
                                      serverId: call.serverId,
                                      channel: call.channel,
                                      file: `/var/spool/asterisk/monitor/${filename}`,
                                      options: "r",
                                    });
                                  }}
                                  title="Gravar chamada (MixMonitor)"
                                  data-testid={`button-record-${call.uniqueId}`}
                                >
                                  <Mic className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => stopMixMonitorMutation.mutate({ serverId: call.serverId, channel: call.channel })}
                                  title="Parar gravação"
                                  data-testid={`button-stop-record-${call.uniqueId}`}
                                >
                                  <MicOff className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => hangupMutation.mutate({ serverId: call.serverId, channel: call.channel })}
                                  title="Encerrar chamada"
                                  data-testid={`button-hangup-${call.uniqueId}`}
                                >
                                  <PhoneOff className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={massHangupOpen} onOpenChange={setMassHangupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hangup em Massa</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Encerre todos os canais que correspondem a um padrão regex. Exemplo: <code className="text-xs bg-muted px-1 py-0.5 rounded">PJSIP/100.*</code> encerra todos os canais do ramal 100.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Servidor</label>
              <select
                className="w-full mt-1 px-3 py-2 text-sm rounded-md border bg-background"
                value={hangupServerId}
                onChange={(e) => setHangupServerId(e.target.value)}
                data-testid="select-hangup-server"
              >
                <option value="">Selecione um servidor</option>
                {Object.entries(serverIds).map(([name, id]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Padrão (Regex)</label>
              <Input
                placeholder="PJSIP/.*|SIP/trunk.*"
                value={hangupPattern}
                onChange={(e) => setHangupPattern(e.target.value)}
                data-testid="input-hangup-pattern"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMassHangupOpen(false)} data-testid="button-cancel-mass-hangup">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (hangupServerId && hangupPattern) {
                  massHangupMutation.mutate({ serverId: hangupServerId, pattern: hangupPattern });
                }
              }}
              disabled={!hangupServerId || !hangupPattern || massHangupMutation.isPending}
              data-testid="button-confirm-mass-hangup"
            >
              {massHangupMutation.isPending ? "Encerrando..." : "Encerrar Canais"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
