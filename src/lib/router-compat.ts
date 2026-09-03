/**
 * Compatibility layer for the ported app pages: the pages use this
 * string-based navigation API, originally built on TanStack Router.
 * Freebuff hosts the app inside a react-router shell, so these hooks
 * delegate to react-router while keeping the exact same API — the
 * pages themselves are unchanged.
 */
import { useCallback, useEffect } from "react";
import {
  useNavigate as useReactRouterNavigate,
  useLocation as useReactRouterLocation,
  useSearchParams as useReactRouterSearchParams,
} from "react-router";

type NavOptions = { replace?: boolean };

export function useNavigate() {
  const navigate = useReactRouterNavigate();

  return useCallback(
    (to: string | number, options?: NavOptions) => {
      if (typeof to === "number") {
        if (typeof window !== "undefined") window.history.go(to);
        return;
      }
      navigate(to, { replace: options?.replace });
    },
    [navigate],
  );
}

export function useLocation() {
  const location = useReactRouterLocation();
  return {
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
  };
}

export function useSearchParams(): [URLSearchParams] {
  const [params] = useReactRouterSearchParams();
  return [params];
}

export function Navigate({
  to,
  replace,
}: {
  to: string;
  replace?: boolean;
}): null {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, to, replace]);
  return null;
}