import { LogOut } from "lucide-react";
import Settings from "../components/Settings";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import { useToast } from "../components/ui/toast-context";
import { errorMessage } from "../api";
import { userAvatarUrl } from "../discord";
import type { User } from "../types";

export default function SettingsPage({
  user,
  onUserChange,
  onLogout,
}: {
  user: User;
  onUserChange: (u: User) => void;
  onLogout: () => Promise<void>;
}) {
  const toast = useToast();

  return (
    <>
      <PageHeader title="Settings" description="Your timezone, reminders, privacy and account." />
      <div className="page-stack">
        <Settings settings={user} onSaved={(s) => onUserChange({ ...user, ...s })} />
        <Card title="Account">
          <div className="cluster-between">
            <div className="cluster min-w-0">
              <Avatar src={userAvatarUrl(user.discordId, user.avatar, 96)} name={user.username} size={44} />
              <div className="min-w-0">
                <div className="list-row-title truncate">{user.username}</div>
                <div className="subtle">Signed in with Discord</div>
              </div>
            </div>
            <Button
              icon={LogOut}
              onClick={async () => {
                try {
                  await onLogout();
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            >
              Log out
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
