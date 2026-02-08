import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Companies from "@/pages/companies";
import Servers from "@/pages/servers";
import Extensions from "@/pages/extensions";
import SipTrunks from "@/pages/sip-trunks";
import IVR from "@/pages/ivr";
import CallLogs from "@/pages/call-logs";
import Integrations from "@/pages/integrations";
import Settings from "@/pages/settings";
import UsersPage from "@/pages/users";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import { Loader2 } from "lucide-react";

function ProtectedRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/companies" component={Companies} />
      <Route path="/servers" component={Servers} />
      <Route path="/extensions" component={Extensions} />
      <Route path="/sip-trunks" component={SipTrunks} />
      <Route path="/ivr" component={IVR} />
      <Route path="/call-logs" component={CallLogs} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/settings" component={Settings} />
      <Route path="/users" component={UsersPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route component={Landing} />
    </Switch>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <PublicRouter />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-background sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <ProtectedRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
