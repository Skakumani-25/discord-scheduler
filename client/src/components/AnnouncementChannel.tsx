import { useEffect, useState } from "react";

type TextChannel = { id: string; name: string };

// Owner-only: where new events are announced and DM-failed reminders are posted
export default function AnnouncementChannel({
  groupId,
  current,
}: {
  groupId: string;
  current: string | null;
}) {
  const [channels, setChannels] = useState<TextChannel[] | null>(null);
  const [selected, setSelected] = useState(current ?? "");
  const [saved, setSaved] = useState(current ?? "");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch(`/api/groups/${groupId}/text-channels`)
      .then(async (res) => {
        if (res.ok) return res.json();
        setStatus((await res.json().catch(() => ({}))).error ?? "Could not load text channels");
        return [];
      })
      .then(setChannels);
  }, [groupId]);

  async function save() {
    setStatus("");
    const res = await fetch(`/api/groups/${groupId}/announcement-channel`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: selected || null }),
    });
    if (!res.ok) {
      setStatus((await res.json()).error ?? "Could not save");
      return;
    }
    setSaved(selected);
    setStatus("Saved");
  }

  return (
    <section style={{ marginTop: 12, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <h4 style={{ marginTop: 0 }}>Announcement channel</h4>
      <p style={{ marginTop: 0 }}>
        New events are posted here, and reminders go here (with a mention) when someone's DMs are closed.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} disabled={!channels}>
          <option value="">{channels ? "None" : "Loading..."}</option>
          {/* Keep a saved channel selectable even if the bot can no longer see it */}
          {saved && channels && !channels.some((c) => c.id === saved) && (
            <option value={saved}>(unavailable channel)</option>
          )}
          {(channels ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
        <button onClick={save} disabled={selected === saved}>
          Save
        </button>
        {status && <span>{status}</span>}
      </div>
    </section>
  );
}
