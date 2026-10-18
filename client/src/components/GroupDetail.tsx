import { useEffect, useState } from "react";
import GroupEvents, { type EventPrefill } from "./GroupEvents";
import MeetingChannels, { type MeetingChannel } from "./MeetingChannels";

const CATEGORIES = ["ALL", "GAMING", "STUDYING", "TALKING", "MOVIE", "OTHER"];

type Member = {
  userId: string;
  user: { username: string };
};
type Block = {
  id: string;
  userId: string;
  category: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
};
export type GroupDetailData = {
  id: string;
  name: string;
  inviteCode: string;
  type: "CUSTOM" | "DISCORD_SERVER";
  discordGuildId: string | null;
  role: "OWNER" | "MEMBER";
  members: Member[];
  blocks: Block[];
};
type OverlapWindow = { startsAt: string; endsAt: string };
type MeetingInfo = { channels: MeetingChannel[]; canManage: boolean };

function fetchMeetingInfo(groupId: string): Promise<MeetingInfo | null> {
  return fetch(`/api/groups/${groupId}/meeting-channels`).then((res) => (res.ok ? res.json() : null));
}

function formatDuration(ms: number) {
  const totalMinutes = Math.round(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export default function GroupDetail({ group }: { group: GroupDetailData }) {
  const [filter, setFilter] = useState("ALL");

  const [overlapCategory, setOverlapCategory] = useState("ALL");
  const [minMinutes, setMinMinutes] = useState("30");
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(group.members.map((m) => m.userId))
  );
  const [windows, setWindows] = useState<OverlapWindow[] | null>(null);
  const [overlapError, setOverlapError] = useState("");
  const [searching, setSearching] = useState(false);
  const [prefill, setPrefill] = useState<EventPrefill | null>(null);

  const isServerGroup = group.type === "DISCORD_SERVER";
  const [meeting, setMeeting] = useState<MeetingInfo | null>(null);

  useEffect(() => {
    if (isServerGroup) fetchMeetingInfo(group.id).then(setMeeting);
  }, [group.id, isServerGroup]);

  async function reloadMeeting() {
    setMeeting(await fetchMeetingInfo(group.id));
  }

  // Send an overlap window to the Create event form
  function prefillFromWindow(w: OverlapWindow) {
    setPrefill((prev) => ({
      nonce: (prev?.nonce ?? 0) + 1,
      startsAt: w.startsAt,
      endsAt: w.endsAt,
      category: overlapCategory === "ALL" ? undefined : overlapCategory,
    }));
    requestAnimationFrame(() =>
      document.getElementById("create-event")?.scrollIntoView({ behavior: "smooth" })
    );
  }

  function toggleMember(userId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function findOverlap() {
    setOverlapError("");
    setWindows(null);
    if (checked.size === 0) {
      setOverlapError("Select at least one member");
      return;
    }
    const params = new URLSearchParams({
      category: overlapCategory,
      minMinutes,
      userIds: [...checked].join(","),
    });
    setSearching(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/overlaps?${params}`);
      if (!res.ok) {
        setOverlapError((await res.json()).error ?? "Could not find overlap");
        return;
      }
      setWindows(await res.json());
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <h3>
        {group.name}
        {isServerGroup && <small> (Discord server)</small>}
      </h3>

      {meeting?.canManage && (
        <MeetingChannels groupId={group.id} channels={meeting.channels} onChange={reloadMeeting} />
      )}

      <section style={{ marginTop: 12, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
        <h4 style={{ marginTop: 0 }}>Find overlap</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            Category:{" "}
            <select value={overlapCategory} onChange={(e) => setOverlapCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Minimum minutes:{" "}
            <input
              type="number"
              min={1}
              step={1}
              value={minMinutes}
              onChange={(e) => setMinMinutes(e.target.value)}
              style={{ width: 80 }}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
          {group.members.map((m) => (
            <label key={m.userId}>
              <input
                type="checkbox"
                checked={checked.has(m.userId)}
                onChange={() => toggleMember(m.userId)}
              />{" "}
              {m.user.username}
            </label>
          ))}
        </div>
        <button onClick={findOverlap} disabled={searching} style={{ marginTop: 8 }}>
          {searching ? "Searching..." : "Find overlap"}
        </button>
        {overlapError && <p style={{ color: "red" }}>{overlapError}</p>}
        {windows && windows.length === 0 && <p>No shared time found</p>}
        {windows && windows.length > 0 && (
          <ul>
            {windows.map((w) => (
              <li key={w.startsAt}>
                {new Date(w.startsAt).toLocaleString()} to {new Date(w.endsAt).toLocaleString()} (
                {formatDuration(new Date(w.endsAt).getTime() - new Date(w.startsAt).getTime())}){" "}
                <button onClick={() => prefillFromWindow(w)}>Create event</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <GroupEvents
        groupId={group.id}
        prefill={prefill}
        meetingChannels={isServerGroup ? (meeting?.channels ?? []) : null}
      />

      <h4>Member availability</h4>
      <label>
        Category:{" "}
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      {group.members.map((m) => {
        const memberBlocks = group.blocks.filter(
          (b) => b.userId === m.userId && (filter === "ALL" || b.category === filter)
        );
        return (
          <div key={m.userId} style={{ marginTop: 12 }}>
            <strong>{m.user.username}</strong>
            {memberBlocks.length === 0 && <div>No availability listed</div>}
            <ul>
              {memberBlocks.map((b) => (
                <li key={b.id}>
                  {b.category}: {new Date(b.startsAt).toLocaleString()} to{" "}
                  {new Date(b.endsAt).toLocaleString()}
                  {b.note && ` (${b.note})`}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
