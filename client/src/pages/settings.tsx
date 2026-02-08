import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings as SettingsIcon,
  Shield,
  Bell,
  Database,
  Server,
  Globe,
  Lock,
  Mail,
  Headphones,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();

  const [platformName, setPlatformName] = useState("Admin VOIP");
  const [domain, setDomain] = useState("");
  const [defaultSipPort, setDefaultSipPort] = useState(5060);
  const [rtpStart, setRtpStart] = useState(10000);
  const [rtpEnd, setRtpEnd] = useState(20000);
  const [defaultCodec, setDefaultCodec] = useState("G.711");
  const [defaultDtmf, setDefaultDtmf] = useState("rfc2833");
  const [defaultRecording, setDefaultRecording] = useState(false);
  const [natEnabled, setNatEnabled] = useState(true);
  const [tlsSrtp, setTlsSrtp] = useState(false);
  const [blockAnonymousCalls, setBlockAnonymousCalls] = useState(true);
  const [alwaysAuthReject, setAlwaysAuthReject] = useState(true);
  const [fail2banEnabled, setFail2banEnabled] = useState(true);
  const [allowedIps, setAllowedIps] = useState("");
  const [emailServerOffline, setEmailServerOffline] = useState(true);
  const [emailTrunkDisconnected, setEmailTrunkDisconnected] = useState(true);
  const [emailHighCpu, setEmailHighCpu] = useState(true);
  const [emailMissedCalls, setEmailMissedCalls] = useState(false);
  const [autoBackup, setAutoBackup] = useState(true);
  const [logRetentionDays, setLogRetentionDays] = useState(90);

  const { data: settings, isLoading } = useQuery<{
    id: number;
    platformName: string;
    domain: string | null;
    defaultSipPort: number;
    rtpStart: number;
    rtpEnd: number;
    defaultCodec: string;
    defaultDtmf: string;
    defaultRecording: boolean;
    natEnabled: boolean;
    tlsSrtp: boolean;
    blockAnonymousCalls: boolean;
    alwaysAuthReject: boolean;
    fail2banEnabled: boolean;
    allowedIps: string | null;
    emailServerOffline: boolean;
    emailTrunkDisconnected: boolean;
    emailHighCpu: boolean;
    emailMissedCalls: boolean;
    autoBackup: boolean;
    logRetentionDays: number;
  }>({
    queryKey: ["/api/platform-settings"],
  });

  useEffect(() => {
    if (settings) {
      setPlatformName(settings.platformName);
      setDomain(settings.domain || "");
      setDefaultSipPort(settings.defaultSipPort);
      setRtpStart(settings.rtpStart);
      setRtpEnd(settings.rtpEnd);
      setDefaultCodec(settings.defaultCodec);
      setDefaultDtmf(settings.defaultDtmf);
      setDefaultRecording(settings.defaultRecording);
      setNatEnabled(settings.natEnabled);
      setTlsSrtp(settings.tlsSrtp);
      setBlockAnonymousCalls(settings.blockAnonymousCalls);
      setAlwaysAuthReject(settings.alwaysAuthReject);
      setFail2banEnabled(settings.fail2banEnabled);
      setAllowedIps(settings.allowedIps || "");
      setEmailServerOffline(settings.emailServerOffline);
      setEmailTrunkDisconnected(settings.emailTrunkDisconnected);
      setEmailHighCpu(settings.emailHighCpu);
      setEmailMissedCalls(settings.emailMissedCalls);
      setAutoBackup(settings.autoBackup);
      setLogRetentionDays(settings.logRetentionDays);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/platform-settings", {
        platformName,
        domain: domain || null,
        defaultSipPort,
        rtpStart,
        rtpEnd,
        defaultCodec,
        defaultDtmf,
        defaultRecording,
        natEnabled,
        tlsSrtp,
        blockAnonymousCalls,
        alwaysAuthReject,
        fail2banEnabled,
        allowedIps: allowedIps || null,
        emailServerOffline,
        emailTrunkDisconnected,
        emailHighCpu,
        emailMissedCalls,
        autoBackup,
        logRetentionDays,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-settings"] });
      toast({ title: "Configurações salvas com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar configurações", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="page-settings">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground">Configurações gerais da plataforma Admin VOIP</p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-settings">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Configurações gerais da plataforma Admin VOIP</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList data-testid="tabs-settings">
          <TabsTrigger value="general">
            <SettingsIcon className="w-4 h-4 mr-2" /> Geral
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 mr-2" /> Segurança
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" /> Notificações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Headphones className="w-4 h-4" /> Informações da Plataforma
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Nome da Plataforma</Label>
                  <Input
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    data-testid="input-platform-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Versão</Label>
                  <Input value="1.0.0" disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Domínio Principal</Label>
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  data-testid="input-domain"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Server className="w-4 h-4" /> Asterisk Padrão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Versão Padrão</Label>
                  <Input value="22 LTS" disabled />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Porta SIP Padrão</Label>
                  <Input
                    type="number"
                    value={defaultSipPort}
                    onChange={(e) => setDefaultSipPort(Number(e.target.value))}
                    data-testid="input-default-sip-port"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Porta RTP (Início)</Label>
                  <Input
                    type="number"
                    value={rtpStart}
                    onChange={(e) => setRtpStart(Number(e.target.value))}
                    data-testid="input-rtp-start"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Porta RTP (Fim)</Label>
                  <Input
                    type="number"
                    value={rtpEnd}
                    onChange={(e) => setRtpEnd(Number(e.target.value))}
                    data-testid="input-rtp-end"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Codec Padrão</Label>
                  <Input
                    value={defaultCodec}
                    onChange={(e) => setDefaultCodec(e.target.value)}
                    data-testid="input-default-codec"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">DTMF Padrão</Label>
                  <Input
                    value={defaultDtmf}
                    onChange={(e) => setDefaultDtmf(e.target.value)}
                    data-testid="input-default-dtmf"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Gravação de Chamadas</Label>
                    <p className="text-[10px] text-muted-foreground">Ativar gravação padrão para novos ramais</p>
                  </div>
                  <Switch
                    checked={defaultRecording}
                    onCheckedChange={setDefaultRecording}
                    data-testid="switch-default-recording"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">NAT</Label>
                    <p className="text-[10px] text-muted-foreground">Habilitar NAT traversal por padrão</p>
                  </div>
                  <Switch
                    checked={natEnabled}
                    onCheckedChange={setNatEnabled}
                    data-testid="switch-nat"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">TLS/SRTP</Label>
                    <p className="text-[10px] text-muted-foreground">Forçar criptografia nas comunicações</p>
                  </div>
                  <Switch
                    checked={tlsSrtp}
                    onCheckedChange={setTlsSrtp}
                    data-testid="switch-tls"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lock className="w-4 h-4" /> Segurança SIP
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Bloquear Chamadas Anônimas</Label>
                  <p className="text-[10px] text-muted-foreground">allowguest=no no sip.conf</p>
                </div>
                <Switch
                  checked={blockAnonymousCalls}
                  onCheckedChange={setBlockAnonymousCalls}
                  data-testid="switch-block-anonymous"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Rejeitar Autenticação Sempre</Label>
                  <p className="text-[10px] text-muted-foreground">alwaysauthreject=yes para não revelar nomes de usuário válidos</p>
                </div>
                <Switch
                  checked={alwaysAuthReject}
                  onCheckedChange={setAlwaysAuthReject}
                  data-testid="switch-always-auth-reject"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Fail2Ban</Label>
                  <p className="text-[10px] text-muted-foreground">Proteção contra ataques de força bruta</p>
                </div>
                <Switch
                  checked={fail2banEnabled}
                  onCheckedChange={setFail2banEnabled}
                  data-testid="switch-fail2ban"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="w-4 h-4" /> Firewall
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Portas Liberadas</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">5060 (SIP)</Badge>
                  <Badge variant="outline">5061 (SIP TLS)</Badge>
                  <Badge variant="outline">10000-20000 (RTP)</Badge>
                  <Badge variant="outline">8088 (WebSocket)</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">IPs Permitidos (whitelist)</Label>
                <Input
                  placeholder="192.168.1.0/24, 10.0.0.0/8"
                  value={allowedIps}
                  onChange={(e) => setAllowedIps(e.target.value)}
                  data-testid="input-allowed-ips"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="w-4 h-4" /> Notificações por E-mail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Servidor Offline</Label>
                  <p className="text-[10px] text-muted-foreground">Receber alerta quando um servidor ficar offline</p>
                </div>
                <Switch
                  checked={emailServerOffline}
                  onCheckedChange={setEmailServerOffline}
                  data-testid="switch-email-server-offline"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Tronco SIP Desconectado</Label>
                  <p className="text-[10px] text-muted-foreground">Alerta quando um tronco SIP perder o registro</p>
                </div>
                <Switch
                  checked={emailTrunkDisconnected}
                  onCheckedChange={setEmailTrunkDisconnected}
                  data-testid="switch-email-trunk-disconnected"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Alto Uso de CPU</Label>
                  <p className="text-[10px] text-muted-foreground">Alerta quando CPU do servidor ultrapassar 90%</p>
                </div>
                <Switch
                  checked={emailHighCpu}
                  onCheckedChange={setEmailHighCpu}
                  data-testid="switch-email-high-cpu"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Chamadas Perdidas</Label>
                  <p className="text-[10px] text-muted-foreground">Resumo diário de chamadas perdidas</p>
                </div>
                <Switch
                  checked={emailMissedCalls}
                  onCheckedChange={setEmailMissedCalls}
                  data-testid="switch-email-missed-calls"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="w-4 h-4" /> Backup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Backup Automático</Label>
                  <p className="text-[10px] text-muted-foreground">Backup diário das configurações e CDR</p>
                </div>
                <Switch
                  checked={autoBackup}
                  onCheckedChange={setAutoBackup}
                  data-testid="switch-auto-backup"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Retenção de Logs (dias)</Label>
                <Input
                  type="number"
                  value={logRetentionDays}
                  onChange={(e) => setLogRetentionDays(Number(e.target.value))}
                  data-testid="input-log-retention"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          data-testid="button-save-settings"
        >
          {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
