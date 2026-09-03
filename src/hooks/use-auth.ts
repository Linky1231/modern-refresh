import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  getCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
} from "@/lib/db";

interface User {
  _id: string;
  name: string;
  username?: string;
  email?: string;
  image?: string;
  role?: string;
  isAuthenticated: boolean;
}

const AUTH_STORAGE_KEY = "asternal_auth";

// ─────────────────────────────────────────────────────────────
// Shared auth store: every useAuth() instance reads the SAME
// state, so mounting a new component (e.g. RequireAuth on
// /dashboard) never resets the session to "not authenticated".
// ─────────────────────────────────────────────────────────────

type AuthState = { user: User | null; loading: boolean };

function readCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return cached ? (JSON.parse(cached) as User) : null;
  } catch {
    return null;
  }
}

let state: AuthState = { user: null, loading: true };
const listeners = new Set<(s: AuthState) => void>();
let initialized = false;

function setState(next: Partial<AuthState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

function setUser(user: User | null) {
  setState({ user });
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function toUser(profile: {
  id: string;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
}): User {
  return {
    _id: profile.id,
    name: profile.name || "Anónimo",
    username: profile.username ?? undefined,
    email: profile.email ?? undefined,
    image: profile.image ?? undefined,
    role: profile.role ?? undefined,
    isAuthenticated: true,
  };
}

async function syncFromSession() {
  const profile = await getCurrentUser();
  if (profile) {
    setUser(toUser(profile));
    return true;
  }
  return false;
}

function initialize() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // Optimistic hydration from cache so protected routes don't bounce.
  const cached = readCachedUser();
  if (cached) setState({ user: cached });

  (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const ok = await syncFromSession();
        if (!ok && !cached) setUser(null);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setState({ loading: false });
    }
  })();

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (
      (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") &&
      session?.user
    ) {
      await syncFromSession();
      setState({ loading: false });
    } else if (event === "SIGNED_OUT") {
      setUser(null);
      setState({ loading: false });
    }
  });
}

export function useAuth() {
  initialize();
  const [local, setLocal] = useState<AuthState>(state);

  useEffect(() => {
    const listener = (s: AuthState) => setLocal(s);
    listeners.add(listener);
    setLocal(state);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const signIn = useCallback(
    async (credentials?: { username?: string; password?: string }) => {
      if (!credentials?.username || !credentials?.password) {
        throw new Error("Se requiere nombre de usuario y contraseña");
      }
      const result = await loginUser(credentials.username, credentials.password);
      const userData: User = { ...result, _id: result._id, isAuthenticated: true };
      setUser(userData);
      setState({ loading: false });
      return userData;
    },
    [],
  );

  const signUp = useCallback(
    async (credentials?: {
      username?: string;
      password?: string;
      name?: string;
    }) => {
      if (!credentials?.username || !credentials?.password) {
        throw new Error("Se requiere nombre de usuario y contraseña");
      }
      const result = await registerUser(
        credentials.username,
        credentials.password,
        credentials.name,
      );
      const userData: User = {
        _id: result._id,
        name: result.name,
        username: result.username,
        isAuthenticated: true,
      };
      setUser(userData);
      setState({ loading: false });
      return userData;
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setState({ loading: false });
    }
  }, []);

  return {
    user: local.user,
    loading: local.loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: local.user?.isAuthenticated ?? false,
  };
}
