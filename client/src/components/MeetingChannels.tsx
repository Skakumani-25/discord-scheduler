import { useEffect, useState } from "react";

export type MeetingChannel = { channelId: string; label: string };
type VoiceChannel = { id: string; name: string };

// Admin-only picker for which voice channels events in this server group can use
export default function MeetingChannels({
  groupId,
  channels,
  onChange,
}: {
  groupId: string;
  channels: MeetingChannel[];
  onChange: () => void;
}) {
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannel[] | null>(null);
  const [selected, setSelected] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/groups/${groupId}/voice-channels`)
      .then(async (res) => {
        if (res.ok) return res.json();
        setError((await res.json().catch(() => ({}))).error ?? "Could not load voice channels");
        return [];
      })
      .then(setVoiceChannels);
  }, [groupId]);

  const available = (voiceChannels ?? []).filter((v) => !channels.some((c) => c.channelId === v.id));

  async function add() {
    setError("");
    const res = await fetch(`/api/groups/${groupId}/meeting-channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: selected, label }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not add channel");
      return;
    }
    setSelected("");
    setLabel("");
    onChange();
  }

  async function remove(channelId: string) {
    setError("");
    const res = await fetch(`/api/groups/${groupId}/meeting-channels/${channelId}`, { method: "DELETE" });
    if (!res.ok) setError((await res.json()).error ?? "Could not remove channel");
    onChange();
  }

  return (
    <section style={{ marginTop: 12, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <h4 style={{ marginTop: 0 }}>Meeting channels</h4>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {channels.length === 0 && <p>No meeting channels yet.</p>}
      <ul>
        {channels.map((c) => (
          <li key={c.channelId}>
            🔊 {c.label} <button onClick={() => remove(c.channelId)}>Remove</button>
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} disabled={!voiceChannels}>
          <option value="">{voiceChannels ? "Pick a voice channel" : "Loading..."}</option>
          {available.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Label (optional)"
          maxLength={100}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button onClick={add} disabled={!selected}>
          Add
        </button>
      </div>
    </section>
  );
}
