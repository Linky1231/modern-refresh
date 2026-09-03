import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Loader2, UserPlus, LogIn, Eye, EyeOff } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "@/lib/router-compat";
import { motion, AnimatePresence } from "framer-motion";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { loading: authLoading, isAuthenticated, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signIn({ username, password });
      navigate(redirect);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al iniciar sesión",
      );
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setIsLoading(true);
    try {
      await signUp({ username, password, name: displayName || undefined });
      navigate(redirect);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al crear la cuenta",
      );
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    const newMode = mode === "login" ? "register" : "login";
    setMode(newMode);
    setError(null);
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setDisplayName("");
    // Update URL without full navigation
    const params = new URLSearchParams(window.location.search);
    params.set("mode", newMode);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
    >
      {/* ── Back button ────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <button
            onClick={() => navigate("/")}
            aria-label="Volver al inicio"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pt-14">
        <div className="w-full max-w-sm">
          {/* ── Logo & Brand ─────────────────────────── */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/8">
              <img
                src="/assets/67385.png"
                alt="Asternal"
                className="h-14 w-14 rounded-2xl object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Asternal
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Tu espacio de desarrollo GameDev
            </p>
          </motion.div>

          {/* ── Auth Card ────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
          >
            <Card className="border-border/40 shadow-md shadow-primary/5">
              <AnimatePresence mode="wait">
                {mode === "login" ? (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <CardHeader className="pb-4">
                      <CardTitle className="text-center text-lg">
                        Bienvenido de vuelta
                      </CardTitle>
                    </CardHeader>
                    <form onSubmit={handleLogin}>
                      <CardContent className="space-y-3 pb-6">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                            Usuario
                          </label>
                          <Input
                            placeholder="Tu nombre de usuario"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isLoading}
                            required
                            autoComplete="username"
                            className="h-10"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                            Contraseña
                          </label>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Tu contraseña"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              disabled={isLoading}
                              required
                              autoComplete="current-password"
                              className="h-10 pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              tabIndex={-1}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <AnimatePresence>
                          {error && (
                            <motion.p
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-center text-sm font-medium text-destructive"
                            >
                              {error}
                            </motion.p>
                          )}
                        </AnimatePresence>

                        <Button
                          type="submit"
                          className="w-full h-10"
                          disabled={isLoading || !username || !password}
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Entrar
                              <LogIn className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="register"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <CardHeader className="pb-4">
                      <CardTitle className="text-center text-lg">
                        Únete a Asternal
                      </CardTitle>
                    </CardHeader>
                    <form onSubmit={handleRegister}>
                      <CardContent className="space-y-3 pb-6">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                            Nombre de usuario
                          </label>
                          <Input
                            placeholder="Elige un nombre de usuario"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isLoading}
                            required
                            autoComplete="username"
                            className="h-10"
                          />
                          <p className="text-[11px] text-muted-foreground/60 mt-1">
                            Mínimo 3 caracteres. Solo minúsculas, números y guiones bajos.
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                            Nombre para mostrar
                          </label>
                          <Input
                            placeholder="Tu nombre (opcional)"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            disabled={isLoading}
                            autoComplete="name"
                            className="h-10"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                            Contraseña
                          </label>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Crea una contraseña"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              disabled={isLoading}
                              required
                              autoComplete="new-password"
                              className="h-10 pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              tabIndex={-1}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                            Confirmar contraseña
                          </label>
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Repite tu contraseña"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isLoading}
                            required
                            autoComplete="new-password"
                            className="h-10"
                          />
                        </div>

                        <AnimatePresence>
                          {error && (
                            <motion.p
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-center text-sm font-medium text-destructive"
                            >
                              {error}
                            </motion.p>
                          )}
                        </AnimatePresence>

                        <Button
                          type="submit"
                          className="w-full h-10"
                          disabled={
                            isLoading ||
                            !username ||
                            !password ||
                            !confirmPassword
                          }
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Crear cuenta
                              <UserPlus className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Switch mode ─────────────────────── */}
              <div className="border-t border-border/40 px-6 py-3.5 text-center">
                <p className="text-xs text-muted-foreground">
                  {mode === "login" ? (
                    <>
                      ¿No tienes cuenta?
                      <button
                        onClick={switchMode}
                        className="ml-1 font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        Regístrate
                      </button>
                    </>
                  ) : (
                    <>
                      ¿Ya tienes cuenta?
                      <button
                        onClick={switchMode}
                        className="ml-1 font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        Inicia sesión
                      </button>
                    </>
                  )}
                </p>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <Auth {...props} />
    </Suspense>
  );
}
