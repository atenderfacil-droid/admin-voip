import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Building2,
  Server,
  Phone,
  PhoneCall,
  Globe,
  AudioLines,
  Plug,
  FileText,
  BarChart3,
  Settings,
  Headphones,
  Users,
  LogOut,
  Hash,
  Shield,
  ShieldCheck,
  FileAudio,
  Music,
  BookUser,
  Activity,
  Database,
  Podcast,
  Voicemail,
  Zap,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Empresas", url: "/companies", icon: Building2, roles: ["super_admin", "admin"] },
  { title: "Servidores", url: "/servers", icon: Server, roles: ["super_admin", "admin"] },
];

const telephonyNav = [
  { title: "Ramais", url: "/extensions", icon: Phone },
  { title: "Chamadas Online", url: "/online-calls", icon: PhoneCall },
  { title: "Troncos SIP", url: "/sip-trunks", icon: Globe, roles: ["super_admin", "admin", "operator"] },
  { title: "IVR / URA", url: "/ivr", icon: AudioLines, roles: ["super_admin", "admin", "operator"] },
  { title: "Filas", url: "/queues", icon: Users, roles: ["super_admin", "admin", "operator"] },
  { title: "Conferências", url: "/conference-rooms", icon: Podcast, roles: ["super_admin", "admin", "operator"] },
  { title: "Music on Hold", url: "/music-on-hold", icon: Music, roles: ["super_admin", "admin"] },
  { title: "Voicemail", url: "/voicemail", icon: Voicemail, roles: ["super_admin", "admin", "operator"] },
  { title: "DID / DDR", url: "/dids", icon: Hash, roles: ["super_admin", "admin"] },
  { title: "CallerID / Prefixos", url: "/caller-id-rules", icon: Shield, roles: ["super_admin", "admin"] },
  { title: "Agenda", url: "/phonebook", icon: BookUser },
  { title: "Speed Dial / BLF", url: "/speed-dials", icon: Zap, roles: ["super_admin", "admin", "operator"] },
];

const systemNav = [
  { title: "Gravações", url: "/recordings", icon: FileAudio },
  { title: "Firewall", url: "/firewall", icon: ShieldCheck, roles: ["super_admin", "admin"] },
  { title: "Registro de Chamadas", url: "/call-logs", icon: FileText },
  { title: "Relatórios", url: "/reports", icon: BarChart3 },
  { title: "Integrações", url: "/integrations", icon: Plug, roles: ["super_admin", "admin"] },
  { title: "Usuários", url: "/users", icon: Users, roles: ["super_admin", "admin"] },
  { title: "Log de Atividades", url: "/activity-log", icon: Activity, roles: ["super_admin", "admin"] },
  { title: "Backup", url: "/backups", icon: Database, roles: ["super_admin", "admin"] },
  { title: "Configurações", url: "/settings", icon: Settings, roles: ["super_admin", "admin"] },
];

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  operator: "Operador",
  viewer: "Visualizador",
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer" data-testid="link-logo">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
              <Headphones className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">Admin VOIP</span>
              <span className="text-[11px] text-muted-foreground">Asterisk Management</span>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.filter(item => !item.roles || item.roles.includes(user?.role || "")).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace("/", "") || "dashboard"}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Telefonia</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {telephonyNav.filter(item => !item.roles || item.roles.includes(user?.role || "")).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace("/", "")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemNav.filter(item => !item.roles || item.roles.includes(user?.role || "")).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace("/", "")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-3">
        {user && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium truncate">{user.fullName}</span>
              <span className="text-[10px] text-muted-foreground truncate">{roleLabels[user.role]}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">v1.0.0</Badge>
          <span className="text-[10px] text-muted-foreground">Asterisk 22 LTS</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
