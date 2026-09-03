import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Navigate, useLocation } from "@/lib/router-compat";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();
  // Captured on first render so a redirect can never re-append itself.
  const initialTarget = useRef(`${location.pathname}${location.search}`);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    if (location.pathname.startsWith("/auth")) return null;
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(initialTarget.current)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}

