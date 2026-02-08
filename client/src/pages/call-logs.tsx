import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Search,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  ArrowRight,
  Clock,
  Filter,
  Calendar,
  Server,
  ChevronLeft,
  ChevronRight,
  Phone,
  Timer,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { CallLog, Company, Server as ServerType } from "@shared/schema";

const dispositionConfig: Record<string, { icon: any; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  "ANSWERED": { icon: PhoneCall, label: "Atendida", variant: "default" },
  "NO ANSWER": { icon: PhoneMissed, label: "Não Atendida", variant: "destructive" },
  "BUSY": { icon: PhoneOff, label: "Ocupado", variant: "secondary" },
  "FAILED": { icon: PhoneOff, label: "Falha", variant: "destructive" },
  "CONGESTION": { icon: PhoneOff, label: "Congestionamento", variant: "secondary" },
};

const PAGE_SIZE = 50;

export default function CallLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dispositionFilter, setDispositionFilter] = useState("all");
  const [serverFilter, setServerFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);

  const queryParams = new URLSearchParams();
  queryParams.set("limit", String(PAGE_SIZE));
  queryParams.set("offset", String(page * PAGE_SIZE));
  if (searchTerm) queryParams.set("search", searchTerm);
  if (dispositionFilter !== "all") queryParams.set("disposition", dispositionFilter);
  if (serverFilter !== "all") queryParams.set("serverId", serverFilter);
  if (startDate) queryParams.set("startDate", new Date(startDate).toISOString());
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    queryParams.set("endDate", end.toISOString());
  }

  const { data, isLoading } = useQuery<{ logs: CallLog[]; total: number }>({
    queryKey: ["/api/call-logs", queryParams.toString()],
    queryFn: () => fetch(`/api/call-logs?${queryParams.toString()}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: servers } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const calls = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const getCompanyName = (id: string) => companies?.find((c) => c.id === id)?.name || "—";
  const getServerName = (id: string) => servers?.find((s) => s.id === id)?.name || "—";

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const formatDateTime = (date: string | Date | null) => {
    if (!date) return "—";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  const formatTime = (date: string | Date | null) => {
    if (!date) return "—";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  const totalAnswered = dispositionFilter === "all" ? calls.filter((c) => c.disposition === "ANSWERED").length : 0;
  const totalNoAnswer = dispositionFilter === "all" ? calls.filter((c) => c.disposition === "NO ANSWER").length : 0;
  const totalBillsec = calls.reduce((acc, c) => acc + c.billsec, 0);

  const handleSearch = () => {
    setPage(0);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-testid="page-call-logs">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Registro de Chamadas (CDR)</h1>
        <p className="text-sm text-muted-foreground">
          Registros reais capturados via AMI - Total: {total} registro(s)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-emerald-500/10">
                <PhoneCall className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">Atendidas (página)</span>
                <p className="text-lg font-bold" data-testid="stat-answered">{totalAnswered}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-red-500/10">
                <PhoneMissed className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">Não Atendidas (página)</span>
                <p className="text-lg font-bold" data-testid="stat-noanswer">{totalNoAnswer}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10">
                <Timer className="w-4 h-4 text-primary" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">Tempo Falado (página)</span>
                <p className="text-lg font-bold" data-testid="stat-billsec">
                  {formatDuration(totalBillsec)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar origem, destino, CallerID..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            className="pl-9"
            data-testid="input-search-calls"
          />
        </div>
        <Select value={dispositionFilter} onValueChange={(v) => { setDispositionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-44" data-testid="select-disposition-filter">
            <Filter className="w-3 h-3 mr-2" />
            <SelectValue placeholder="Disposition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="ANSWERED">Atendida</SelectItem>
            <SelectItem value="NO ANSWER">Não Atendida</SelectItem>
            <SelectItem value="BUSY">Ocupado</SelectItem>
            <SelectItem value="FAILED">Falha</SelectItem>
            <SelectItem value="CONGESTION">Congestionamento</SelectItem>
          </SelectContent>
        </Select>
        {servers && servers.length > 0 && (
          <Select value={serverFilter} onValueChange={(v) => { setServerFilter(v); setPage(0); }}>
            <SelectTrigger className="w-48" data-testid="select-server-filter">
              <Server className="w-3 h-3 mr-2" />
              <SelectValue placeholder="Servidor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Servidores</SelectItem>
              {servers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
            className="w-36"
            data-testid="input-start-date"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
            className="w-36"
            data-testid="input-end-date"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Data/Hora</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Origem</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Destino</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Disposition</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Duração</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Billsec</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Servidor</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Canal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {calls.map((call) => {
                  const dConfig = dispositionConfig[call.disposition] || dispositionConfig["FAILED"];
                  const DispoIcon = dConfig.icon;
                  return (
                    <tr key={call.id} className="hover-elevate" data-testid={`row-call-${call.id}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs">{formatDate(call.callDate)}</div>
                        <div className="text-[11px] text-muted-foreground">{formatTime(call.callDate)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium">{call.source || "—"}</div>
                        {call.clid && call.clid !== call.source && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-[150px]">{call.clid}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium">{call.destination}</span>
                        {call.dcontext && (
                          <div className="text-[11px] text-muted-foreground">@{call.dcontext}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={dConfig.variant} className="text-[10px] gap-1">
                          <DispoIcon className="w-3 h-3" />
                          {dConfig.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {formatDuration(call.duration)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {call.billsec > 0 ? formatDuration(call.billsec) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{getServerName(call.serverId)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[11px] text-muted-foreground truncate max-w-[180px]" title={call.channel || ""}>
                          {call.channel || "—"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {calls.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p>Nenhum registro de chamada encontrado</p>
              <p className="text-xs mt-1">Os registros são capturados automaticamente via AMI (Event: Cdr)</p>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page + 1} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
              data-testid="button-next-page"
            >
              Próxima
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
