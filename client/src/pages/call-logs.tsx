import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Search,
  PhoneCall,
  PhoneOff,
  PhoneForwarded,
  PhoneIncoming,
  PhoneOutgoing,
  ArrowUpRight,
  Clock,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { CallLog, Company } from "@shared/schema";

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  answered: { icon: PhoneCall, color: "text-emerald-500", label: "Atendida" },
  missed: { icon: PhoneOff, color: "text-red-500", label: "Perdida" },
  forwarded: { icon: PhoneForwarded, color: "text-amber-500", label: "Encaminhada" },
  busy: { icon: PhoneOff, color: "text-amber-500", label: "Ocupado" },
  failed: { icon: PhoneOff, color: "text-red-500", label: "Falha" },
};

const typeConfig: Record<string, { icon: any; label: string }> = {
  inbound: { icon: PhoneIncoming, label: "Entrada" },
  outbound: { icon: PhoneOutgoing, label: "Saída" },
  internal: { icon: PhoneCall, label: "Interna" },
};

export default function CallLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: calls, isLoading } = useQuery<CallLog[]>({
    queryKey: ["/api/call-logs"],
  });
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const getCompanyName = (id: string) => companies?.find((c) => c.id === id)?.name || "—";

  const filtered = calls?.filter((call) => {
    const matchSearch = call.source.includes(searchTerm) || call.destination.includes(searchTerm);
    const matchStatus = statusFilter === "all" || call.status === statusFilter;
    const matchType = typeFilter === "all" || call.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const totalAnswered = calls?.filter((c) => c.status === "answered").length || 0;
  const totalMissed = calls?.filter((c) => c.status === "missed").length || 0;
  const totalDuration = calls?.reduce((acc, c) => acc + c.duration, 0) || 0;

  return (
    <div className="space-y-6" data-testid="page-call-logs">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Registro de Chamadas</h1>
        <p className="text-sm text-muted-foreground">Histórico detalhado de todas as chamadas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-emerald-500/10">
                <PhoneCall className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">Atendidas</span>
                <p className="text-lg font-bold" data-testid="stat-answered">{totalAnswered}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-red-500/10">
                <PhoneOff className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">Perdidas</span>
                <p className="text-lg font-bold" data-testid="stat-missed">{totalMissed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">Duração Total</span>
                <p className="text-lg font-bold" data-testid="stat-duration">
                  {Math.floor(totalDuration / 3600)}h {Math.floor((totalDuration % 3600) / 60)}m
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-calls"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <Filter className="w-3 h-3 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="answered">Atendidas</SelectItem>
            <SelectItem value="missed">Perdidas</SelectItem>
            <SelectItem value="forwarded">Encaminhadas</SelectItem>
            <SelectItem value="busy">Ocupado</SelectItem>
            <SelectItem value="failed">Falha</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40" data-testid="select-type-filter">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="inbound">Entrada</SelectItem>
            <SelectItem value="outbound">Saída</SelectItem>
            <SelectItem value="internal">Interna</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered?.map((call) => {
              const sConfig = statusConfig[call.status] || statusConfig.answered;
              const tConfig = typeConfig[call.type] || typeConfig.internal;
              const StatusIcon = sConfig.icon;
              const TypeIcon = tConfig.icon;
              return (
                <div key={call.id} className="flex items-center gap-4 px-5 py-3 hover-elevate" data-testid={`row-call-${call.id}`}>
                  <StatusIcon className={`w-4 h-4 flex-shrink-0 ${sConfig.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{call.source}</span>
                      <ArrowUpRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{call.destination}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{getCompanyName(call.companyId)}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant="outline" className="text-[10px]">
                      <TypeIcon className="w-3 h-3 mr-1" /> {tConfig.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">{formatDuration(call.duration)}</span>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">{formatDate(call.callDate as unknown as string)}</p>
                      <p className="text-[10px] text-muted-foreground">{formatTime(call.callDate as unknown as string)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {(!filtered || filtered.length === 0) && (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p>Nenhuma chamada encontrada</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
