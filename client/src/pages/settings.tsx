import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function Settings() {
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
                  <Input defaultValue="Admin VOIP" data-testid="input-platform-name" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Versão</Label>
                  <Input defaultValue="1.0.0" disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Domínio Principal</Label>
                <Input defaultValue="admin-voip.example.com" data-testid="input-domain" />
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
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Versão Padrão</Label>
                  <Input defaultValue="22 LTS" disabled />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Porta SIP Padrão</Label>
                  <Input type="number" defaultValue="5060" data-testid="input-default-sip-port" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Porta RTP (Início)</Label>
                  <Input type="number" defaultValue="10000" data-testid="input-rtp-start" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Codec Padrão</Label>
                  <Input defaultValue="G.711" data-testid="input-default-codec" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">DTMF Padrão</Label>
                  <Input defaultValue="rfc2833" data-testid="input-default-dtmf" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Gravação de Chamadas</Label>
                    <p className="text-[10px] text-muted-foreground">Ativar gravação padrão para novos ramais</p>
                  </div>
                  <Switch defaultChecked={false} data-testid="switch-default-recording" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">NAT</Label>
                    <p className="text-[10px] text-muted-foreground">Habilitar NAT traversal por padrão</p>
                  </div>
                  <Switch defaultChecked={true} data-testid="switch-nat" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">TLS/SRTP</Label>
                    <p className="text-[10px] text-muted-foreground">Forçar criptografia nas comunicações</p>
                  </div>
                  <Switch defaultChecked={false} data-testid="switch-tls" />
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
                <Switch defaultChecked={true} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Rejeitar Autenticação Sempre</Label>
                  <p className="text-[10px] text-muted-foreground">alwaysauthreject=yes para não revelar nomes de usuário válidos</p>
                </div>
                <Switch defaultChecked={true} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Fail2Ban</Label>
                  <p className="text-[10px] text-muted-foreground">Proteção contra ataques de força bruta</p>
                </div>
                <Switch defaultChecked={true} />
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
                <Input placeholder="192.168.1.0/24, 10.0.0.0/8" data-testid="input-allowed-ips" />
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
                <Switch defaultChecked={true} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Tronco SIP Desconectado</Label>
                  <p className="text-[10px] text-muted-foreground">Alerta quando um tronco SIP perder o registro</p>
                </div>
                <Switch defaultChecked={true} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Alto Uso de CPU</Label>
                  <p className="text-[10px] text-muted-foreground">Alerta quando CPU do servidor ultrapassar 90%</p>
                </div>
                <Switch defaultChecked={true} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Chamadas Perdidas</Label>
                  <p className="text-[10px] text-muted-foreground">Resumo diário de chamadas perdidas</p>
                </div>
                <Switch defaultChecked={false} />
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
                <Switch defaultChecked={true} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Retenção de Logs (dias)</Label>
                <Input type="number" defaultValue="90" data-testid="input-log-retention" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button data-testid="button-save-settings">Salvar Configurações</Button>
      </div>
    </div>
  );
}
