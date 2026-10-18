import { useCallback, useEffect, useState } from "react";

// Thin wrapper over fetch: JSON in/out, and failures become ApiError with a message
// that's safe to show (the server's own error text when it sends one).
export class ApiError extends Error {
  status: number;
  body: Record<string, unknown> | null;
  constructor(message: string, status: number, body: Record<string, unknown> | null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";

function fallbackMessage(status: number) {
  if (status === 401) return "Your session has expired. Log in again to continue.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "That item no longer exists. It may have been deleted.";
  if (status === 503) return "That service is temporarily unavailable. Try again shortly.";
  if (status >= 500) return "Something went wrong on our side. Try again in a moment.";
  return "That request couldn't be completed.";
}

export async function api<T = unknown>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {}
): Promise<T> {
  const { method = "GET", body } = options;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0, null);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = typeof data?.error === "string" ? data.error : fallbackMessage(res.status);
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

export function errorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : "Something went wrong. Try again.";
}

type Result<T> = { path: string; key: string; data?: T; error?: ApiError };

/**
 * Loads a GET endpoint. `loading` is true until the current request settles; data from
 * an earlier load of the same path stays visible during a reload (no flicker), but is
 * dropped when the path changes. Pass null to skip loading.
 */
export function useResource<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T>>({ path: "", key: "" });
  const key = path ? `${path}#${version}` : "";

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api<T>(path).then(
      (data) => !cancelled && setResult({ path, key, data }),
      (error) =>
        !cancelled &&
        setResult((prev) => ({
          path,
          key,
          data: prev.path === path ? prev.data : undefined,
          error: error instanceof ApiError ? error : new ApiError(errorMessage(error), 0, null),
        }))
    );
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const samePath = result.path === path;
  return {
    data: samePath ? (result.data ?? null) : null,
    error: result.key === key ? (result.error ?? null) : null,
    loading: !!path && result.key !== key,
    reload,
  };
}
