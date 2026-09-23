import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// ── Rutas cargadas bajo demanda ─────────────────────────────────────
// Si el grafo de módulos se queda obsoleto (un archivo renombrado o borrado
// mientras la pestaña del preview sigue abierta), el import dinámico falla con
// "Failed to fetch dynamically imported module". En ese caso recargamos una
// sola vez para que el navegador pida el grafo actual; la marca en
// sessionStorage evita bucles de recarga si el chunk sigue sin existir.
const CHUNK_RETRY_KEY = "asternal:chunk-retry";

function chunkRetryFlag(): string | null {
  try {
    return sessionStorage.getItem(CHUNK_RETRY_KEY);
  } catch {
    // Sin acceso a sessionStorage no podemos recordar el intento: no recargamos.
    return "1";
  }
}

function withChunkRetry<T>(load: () => Promise<T>): Promise<T> {
  return load().then(
    (module) => {
      try {
        sessionStorage.removeItem(CHUNK_RETRY_KEY);
      } catch {
        /* ignorar */
      }
      return module;
    },
    (error: unknown) => {
      if (!chunkRetryFlag()) {
        try {
          sessionStorage.setItem(CHUNK_RETRY_KEY, "1");
        } catch {
          /* ignorar */
        }
        window.location.reload();
      }
      throw error;
    },
  );
}

const AuthPage = lazy(() => withChunkRetry(() => import("./pages/Auth.tsx")));
const Dashboard = lazy(() => withChunkRetry(() => import("./pages/Dashboard.tsx")));
const EditorPage = lazy(() => withChunkRetry(() => import("./pages/Editor.tsx")));
const NotFound = lazy(() => withChunkRetry(() => import("./pages/NotFound.tsx")));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/30 p-2">
                {this.state.stack}
              </pre>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.99]"
            >
              Recargar la página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <BrowserRouter>
        <RouteSyncer />
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* Sin landing page: la app entra directamente en el acceso.
                Ambas rutas ("/" y "/auth") llevan a la pantalla de auth. */}
            <Route
              path="/"
              element={<AuthPage redirectAfterAuth="/dashboard" />}
            />
            <Route
              path="/auth"
              element={<AuthPage redirectAfterAuth="/dashboard" />}
            />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/editor"
              element={
                <RequireAuth>
                  <EditorPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </RootErrorBoundary>
  </StrictMode>,
);
