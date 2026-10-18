import { useEffect, useState } from "react";

const CATEGORIES = ["GAMING", "STUDYING", "TALKING", "MOVIE", "OTHER"];

type RsvpStatus = "GOING" | "MAYBE" | "NOT_GOING";
type GroupEvent = {
  id: string;
  title: string;
  category: string;
  startsAt: string;
  endsAt: string;
  description: string | null;
  creator: { id: string; username: string };
  counts: Record<RsvpStatus, number>;
  myStatus: RsvpStatus | null;
  canDelete: boolean;
};
export type EventPrefill = {
  // Changes on every prefill so the form remounts with the new values
  nonce: number;
  startsAt: string;
  endsAt: string;
  category?: string;
};

const RSVP_BUTTONS: { status: RsvpStatus; label: string }[] = [
  { status: "GOING", label: "Going" },
  { status: "MAYBE", label: "Maybe" },
  { status: "NOT_GOING", label: "Can't go" },
];

// ISO -> value for <input type="datetime-local"> in the browser's timezone
function toLocalInput(iso: string, roundUp: boolean) {
  const minute = 60_000;
  const ms = new Date(iso).getTime();
  const rounded = roundUp ? Math.ceil(ms / minute) * minute : Math.floor(ms / minute) * minute;
  const d = new Date(rounded);
  return new Date(rounded - d.getTimezoneOffset() * minute).toISOString().slice(0, 16);
}

function CreateEventForm({
  groupId,
  prefill,
  onCreated,
}: {
  groupId: string;
  prefill: EventPrefill | null;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(prefill?.category ?? "GAMING");
  // Round the start up so a window clipped to "now" doesn't land in the past
  const [start, setStart] = useState(prefill ? toLocalInput(prefill.startsAt, true) : "");
  const [end, setEnd] = useState(prefill ? toLocalInput(prefill.endsAt, false) : "");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function create() {
    setError("");
    const res = await fetch(`/api/groups/${groupId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        category,
        startsAt: start ? new Date(start).toISOString() : "",
        endsAt: end ? new Date(end).toISOString() : "",
        description,
      }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not create event");
      return;
    }
    setTitle("");
    setDescription("");
    onCreated();
  }

  return (
    <div id="create-event" style={{ marginTop: 12 }}>
      <h5 style={{ margin: "8px 0" }}>Create event</h5>
      {prefill && <p style={{ margin: "4px 0" }}>Times prefilled from the overlap finder.</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input placeholder="Title" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button onClick={create}>Create</button>
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default function GroupEvents({
  groupId,
  prefill,
}: {
  groupId: string;
  prefill: EventPrefill | null;
}) {
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [error, setError] = useState("");

  function reload() {
    return fetch(`/api/groups/${groupId}/events`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setEvents);
  }

  useEffect(() => {
    fetch(`/api/groups/${groupId}/events`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setEvents);
  }, [groupId]);

  async function rsvp(eventId: string, status: RsvpStatus) {
    setError("");
    const res = await fetch(`/api/events/${eventId}/rsvp`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) setError((await res.json()).error ?? "Could not update RSVP");
    reload();
  }

  async function remove(eventId: string) {
    setError("");
    const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    if (!res.ok) setError((await res.json()).error ?? "Could not delete event");
    reload();
  }

  return (
    <section style={{ marginTop: 12, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <h4 style={{ marginTop: 0 }}>Events</h4>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {events.length === 0 && <p>No upcoming events</p>}
      <ul>
        {events.map((ev) => (
          <li key={ev.id} style={{ marginBottom: 8 }}>
            <strong>{ev.title}</strong> ({ev.category})
            <div>
              {new Date(ev.startsAt).toLocaleString()} to {new Date(ev.endsAt).toLocaleString()}
            </div>
            {ev.description && <div>{ev.description}</div>}
            <div>
              {ev.counts.GOING} going, {ev.counts.MAYBE} maybe, {ev.counts.NOT_GOING} can't go
              {" · "}created by {ev.creator.username}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              {RSVP_BUTTONS.map((b) => {
                const active = ev.myStatus === b.status;
                return (
                  <button
                    key={b.status}
                    onClick={() => rsvp(ev.id, b.status)}
                    aria-pressed={active}
                    style={active ? { background: "#5865f2", color: "white", fontWeight: "bold" } : undefined}
                  >
                    {b.label}
                  </button>
                );
              })}
              {ev.canDelete && <button onClick={() => remove(ev.id)}>Delete</button>}
            </div>
          </li>
        ))}
      </ul>

      <CreateEventForm key={prefill?.nonce ?? 0} groupId={groupId} prefill={prefill} onCreated={reload} />
    </section>
  );
}
