import { useSyncExternalStore } from "react";

// Minimal hash router so each section has a URL and the back button works,
// without adding a routing dependency or server-side route changes.
export type Route =
  | { name: "availability" }
  | { name: "groups" }
  | { name: "group"; id: string }
  | { name: "servers" }
  | { name: "settings" }
  | { name: "notFound" };

export const DEFAULT_PATH = "/availability";

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "") || DEFAULT_PATH;
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "availability" && parts.length === 1) return { name: "availability" };
  if (parts[0] === "groups" && parts.length === 1) return { name: "groups" };
  if (parts[0] === "groups" && parts.length === 2) return { name: "group", id: parts[1] };
  if (parts[0] === "servers" && parts.length === 1) return { name: "servers" };
  if (parts[0] === "settings" && parts.length === 1) return { name: "settings" };
  return { name: "notFound" };
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useHash() {
  return useSyncExternalStore(subscribe, () => window.location.hash);
}

export const href = (path: string) => `#${path}`;

export function navigate(path: string) {
  window.location.hash = path;
}
