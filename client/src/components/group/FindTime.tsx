import { useEffect, useId, useState } from "react";
import { CalendarPlus, CalendarSearch, CircleAlert, Search } from "lucide-react";
import { api, errorMessage } from "../../api";
import { CATEGORIES, CATEGORY_INFO } from "../../categories";
import { userAvatarUrl } from "../../discord";
import { formatDuration, formatRange, useTimezone } from "../../time";
import type { Presence } from "../../status";
import { PresenceDot } from "../PresenceDot";
import StatusBadge from "../StatusBadge";
import Alert from "../ui/Alert";
import Avatar from "../ui/Avatar";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Field from "../ui/Field";
import { EmptyState } from "../ui/States";
import GroupCalendar from "./GroupCalendar";
import type { GroupDetailData, Member, OverlapWindow } from "./types";

const DEFAULT_MIN_MINUTES = "30";

export default function FindTime({
  group,
  presenceOf,
  onCreateSession,
}: {
  group: GroupDetailData;
  presenceOf: (m: Member) => Presence | null;
  onCreateSession: (w: OverlapWindow, category?: string) => void;
}) {
  const tz = useTimezone();
  const membersLegend = useId();
  const [category, setCategory] = useState("ALL");
  const [minMinutes, setMinMinutes] = useState(DEFAULT_MIN_MINUTES);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(group.members.map((m) => m.userId)));
  const [windows, setWindows] = useState<OverlapWindow[] | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ members?: string; minMinutes?: string }>({});
  // Category last searched for, used when turning a window into a session
  const [searchedCategory, setSearchedCategory] = useState("ALL");

  // Everyone, any category, 30+ minutes: shown on the calendar as soon as the tab opens
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ category: "ALL", minMinutes: DEFAULT_MIN_MINUTES });
    api<OverlapWindow[]>(`/api/groups/${group.id}/overlaps?${params}`).then(
      (data) => !cancelled && setWindows(data),
      (err) => !cancelled && setError(errorMessage(err))
    );
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  function toggle(userId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function search() {
    const minutes = Number(minMinutes);
    const next: typeof fieldErrors = {};
    if (checked.size === 0) next.members = "Select at least one member.";
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10080)
      next.minMinutes = "Enter a whole number of minutes from 1 to 10080.";
    setFieldErrors(next);
    if (Object.keys(next).length) return;

    setError("");
    const params = new URLSearchParams({ category, minMinutes, userIds: [...checked].join(",") });
    try {
      setWindows(await api<OverlapWindow[]>(`/api/groups/${group.id}/overlaps?${params}`));
      setSearchedCategory(category);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const sessionCategory = searchedCategory === "ALL" ? undefined : searchedCategory;

  return (
    <div className="page-stack">
      <Card
        title="Find shared free time"
        description="Windows where every selected member has availability. Times are in your timezone."
      >
        <form className="stack" onSubmit={(e) => e.preventDefault()}>
          <fieldset className="fieldset" aria-describedby={fieldErrors.members ? `${membersLegend}-error` : undefined}>
            <legend id={membersLegend}>Who needs to be free</legend>
            <div className="chip-list">
              {group.members.map((m) => (
                <label key={m.userId} className="member-chip">
                  <input type="checkbox" checked={checked.has(m.userId)} onChange={() => toggle(m.userId)} />
                  <Avatar
                    src={userAvatarUrl(m.user.discordId, m.user.avatar, 48)}
                    name={m.user.username}
                    size={22}
                    badge={presenceOf(m) && <PresenceDot presence={presenceOf(m)} size={8} />}
                  />
                  <span className="truncate">{m.user.username}</span>
                  <StatusBadge status={m.user.status} compact />
                </label>
              ))}
            </div>
            <div className="cluster chip-actions">
              <Button variant="ghost" size="sm" onClick={() => setChecked(new Set(group.members.map((m) => m.userId)))}>
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setChecked(new Set())}>
                Clear
              </Button>
            </div>
            {fieldErrors.members && (
              <span id={`${membersLegend}-error`} className="field-error" role="alert">
                <CircleAlert size={13} aria-hidden />
                {fieldErrors.members}
              </span>
            )}
          </fieldset>
          <div className="form-row">
            <Field label="Category">
              {(props) => (
                <select {...props} className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="ALL">Any category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_INFO[c].label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Minimum length" hint="In minutes" error={fieldErrors.minMinutes}>
              {(props) => (
                <input
                  {...props}
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10080}
                  step={15}
                  value={minMinutes}
                  onChange={(e) => setMinMinutes(e.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="form-actions">
            <Button type="submit" variant="primary" icon={Search} onClick={search}>
              Find shared time
            </Button>
          </div>
        </form>

        <div className="results">
          {error && <Alert tone="danger" title="Couldn't search for shared time">{error}</Alert>}
          {!error && windows && windows.length === 0 && (
            <EmptyState icon={CalendarSearch} title="No shared time found" compact>
              Try a shorter minimum length, another category, or fewer members. Members need upcoming availability
              for a window to appear.
            </EmptyState>
          )}
          {!error && windows && windows.length > 0 && (
            <>
              <h3 className="results-title">
                {windows.length} shared window{windows.length === 1 ? "" : "s"}
              </h3>
              <ul className="list">
                {windows.map((w) => (
                  <li key={w.startsAt} className="list-row">
                    <div className="list-row-main">
                      <div className="list-row-title">{formatRange(w.startsAt, w.endsAt, tz)}</div>
                    </div>
                    <Badge>{formatDuration(Date.parse(w.endsAt) - Date.parse(w.startsAt))}</Badge>
                    <Button size="sm" icon={CalendarPlus} onClick={() => onCreateSession(w, sessionCategory)}>
                      Create session
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Card>

      <GroupCalendar
        members={group.members}
        blocks={group.blocks}
        windows={windows ?? []}
        onWindowClick={(w) => onCreateSession(w, sessionCategory)}
      />
    </div>
  );
}
