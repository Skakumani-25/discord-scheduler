import { useState } from "react";
import { Save } from "lucide-react";
import { api, errorMessage, useResource } from "../../api";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Field from "../ui/Field";
import { useToast } from "../ui/toast-context";

type TextChannel = { id: string; name: string };

// Owner-only: where new sessions are announced and DM-failed reminders are posted
export default function AnnouncementChannel({ groupId, current }: { groupId: string; current: string | null }) {
  const toast = useToast();
  const { data: channels, error, loading, reload } = useResource<TextChannel[]>(`/api/groups/${groupId}/text-channels`);
  const [selected, setSelected] = useState(current ?? "");
  const [saved, setSaved] = useState(current ?? "");
  const [saveError, setSaveError] = useState("");

  async function save() {
    setSaveError("");
    try {
      await api(`/api/groups/${groupId}/announcement-channel`, {
        method: "PUT",
        body: { channelId: selected || null },
      });
      setSaved(selected);
      toast.success(selected ? "Announcement channel saved" : "Announcements turned off");
    } catch (err) {
      setSaveError(errorMessage(err));
    }
  }

  const savedMissing = saved && channels && !channels.some((c) => c.id === saved);

  return (
    <Card
      title="Announcement channel"
      description="New sessions are posted here. Reminders also go here, with a mention, when someone's DMs are closed."
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()}>
        {error && (
          <Alert
            tone={error.status === 503 ? "warning" : "danger"}
            title={error.status === 503 ? "The bot is offline" : "Couldn't load text channels"}
            action={
              <Button size="sm" onClick={reload}>
                Try again
              </Button>
            }
          >
            {error.status === 503 ? "Channels can be changed once the bot reconnects." : error.message}
          </Alert>
        )}
        <Field
          label="Text channel"
          hint="Only channels the bot can post in are listed."
          error={savedMissing ? "The saved channel no longer exists or the bot lost access to it." : undefined}
        >
          {(props) => (
            <select
              {...props}
              className="select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={loading && !channels}
            >
              <option value="">{loading && !channels ? "Loading channels…" : "None (don't announce)"}</option>
              {savedMissing && <option value={saved}>Unavailable channel</option>}
              {(channels ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        {saveError && <Alert tone="danger">{saveError}</Alert>}
        <div className="form-actions">
          <Button type="submit" variant="primary" icon={Save} onClick={save} disabled={selected === saved}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}
