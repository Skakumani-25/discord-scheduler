import { useMemo, useState } from "react";
import { browserTimeZone, listTimeZones } from "./time";

export type UserSettings = { timezone: string; reminderMinutes: number };

const LEAD_TIMES = [0, 5, 10, 15, 30, 60, 120, 1440];

function leadTimeLabel(minutes: number) {
  if (minutes === 0) return "At start time";
  if (minutes % 1440 === 0) return `${minutes / 1440} day before`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"} before`;
  return `${minutes} minutes before`;
}

export default function Settings({
  settings,
  onSaved,
}: {
  settings: UserSettings;
  onSaved: (s: UserSettings) => void;
}) {
  const browserTz = browserTimeZone();
  const zones = useMemo(() => listTimeZones(), []);
  // "UTC" is the account default, so suggest the browser's zone until the user picks one
  const [timezone, setTimezone] = useState(settings.timezone === "UTC" ? browserTz : settings.timezone);
  const [reminderMinutes, setReminderMinutes] = useState(settings.reminderMinutes);
  const [status, setStatus] = useState("");

  const leadTimes = LEAD_TIMES.includes(reminderMinutes) ? LEAD_TIMES : [...LEAD_TIMES, reminderMinutes].sort((a, b) => a - b);
  const dirty = timezone !== settings.timezone || reminderMinutes !== settings.reminderMinutes;

  async function save() {
    setStatus("");
    const res = await fetch("/api/me/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone, reminderMinutes }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(body.error ?? "Could not save settings");
      return;
    }
    onSaved({ timezone: body.timezone, reminderMinutes: body.reminderMinutes });
    setStatus("Saved");
  }

  return (
    <section style={{ marginTop: 16, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <h3 style={{ marginTop: 0 }}>Settings</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label>
          Timezone:{" "}
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
                {z === browserTz ? " (this device)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Remind me:{" "}
          <select value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value))}>
            {leadTimes.map((m) => (
              <option key={m} value={m}>
                {leadTimeLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <button onClick={save} disabled={!dirty}>
          Save
        </button>
        {status && <span>{status}</span>}
      </div>
      {settings.timezone === "UTC" && browserTz !== "UTC" && (
        <p style={{ margin: "8px 0 0" }}>
          Times are shown in UTC until you save a timezone. Your device is set to {browserTz}.
        </p>
      )}
    </section>
  );
}
