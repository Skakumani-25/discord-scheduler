import { useState } from "react";
import StatusBadge from "./components/StatusBadge";
import { STATUS_OPTIONS, type StatusValue, type UserStatus } from "./status";
import { isoToZonedInput, useTimezone, zonedInputToIso } from "./time";

const EXPIRY_OPTIONS = [
  { value: "never", label: "Don't clear" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "240", label: "4 hours" },
  { value: "today", label: "End of today" },
];

function expiryToIso(choice: string, tz: string): string | null {
  if (choice === "never") return null;
  const now = new Date();
  if (choice === "today") {
    const today = isoToZonedInput(now.toISOString(), tz).slice(0, 10);
    return zonedInputToIso(`${today}T23:59`, tz);
  }
  return new Date(now.getTime() + Number(choice) * 60_000).toISOString();
}

// A status everyone in your groups can see, no time block needed
export default function MyStatus({
  current,
  onSaved,
}: {
  current: UserStatus;
  onSaved: (status: UserStatus) => void;
}) {
  const tz = useTimezone();
  const [status, setStatus] = useState<StatusValue>(current?.status ?? "AVAILABLE");
  const [note, setNote] = useState(current?.note ?? "");
  const [expiry, setExpiry] = useState("never");
  const [error, setError] = useState("");

  async function save(body: object) {
    setError("");
    const res = await fetch("/api/me/status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not update status");
      return;
    }
    onSaved(data.status);
  }

  return (
    <section style={{ marginTop: 16, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <h3 style={{ marginTop: 0 }}>My status</h3>
      <p style={{ marginTop: 0 }}>
        {current ? (
          <>
            Showing to your groups: <StatusBadge status={current} />
          </>
        ) : (
          "No status set. Members of your groups see only your time blocks."
        )}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusValue)}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Note (optional), e.g. free after 8"
          maxLength={100}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <label>
          Clear after:{" "}
          <select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => save({ status, note, expiresAt: expiryToIso(expiry, tz) })}>Set status</button>
        {current && <button onClick={() => save({ status: null })}>Clear</button>}
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </section>
  );
}
