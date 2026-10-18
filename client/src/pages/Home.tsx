import Availability from "../components/Availability";
import Groups from "../components/Groups";
import Settings from "../components/Settings";
import MyStatus from "../components/MyStatus";
import type { UserStatus } from "../status";
import { TimezoneContext } from "../time";

export type User = {
  id: string;
  discordId: string;
  username: string;
  avatar: string | null;
  timezone: string;
  reminderMinutes: number;
  showPresence: boolean;
  status: UserStatus;
};

// The logged-in page
export default function Home({
  user,
  onUserChange,
  onLogout,
}: {
  user: User;
  onUserChange: (user: User) => void;
  onLogout: () => void;
}) {
  return (
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
      <p>
        Logged in as <strong>{user.username}</strong>
      </p>
      <button onClick={onLogout}>Log out</button>
      <TimezoneContext.Provider value={user.timezone}>
        <MyStatus current={user.status} onSaved={(status) => onUserChange({ ...user, status })} />
        <Settings settings={user} onSaved={(s) => onUserChange({ ...user, ...s })} />
        <Availability />
        <Groups />
      </TimezoneContext.Provider>
    </div>
  );
}
