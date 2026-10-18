import { useId, useState } from "react";
import { Check, X } from "lucide-react";
import { api, errorMessage } from "../api";
import { STATUS_OPTIONS, type StatusValue, type UserStatus } from "../status";
import { isoToZonedInput, useTimezone, zonedInputToIso } from "../time";
import { useNow } from "../useNow";
import StatusBadge from "./StatusBadge";
import Alert from "./ui/Alert";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Field from "./ui/Field";
import { useToast } from "./ui/toast-context";

const EXPIRY_OPTIONS = [
  { value: "never", label: "Don't clear" },
  { value: "30", label: "After 30 minutes" },
  { value: "60", label: "After 1 hour" },
  { value: "240", label: "After 4 hours" },
  { value: "today", label: "At the end of today" },
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
  const toast = useToast();
  const now = useNow();
  const legendId = useId();
  const [status, setStatus] = useState<StatusValue>(current?.status ?? "AVAILABLE");
  const [note, setNote] = useState(current?.note ?? "");
  const [expiry, setExpiry] = useState("never");
  const [error, setError] = useState("");

  async function save(body: object, message: string) {
    setError("");
    try {
      const data = await api<{ status: UserStatus }>("/api/me/status", { method: "PUT", body });
      onSaved(data.status);
      toast.success(message);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card
      title="Your status"
      description="Shown next to your name in every group you're in. No time block needed."
      actions={
        current && (
          <Button
            variant="ghost"
            size="sm"
            icon={X}
            onClick={() => save({ status: null }, "Status cleared")}
          >
            Clear status
          </Button>
        )
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()}>
        <div className="current-status">
          <span className="subtle">Currently showing</span>
          {current ? <StatusBadge status={current} now={now} /> : <span className="muted">No status</span>}
        </div>

        <fieldset className="fieldset">
          <legend id={legendId}>Status</legend>
          <div className="segmented" role="group" aria-labelledby={legendId}>
            {STATUS_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                className={`segment status-segment status-${value}`}
                aria-pressed={status === value}
                onClick={() => setStatus(value)}
              >
                <Icon size={15} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="form-row">
          <Field label="Note" optional hint="Up to 100 characters">
            {(props) => (
              <input
                {...props}
                className="input"
                maxLength={100}
                placeholder="e.g. free after 8"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </Field>
          <Field label="Clear automatically">
            {(props) => (
              <select {...props} className="select" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="form-actions">
          <Button
            type="submit"
            variant="primary"
            icon={Check}
            onClick={() =>
              save({ status, note, expiresAt: expiryToIso(expiry, tz) }, current ? "Status updated" : "Status set")
            }
          >
            {current ? "Update status" : "Set status"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
