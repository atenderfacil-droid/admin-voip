import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import {
  BarChart3,
  Download,
  FileText,
  Phone,
  Clock,
  PhoneIncoming,
  Filter,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import type { Server as ServerType, CallLog } from "@shared/schema";

interface CallsSummary {
  total: number;
  answered: number;
  answerRate: number;
  avgDuration: number;
  avgBillsec: number;
  dispositionCount: Record<string, number>;
  hourlyCount: Record<string, number>;
  dailyCount: Record<string, number>;
}

const dispositionLabels: Record<string, string> = {
  ANSWERED: "Atendida",
  "NO ANSWER": "Não Atendida",
  BUSY: "Ocupado",
  FAILED: "Falha",
  CONGESTION: "Congestionamento",
};

const dispositionColors: Record<string, string> = {
  ANSWERED: "bg-emerald-500",
  "NO ANSWER": "bg-amber-500",
  BUSY: "bg-red-500",
  FAILED: "bg-red-700",
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Reports() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [serverFilter, setServerFilter] = useState("all");
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: "",
    endDate: "",
    serverId: "all",
  });

  const buildSummaryParams = () => {
    const params = new URLSearchParams();
    if (appliedFilters.serverId !== "all")
      params.set("serverId", appliedFilters.serverId);
    if (appliedFilters.startDate)
      params.set("startDate", new Date(appliedFilters.startDate).toISOString());
    if (appliedFilters.endDate) {
      const end = new Date(appliedFilters.endDate);
      end.setHours(23, 59, 59, 999);
      params.set("endDate", end.toISOString());
    }
    return params.toString();
  };

  const { data: summary, isLoading: summaryLoading } = useQuery<CallsSummary>({
    queryKey: [
      "/api/reports/calls-summary",
      appliedFilters.startDate,
      appliedFilters.endDate,
      appliedFilters.serverId,
    ],
    queryFn: () =>
      fetch(`/api/reports/calls-summary?${buildSummaryParams()}`, {
        credentials: "include",
      }).then((r) => r.json()),
  });

  const { data: servers } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const handleApply = () => {
    setAppliedFilters({
      startDate,
      endDate,
      serverId: serverFilter,
    });
  };

  const exportCSV = async () => {
    const params = new URLSearchParams();
    params.set("limit", "10000");
    params.set("offset", "0");
    if (appliedFilters.serverId !== "all")
      params.set("serverId", appliedFilters.serverId);
    if (appliedFilters.startDate)
      params.set("startDate", new Date(appliedFilters.startDate).toISOString());
    if (appliedFilters.endDate) {
      const end = new Date(appliedFilters.endDate);
      end.setHours(23, 59, 59, 999);
      params.set("endDate", end.toISOString());
    }

    const res = await fetch(`/api/call-logs?${params.toString()}`, {
      credentials: "include",
    });
    const data: { logs: CallLog[]; total: number } = await res.json();

    const headers = "Data,Origem,Destino,Duração,Tempo de Conversa,Resultado";
    const rows = data.logs.map((log) => {
      const date = log.callDate
        ? new Date(log.callDate).toLocaleString("pt-BR")
        : "";
      return `"${date}","${log.source || ""}","${log.destination || ""}","${formatDuration(log.duration)}","${formatDuration(log.billsec)}","${dispositionLabels[log.disposition] || log.disposition}"`;
    });

    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-chamadas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!summary) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATORIO DE CHAMADAS", pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, y, { align: "center" });
    y += 12;

    doc.setDrawColor(200);
    doc.line(14, y, pageWidth - 14, y);
    y += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo Geral", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total de Chamadas: ${summary.total}`, 14, y); y += 6;
    doc.text(`Chamadas Atendidas: ${summary.answered} (${summary.answerRate.toFixed(1)}%)`, 14, y); y += 6;
    doc.text(`Duracao Media: ${formatDuration(summary.avgDuration)}`, 14, y); y += 6;
    doc.text(`Tempo Medio de Conversa: ${formatDuration(summary.avgBillsec)}`, 14, y); y += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resultado das Chamadas", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    Object.entries(summary.dispositionCount).forEach(([k, v]) => {
      doc.text(`${dispositionLabels[k] || k}: ${v}`, 20, y);
      y += 6;
    });
    y += 4;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Chamadas por Hora", 14, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const hourEntries = Object.entries(summary.hourlyCount).sort(([a], [b]) => Number(a) - Number(b));
    const maxH = Math.max(...hourEntries.map(([, v]) => v), 1);
    hourEntries.forEach(([h, v]) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const barWidth = (v / maxH) * 100;
      doc.text(`${String(h).padStart(2, "0")}h: ${v}`, 20, y);
      doc.setFillColor(59, 130, 246);
      doc.rect(55, y - 3, barWidth * 0.8, 4, "F");
      y += 6;
    });
    y += 4;

    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Chamadas por Dia", 14, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    Object.entries(summary.dailyCount)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([d, v]) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${d}: ${v}`, 20, y);
        y += 6;
      });

    y += 10;
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text("Admin VOIP - Plataforma de Gerenciamento Asterisk", pageWidth / 2, y, { align: "center" });

    doc.save(`relatorio-chamadas-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const hourlyEntries = summary?.hourlyCount
    ? Object.entries(summary.hourlyCount).sort(
        ([a], [b]) => Number(a) - Number(b)
      )
    : [];
  const maxHourly = Math.max(...hourlyEntries.map(([, v]) => v), 1);

  const dispositionEntries = summary?.dispositionCount
    ? Object.entries(summary.dispositionCount).sort(([, a], [, b]) => b - a)
    : [];
  const totalDisposition = dispositionEntries.reduce(
    (acc, [, v]) => acc + v,
    0
  );

  const dailyEntries = summary?.dailyCount
    ? Object.entries(summary.dailyCount).sort(([a], [b]) => a.localeCompare(b))
    : [];
  const maxDaily = Math.max(...dailyEntries.map(([, v]) => v), 1);

  if (summaryLoading) {
    return (
      <div className="space-y-6" data-testid="page-reports">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-reports">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Análise de chamadas e métricas do sistema
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={exportCSV}
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            onClick={exportPDF}
            data-testid="button-export-pdf"
          >
            <FileText className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-40"
          data-testid="input-report-start-date"
        />
        <span className="text-xs text-muted-foreground">até</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-40"
          data-testid="input-report-end-date"
        />
        {servers && servers.length > 0 && (
          <Select
            value={serverFilter}
            onValueChange={(v) => setServerFilter(v)}
          >
            <SelectTrigger
              className="w-48"
              data-testid="select-report-server"
            >
              <Filter className="w-3 h-3 mr-2" />
              <SelectValue placeholder="Servidor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Servidores</SelectItem>
              {servers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button onClick={handleApply} data-testid="button-apply-filters">
          <Filter className="w-4 h-4 mr-2" />
          Aplicar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10">
                <Phone className="w-4 h-4 text-primary" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">
                  Total de Chamadas
                </span>
                <p
                  className="text-lg font-bold"
                  data-testid="stat-total-calls"
                >
                  {summary?.total ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-emerald-500/10">
                <PhoneIncoming className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">
                  Chamadas Atendidas
                </span>
                <p
                  className="text-lg font-bold"
                  data-testid="stat-answered-calls"
                >
                  {summary?.answered ?? 0}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({(summary?.answerRate ?? 0).toFixed(1)}%)
                  </span>
                </p>
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
                <span className="text-[11px] text-muted-foreground">
                  Duração Média
                </span>
                <p
                  className="text-lg font-bold"
                  data-testid="stat-avg-duration"
                >
                  {formatDuration(summary?.avgDuration ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">
                  Tempo Médio de Conversa
                </span>
                <p
                  className="text-lg font-bold"
                  data-testid="stat-avg-billsec"
                >
                  {formatDuration(summary?.avgBillsec ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Chamadas por Hora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-40" data-testid="chart-hourly">
              {Array.from({ length: 24 }, (_, i) => {
                const key = String(i);
                const count =
                  hourlyEntries.find(([h]) => h === key)?.[1] ?? 0;
                const pct = maxHourly > 0 ? (count / maxHourly) * 100 : 0;
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center flex-1 min-w-0"
                  >
                    {count > 0 && (
                      <span className="text-[9px] text-muted-foreground mb-1">
                        {count}
                      </span>
                    )}
                    <div
                      className="w-full bg-primary rounded-t-sm transition-all"
                      style={{
                        height: `${Math.max(pct, count > 0 ? 4 : 0)}%`,
                      }}
                    />
                    <span className="text-[8px] text-muted-foreground mt-1">
                      {String(i).padStart(2, "0")}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Resultado das Chamadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3" data-testid="chart-disposition">
              {dispositionEntries.map(([disposition, count]) => {
                const pct =
                  totalDisposition > 0
                    ? ((count / totalDisposition) * 100).toFixed(1)
                    : "0";
                const colorClass =
                  dispositionColors[disposition] || "bg-gray-400";
                return (
                  <div key={disposition} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs">
                        {dispositionLabels[disposition] || disposition}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-sm bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-sm transition-all ${colorClass}`}
                        style={{
                          width: `${totalDisposition > 0 ? (count / totalDisposition) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {dispositionEntries.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum dado disponível
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Chamadas por Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2" data-testid="chart-daily">
            {dailyEntries.map(([day, count]) => {
              const pct = maxDaily > 0 ? (count / maxDaily) * 100 : 0;
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-xs w-20 shrink-0 text-muted-foreground">
                    {day}
                  </span>
                  <div className="flex-1 h-5 rounded-sm bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-sm transition-all"
                      style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className="text-xs w-10 text-right shrink-0">
                    {count}
                  </span>
                </div>
              );
            })}
            {dailyEntries.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum dado disponível
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
