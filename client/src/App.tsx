import { useEffect, useState } from "react";
import Availability from "./Availability";
import Groups from "./Groups";
import Settings from "./Settings";
import MyStatus from "./MyStatus";
import type { UserStatus } from "./status";
import { TimezoneContext } from "./time";

type User = {
  id: string;
  discordId: string;
  username: string;
  avatar: string | null;
  timezone: string;
  reminderMinutes: number;
  status: UserStatus;
};

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
    <div style={{ padding: 24 }}>
      <h1>Discord Scheduler!</h1>
      {user ? (
  <div>
    {user.avatar && (
      <img
        src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`}
        alt="avatar"
        width={64}
        height={64}
        style={{ borderRadius: "50%" }}
      />
    )}
    <p>Logged in as <strong>{user.username}</strong></p>
    <button onClick={logout}>Log out</button>
    <TimezoneContext.Provider value={user.timezone}>
      <MyStatus current={user.status} onSaved={(status) => setUser({ ...user, status })} />
      <Settings settings={user} onSaved={(s) => setUser({ ...user, ...s })} />
      <Availability />
      <Groups />
    </TimezoneContext.Provider>
  </div>
) : (
  <a href="/auth/discord">Login with Discord</a>
)}
    </div>
  );
}

export default App;