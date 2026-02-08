import {
  Plug,
  Smartphone,
  Monitor,
  Phone,
  Globe,
  FileText,
  ExternalLink,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const softphones = [
  {
    name: "Zoiper",
    description: "Softphone profissional para desktop e mobile com suporte a SIP, IAX2 e codecs HD",
    platforms: ["Windows", "macOS", "Linux", "Android", "iOS"],
    protocols: ["SIP", "IAX2"],
    status: "compatible",
  },
  {
    name: "Linphone",
    description: "Softphone open-source com suporte a vídeo, chamadas e mensagens SIP",
    platforms: ["Windows", "macOS", "Linux", "Android", "iOS"],
    protocols: ["SIP"],
    status: "compatible",
  },
  {
    name: "MicroSIP",
    description: "Softphone leve para Windows com suporte a codecs de alta qualidade",
    platforms: ["Windows"],
    protocols: ["SIP"],
    status: "compatible",
  },
  {
    name: "Grandstream Wave",
    description: "Softphone gratuito da Grandstream para smartphones e tablets",
    platforms: ["Android", "iOS"],
    protocols: ["SIP"],
    status: "compatible",
  },
  {
    name: "WebRTC Client",
    description: "Cliente de telefonia diretamente no navegador web sem instalação",
    platforms: ["Chrome", "Firefox", "Edge", "Safari"],
    protocols: ["WebRTC", "SIP"],
    status: "compatible",
  },
];

const ipPhones = [
  {
    name: "Yealink T-Series",
    description: "Telefones IP de mesa empresariais (T46U, T54W, T57W) com display colorido e HD voice",
    models: ["T46U", "T54W", "T57W", "T58W"],
    protocols: ["SIP", "PJSIP"],
    status: "compatible",
  },
  {
    name: "Grandstream GXP",
    description: "Telefones IP com qualidade profissional, PoE e provisionamento automático",
    models: ["GXP2170", "GXP2160", "GRP2614"],
    protocols: ["SIP"],
    status: "compatible",
  },
  {
    name: "Polycom VVX",
    description: "Telefones IP Poly com qualidade de áudio superior e interface intuitiva",
    models: ["VVX250", "VVX350", "VVX450"],
    protocols: ["SIP"],
    status: "compatible",
  },
  {
    name: "Cisco SPA",
    description: "Telefones IP Cisco para pequenas e médias empresas com setup simplificado",
    models: ["SPA525G2", "SPA508G"],
    protocols: ["SIP"],
    status: "compatible",
  },
];

const sipProviders = [
  {
    name: "Telnyx",
    description: "Provedor global com API moderna, Opus codec e sem taxas mensais",
    features: ["API REST", "Opus Codec", "Global Coverage", "TLS/SRTP"],
    pricing: "Pay-per-use",
    status: "supported",
  },
  {
    name: "Twilio",
    description: "Plataforma de comunicação programável com SIP trunking elástico",
    features: ["Elastic SIP", "API-driven", "TLS/SRTP", "Programmatic IVR"],
    pricing: "$0.0085/min",
    status: "supported",
  },
  {
    name: "Flowroute",
    description: "Provedor developer-friendly com suporte a T.38 fax e pagamento por uso",
    features: ["Developer API", "T.38 Fax", "SMS", "Pay-as-you-go"],
    pricing: "$0.008/min",
    status: "supported",
  },
  {
    name: "VoIP.ms",
    description: "Provedor canadense com preços competitivos e ampla cobertura na América do Norte",
    features: ["DID Numbers", "E911", "Fax", "SMS"],
    pricing: "$0.01/min",
    status: "supported",
  },
  {
    name: "Sangoma SIPStation",
    description: "Integração nativa com Asterisk/FreePBX, planos ilimitados para EUA/Canadá",
    features: ["Native Integration", "Unlimited Plans", "E911", "Failover"],
    pricing: "Plans from $24.99/mo",
    status: "supported",
  },
];

const apiDocs = [
  {
    name: "API de Autenticação",
    description: "Login, logout e dados do usuário autenticado",
    endpoint: "/api/auth",
    methods: ["POST", "GET"],
  },
  {
    name: "API de Usuários",
    description: "Gerenciamento de usuários do sistema (admin only)",
    endpoint: "/api/users",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
  {
    name: "API de Empresas",
    description: "Gerenciamento multi-tenant de empresas e clientes",
    endpoint: "/api/companies",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
  {
    name: "API de Servidores",
    description: "Monitoramento e configuração de servidores Asterisk",
    endpoint: "/api/servers",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
  {
    name: "API de Ramais",
    description: "CRUD completo para gerenciamento de ramais SIP/PJSIP",
    endpoint: "/api/extensions",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
  {
    name: "API de Troncos SIP",
    description: "Gerenciamento de troncos e conexões com operadoras",
    endpoint: "/api/sip-trunks",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
  {
    name: "API de IVR / URA",
    description: "Configuração de menus de atendimento automático",
    endpoint: "/api/ivr-menus",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
  {
    name: "API de Filas",
    description: "Gerenciamento de filas de atendimento",
    endpoint: "/api/queues",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
  {
    name: "API de Conferências",
    description: "Salas de conferência ConfBridge com PIN e gravação",
    endpoint: "/api/conference-rooms",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
  {
    name: "API de DID / DDR",
    description: "Gerenciamento de números DID com roteamento por horário",
    endpoint: "/api/dids",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
  {
    name: "API de CallerID",
    description: "Regras de manipulação de CallerID com padrões regex",
    endpoint: "/api/caller-id-rules",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
  {
    name: "API de Speed Dial / BLF",
    description: "Teclas de discagem rápida com suporte a BLF",
    endpoint: "/api/speed-dials",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
  {
    name: "API de Contatos",
    description: "Agenda de contatos com favoritos",
    endpoint: "/api/contacts",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
  {
    name: "API de Chamadas",
    description: "Histórico e registros de chamadas (CDR) com filtros",
    endpoint: "/api/call-logs",
    methods: ["GET"],
  },
  {
    name: "API de Relatórios",
    description: "Resumo de chamadas com dados para gráficos",
    endpoint: "/api/reports/calls-summary",
    methods: ["GET"],
  },
  {
    name: "API de Log de Atividades",
    description: "Auditoria de ações dos usuários no sistema",
    endpoint: "/api/activity-logs",
    methods: ["GET"],
  },
  {
    name: "API de Configurações",
    description: "Configurações gerais da plataforma",
    endpoint: "/api/platform-settings",
    methods: ["GET", "PUT"],
  },
  {
    name: "API AMI",
    description: "Integração com Asterisk Manager Interface (test, status, peers, channels, reload, originate, hangup, etc.)",
    endpoint: "/api/servers/:id/ami/*",
    methods: ["GET", "POST"],
  },
  {
    name: "API de Gravações",
    description: "Gerenciamento de gravações de chamadas via SSH",
    endpoint: "/api/servers/:id/recordings",
    methods: ["GET", "DELETE"],
  },
  {
    name: "API de Voicemail",
    description: "Mensagens de voicemail via SSH com playback e download",
    endpoint: "/api/servers/:id/voicemail-messages",
    methods: ["GET", "DELETE"],
  },
  {
    name: "API de Music on Hold",
    description: "Gerenciamento de arquivos de música em espera via SSH",
    endpoint: "/api/servers/:id/moh",
    methods: ["GET", "DELETE"],
  },
  {
    name: "API de Backup",
    description: "Backup e restauração de configurações Asterisk via SSH",
    endpoint: "/api/servers/:id/backups",
    methods: ["GET", "POST", "DELETE"],
  },
  {
    name: "API de Firewall",
    description: "Visualização de Fail2ban e IPTables via SSH",
    endpoint: "/api/servers/:id/firewall/*",
    methods: ["GET", "POST"],
  },
];

export default function Integrations() {
  return (
    <div className="space-y-6" data-testid="page-integrations">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Integrações</h1>
        <p className="text-sm text-muted-foreground">
          Dispositivos compatíveis, provedores SIP e documentação da API
        </p>
      </div>

      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList data-testid="tabs-integrations">
          <TabsTrigger value="devices" data-testid="tab-devices">
            <Smartphone className="w-4 h-4 mr-2" /> Dispositivos
          </TabsTrigger>
          <TabsTrigger value="providers" data-testid="tab-providers">
            <Globe className="w-4 h-4 mr-2" /> Operadoras SIP
          </TabsTrigger>
          <TabsTrigger value="api" data-testid="tab-api">
            <FileText className="w-4 h-4 mr-2" /> Documentação API
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <Monitor className="w-4 h-4" /> Softphones (Desktop & Mobile)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {softphones.map((app) => (
                <Card key={app.name} className="hover-elevate" data-testid={`card-softphone-${app.name.toLowerCase().replace(/\s/g, "-")}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-semibold">{app.name}</h3>
                      <Badge variant="default" className="text-[10px]">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Compatível
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{app.description}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {app.platforms.map((p) => (
                        <Badge key={p} variant="outline" className="text-[9px]">{p}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {app.protocols.map((p) => (
                        <Badge key={p} variant="secondary" className="text-[9px]">{p}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <Phone className="w-4 h-4" /> Telefones IP
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ipPhones.map((phone) => (
                <Card key={phone.name} className="hover-elevate" data-testid={`card-phone-${phone.name.toLowerCase().replace(/\s/g, "-")}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-semibold">{phone.name}</h3>
                      <Badge variant="default" className="text-[10px]">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Compatível
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{phone.description}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {phone.models.map((m) => (
                        <Badge key={m} variant="outline" className="text-[9px]">{m}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sipProviders.map((provider) => (
              <Card key={provider.name} className="hover-elevate" data-testid={`card-provider-${provider.name.toLowerCase().replace(/[\s.]/g, "-")}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold">{provider.name}</h3>
                    <Badge variant="default" className="text-[10px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Suportado
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{provider.description}</p>
                  <div className="flex items-center gap-1 mb-3 flex-wrap">
                    {provider.features.map((f) => (
                      <Badge key={f} variant="outline" className="text-[9px]">{f}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t">
                    <span className="text-[11px] text-muted-foreground">Preço: <span className="font-medium text-foreground">{provider.pricing}</span></span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Documentação da API REST</CardTitle>
              <p className="text-xs text-muted-foreground">Todos os endpoints disponíveis para integração com sistemas externos</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {apiDocs.map((doc) => (
                  <div key={doc.endpoint} className="flex items-center gap-4 px-5 py-3" data-testid={`api-doc-${doc.endpoint.replace(/\//g, "-")}`}>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium">{doc.name}</h4>
                      <p className="text-[11px] text-muted-foreground">{doc.description}</p>
                      <code className="text-[11px] font-mono text-primary mt-1 block">{doc.endpoint}</code>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {doc.methods.map((m) => (
                        <Badge
                          key={m}
                          variant={m === "GET" ? "outline" : m === "POST" ? "default" : m === "DELETE" ? "destructive" : "secondary"}
                          className="text-[9px]"
                        >
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
