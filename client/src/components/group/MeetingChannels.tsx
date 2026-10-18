import { useState } from "react";
import { Plus, Trash2, Volume2 } from "lucide-react";
import { api, errorMessage, useResource } from "../../api";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Card from "../ui/Card";
import ConfirmDialog from "../ui/ConfirmDialog";
import Field from "../ui/Field";
import { EmptyState } from "../ui/States";
import { useToast } from "../ui/toast-context";
import type { MeetingChannel } from "./types";

type VoiceChannel = { id: string; name: string };

// Group owner or server managers: which voice channels sessions can use
export default function MeetingChannels({
  groupId,
  channels,
  onChange,
}: {
  groupId: string;
  channels: MeetingChannel[];
  onChange: () => void;
}) {
  const toast = useToast();
  const voice = useResource<VoiceChannel[]>(`/api/groups/${groupId}/voice-channels`);
  const [selected, setSelected] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [toRemove, setToRemove] = useState<MeetingChannel | null>(null);

  const available = (voice.data ?? []).filter((v) => !channels.some((c) => c.channelId === v.id));

  async function add() {
    if (!selected) {
      setError("Choose a voice channel to add.");
      return;
    }
    setError("");
    try {
      const created = await api<MeetingChannel>(`/api/groups/${groupId}/meeting-channels`, {
        method: "POST",
        body: { channelId: selected, label },
      });
      setSelected("");
      setLabel("");
      toast.success(`Added ${created.label}`);
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove() {
    if (!toRemove) return;
    try {
      await api(`/api/groups/${groupId}/meeting-channels/${toRemove.channelId}`, { method: "DELETE" });
      toast.success(`Removed ${toRemove.label}`);
      onChange();
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setToRemove(null);
  }

  return (
    <Card title="Meeting channels" description="Voice channels people can pick when they create a session.">
      <div className="stack">
        {channels.length === 0 ? (
          <EmptyState icon={Volume2} title="No meeting channels yet" compact>
            Add a voice channel below so sessions can say where to meet.
          </EmptyState>
        ) : (
          <ul className="list">
            {channels.map((c) => (
              <li key={c.channelId} className="list-row">
                <Volume2 size={18} className="muted" aria-hidden />
                <span className="list-row-main list-row-title break-words">{c.label}</span>
                <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => setToRemove(c)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form className="stack add-channel" onSubmit={(e) => e.preventDefault()}>
          <h3 className="results-title">Add a channel</h3>
          {voice.error && (
            <Alert
              tone={voice.error.status === 503 ? "warning" : "danger"}
              title={voice.error.status === 503 ? "The bot is offline" : "Couldn't load voice channels"}
              action={
                <Button size="sm" onClick={voice.reload}>
                  Try again
                </Button>
              }
            >
              {voice.error.status === 503 ? "Channels can be added once the bot reconnects." : voice.error.message}
            </Alert>
          )}
          <div className="form-row">
            <Field label="Voice channel" required>
              {(props) => (
                <select
                  {...props}
                  className="select"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  disabled={!voice.data}
                >
                  <option value="">
                    {voice.loading && !voice.data
                      ? "Loading channels…"
                      : !voice.data
                        ? "Channels unavailable"
                        : available.length
                          ? "Choose a channel"
                          : "All voice channels added"}
                  </option>
                  {available.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Display name" optional hint="Defaults to the channel name">
              {(props) => (
                <input
                  {...props}
                  className="input"
                  maxLength={100}
                  placeholder="e.g. Raid room"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              )}
            </Field>
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="form-actions">
            <Button type="submit" icon={Plus} onClick={add} disabled={!voice.data}>
              Add channel
            </Button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={!!toRemove}
        title="Remove this meeting channel?"
        confirmLabel="Remove channel"
        onConfirm={remove}
        onCancel={() => setToRemove(null)}
      >
        {toRemove && (
          <>
            New sessions won't be able to use "{toRemove.label}". Existing sessions keep it, and the channel itself
            isn't changed in Discord.
          </>
        )}
      </ConfirmDialog>
    </Card>
  );
}
