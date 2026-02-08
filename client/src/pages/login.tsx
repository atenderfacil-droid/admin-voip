import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Headphones, LogIn, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Preencha todos os campos");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      await login(username, password);
    } catch {
      setError("Usuário ou senha inválidos");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="page-login">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-center mb-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-md bg-primary mb-3">
              <Headphones className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Admin VOIP</h1>
            <p className="text-xs text-muted-foreground">Acesse o painel de gerenciamento</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                autoComplete="username"
                data-testid="input-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  data-testid="input-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive" data-testid="text-login-error">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login">
              {isLoading ? "Entrando..." : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </form>

          <p className="text-[10px] text-muted-foreground text-center mt-4">
            Admin VOIP - Plataforma de Gerenciamento Asterisk
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
