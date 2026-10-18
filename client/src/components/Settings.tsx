import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { api, errorMessage } from "../api";
import { browserTimeZone, listTimeZones } from "../time";
import Alert from "./ui/Alert";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Field from "./ui/Field";
import { useToast } from "./ui/toast-context";

export type UserSettings = { timezone: string; reminderMinutes: number; showPresence: boolean };

const LEAD_TIMES = [0, 5, 10, 15, 30, 60, 120, 1440];

function leadTimeLabel(minutes: number) {
  if (minutes === 0) return "When the session starts";
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
  const toast = useToast();
  const browserTz = browserTimeZone();
  const zones = useMemo(() => listTimeZones(), []);
  // "UTC" is the account default, so suggest the browser's zone until the user picks one
  const [timezone, setTimezone] = useState(settings.timezone === "UTC" ? browserTz : settings.timezone);
  const [reminderMinutes, setReminderMinutes] = useState(settings.reminderMinutes);
  const [showPresence, setShowPresence] = useState(settings.showPresence);
  const [error, setError] = useState("");

  const leadTimes = LEAD_TIMES.includes(reminderMinutes)
    ? LEAD_TIMES
    : [...LEAD_TIMES, reminderMinutes].sort((a, b) => a - b);
  const dirty =
    timezone !== settings.timezone ||
    reminderMinutes !== settings.reminderMinutes ||
    showPresence !== settings.showPresence;

  async function save() {
    setError("");
    try {
      const body = await api<UserSettings>("/api/me/settings", {
        method: "PUT",
        body: { timezone, reminderMinutes, showPresence },
      });
      onSaved({ timezone: body.timezone, reminderMinutes: body.reminderMinutes, showPresence: body.showPresence });
      toast.success("Settings saved");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card title="Preferences" description="These apply everywhere in the app and to bot reminders.">
      <form className="stack" onSubmit={(e) => e.preventDefault()}>
        {settings.timezone === "UTC" && browserTz !== "UTC" && (
          <Alert tone="info" title="Times are shown in UTC">
            Your device is set to {browserTz}. Save it below so times match your clock.
          </Alert>
        )}
        <div className="form-row">
          <Field label="Timezone" hint="Every time in the app is shown in this zone.">
            {(props) => (
              <select {...props} className="select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, " ")}
                    {z === browserTz ? " (this device)" : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Session reminders" hint="Sent by the bot as a Discord DM.">
            {(props) => (
              <select
                {...props}
                className="select"
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(Number(e.target.value))}
              >
                {leadTimes.map((m) => (
                  <option key={m} value={m}>
                    {leadTimeLabel(m)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div className="stack-sm">
          <label className="checkbox">
            <input type="checkbox" checked={showPresence} onChange={(e) => setShowPresence(e.target.checked)} />
            Show my Discord status to my groups
          </label>
          <span className="field-hint">
            Members of your groups see whether you're online, idle, on do not disturb or offline in Discord.
          </span>
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="form-actions">
          <Button type="submit" variant="primary" icon={Save} onClick={save} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}
