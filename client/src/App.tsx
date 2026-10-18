import { useCallback, useEffect, useState } from "react";
import { api, ApiError, errorMessage } from "./api";
import { parseRoute, useHash } from "./router";
import { TimezoneContext } from "./time";
import type { User } from "./types";
import AppShell from "./components/layout/AppShell";
import { ErrorState, LoadingState } from "./components/ui/States";
import LoginPage from "./pages/LoginPage";
import AvailabilityPage from "./pages/AvailabilityPage";
import GroupsPage from "./pages/GroupsPage";
import GroupPage from "./pages/GroupPage";
import ServersPage from "./pages/ServersPage";
import SettingsPage from "./pages/SettingsPage";
import NotFoundPage from "./pages/NotFoundPage";

type Session =
  | { state: "loading" }
  | { state: "signedOut" }
  | { state: "error"; message: string }
  | { state: "signedIn"; user: User };

function App() {
  const [session, setSession] = useState<Session>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const hash = useHash();
  const route = parseRoute(hash);

  useEffect(() => {
    let cancelled = false;
    api<User>("/api/me").then(
      (user) => !cancelled && setSession({ state: "signedIn", user }),
      (err) => {
        if (cancelled) return;
        // 401 means "not logged in"; anything else is a real failure worth retrying
        if (err instanceof ApiError && err.status === 401) setSession({ state: "signedOut" });
        else setSession({ state: "error", message: errorMessage(err) });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const logout = useCallback(async () => {
    await api("/api/logout", { method: "POST" });
    setSession({ state: "signedOut" });
  }, []);

  if (session.state === "loading") {
    return (
      <div className="splash">
        <LoadingState label="Loading your schedule…" />
      </div>
    );
  }
  if (session.state === "error") {
    return (
      <div className="splash">
        <ErrorState
          title="Couldn't load the app"
          message={session.message}
          onRetry={() => {
            setSession({ state: "loading" });
            setAttempt((n) => n + 1);
          }}
        />
      </div>
    );
  }
  if (session.state === "signedOut") return <LoginPage />;

  const { user } = session;
  const setUser = (next: User) => setSession({ state: "signedIn", user: next });

  return (
    <TimezoneContext.Provider value={user.timezone}>
      <AppShell user={user} route={route} routeKey={hash}>
        {route.name === "availability" && <AvailabilityPage user={user} onUserChange={setUser} />}
        {route.name === "groups" && <GroupsPage />}
        {route.name === "group" && <GroupPage key={route.id} id={route.id} />}
        {route.name === "servers" && <ServersPage />}
        {route.name === "settings" && <SettingsPage user={user} onUserChange={setUser} onLogout={logout} />}
        {route.name === "notFound" && <NotFoundPage />}
      </AppShell>
    </TimezoneContext.Provider>
  );
}

export default App;
