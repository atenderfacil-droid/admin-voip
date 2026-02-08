import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Headphones,
  Phone,
  Server,
  Shield,
  Globe,
  BarChart3,
  Users,
  Zap,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: Server,
    title: "Gerenciamento de Servidores",
    description: "Monitore e gerencie seus servidores Asterisk PBX em tempo real com dashboards completos.",
  },
  {
    icon: Phone,
    title: "Ramais e Extensões",
    description: "Configure ramais SIP, PJSIP e WebRTC com voicemail e gravação de chamadas.",
  },
  {
    icon: Globe,
    title: "Troncos SIP",
    description: "Integração com os principais provedores: Telnyx, Twilio, Flowroute, VoIP.ms e mais.",
  },
  {
    icon: Shield,
    title: "Multi-Tenant Seguro",
    description: "Isolamento completo de dados por empresa com controle de acesso por perfil.",
  },
  {
    icon: BarChart3,
    title: "Relatórios e CDR",
    description: "Registros detalhados de chamadas com filtros avançados e métricas de desempenho.",
  },
  {
    icon: Users,
    title: "Gestão de Usuários",
    description: "Controle de acesso com 4 níveis: Super Admin, Admin, Operador e Visualizador.",
  },
];

const plans = [
  {
    name: "Multi-Tenant",
    description: "Compartilhe a infraestrutura do servidor com custo reduzido",
    highlights: ["Até 100 ramais", "Até 10 troncos SIP", "Suporte por e-mail", "Dashboard compartilhado"],
  },
  {
    name: "Dedicado",
    description: "Servidor exclusivo com recursos totalmente dedicados",
    highlights: ["Ramais ilimitados", "Troncos ilimitados", "Suporte prioritário", "Servidor exclusivo"],
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background" data-testid="page-landing">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
              <Headphones className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold tracking-tight">Admin VOIP</span>
          </div>
          <Link href="/login">
            <Button data-testid="button-goto-login">
              Acessar Painel <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="max-w-6xl mx-auto px-6 py-20 relative">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-primary">Plataforma de Gerenciamento VOIP</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Gerencie seus servidores Asterisk PBX com eficiência
            </h1>
            <p className="text-base text-muted-foreground mb-8 leading-relaxed">
              Plataforma completa para administração de centrais telefônicas Asterisk.
              Multi-tenant, segura e com monitoramento em tempo real.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Link href="/login">
                <Button data-testid="button-hero-login">
                  Começar Agora <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Button variant="outline" data-testid="button-hero-features"
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
                Ver Recursos
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 border-t">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight mb-2">Recursos da Plataforma</h2>
            <p className="text-sm text-muted-foreground">Tudo que você precisa para gerenciar sua central VOIP</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="hover-elevate" data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s/g, "-")}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 mb-4">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold mb-2">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 border-t">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight mb-2">Planos de Serviço</h2>
            <p className="text-sm text-muted-foreground">Escolha o modelo ideal para sua empresa</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {plans.map((plan) => (
              <Card key={plan.name} className="hover-elevate" data-testid={`card-plan-${plan.name.toLowerCase().replace(/\s/g, "-")}`}>
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>
                  <ul className="space-y-2">
                    {plan.highlights.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/login">
                    <Button variant="outline" className="w-full mt-4">
                      Solicitar Acesso
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Headphones className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold">Admin VOIP</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Plataforma de Gerenciamento Asterisk PBX
          </p>
        </div>
      </footer>
    </div>
  );
}
