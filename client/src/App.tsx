import { useEffect, useState } from "react";
import Home, { type User } from "./pages/Home";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div className="app">
      <h1>Discord Scheduler!</h1>
      {user ? (
        <Home user={user} onUserChange={setUser} onLogout={logout} />
      ) : (
        <a href="/auth/discord">Login with Discord</a>
      )}
    </div>
  );
}

export default App;
