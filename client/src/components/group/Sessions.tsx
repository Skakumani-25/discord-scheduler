import { useId, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  CircleHelp,
  ExternalLink,
  Plus,
  Trash2,
  Users,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import { api, errorMessage, useResource } from "../../api";
import { CATEGORIES, CATEGORY_INFO, categoryInfo } from "../../categories";
import { channelUrl } from "../../discord";
import { formatRange, inputZoneLabel, isoToZonedInput, useTimezone, zonedInputToIso } from "../../time";
import { useNow } from "../../useNow";
import Alert from "../ui/Alert";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import Field from "../ui/Field";
import { EmptyState, ErrorState, SkeletonRows } from "../ui/States";
import { useToast } from "../ui/toast-context";
import type { MeetingChannel, SessionPrefill } from "./types";

type RsvpStatus = "GOING" | "MAYBE" | "NOT_GOING";
type Session = {
  id: string;
  title: string;
  category: string;
  startsAt: string;
  endsAt: string;
  description: string | null;
  voiceChannelId: string | null;
  creator: { id: string; username: string };
  counts: Record<RsvpStatus, number>;
  myStatus: RsvpStatus | null;
  canDelete: boolean;
};

const RSVP_OPTIONS: { status: RsvpStatus; label: string; icon: LucideIcon; tone: string }[] = [
  { status: "GOING", label: "Going", icon: Check, tone: "success" },
  { status: "MAYBE", label: "Maybe", icon: CircleHelp, tone: "warning" },
  { status: "NOT_GOING", label: "Can't go", icon: X, tone: "danger" },
];

function SessionCard({
  session,
  guildId,
  meetingChannels,
  now,
  onRsvp,
  onDelete,
}: {
  session: Session;
  guildId: string | null;
  meetingChannels: MeetingChannel[] | null;
  now: number;
  onRsvp: (status: RsvpStatus) => Promise<void>;
  onDelete: () => void;
}) {
  const tz = useTimezone();
  const rsvpLabel = useId();
  const [pending, setPending] = useState<RsvpStatus | null>(null);
  const info = categoryInfo(session.category);
  const Icon = info.icon;
  const live = Date.parse(session.startsAt) <= now && now < Date.parse(session.endsAt);
  const channel = session.voiceChannelId
    ? meetingChannels?.find((c) => c.channelId === session.voiceChannelId)
    : null;

  async function rsvp(status: RsvpStatus) {
    setPending(status);
    try {
      await onRsvp(status);
    } finally {
      setPending(null);
    }
  }

  return (
    <article className="session-card" aria-labelledby={`${session.id}-title`}>
      <div className="session-main">
        <span className="session-icon" style={{ background: info.color, color: info.text }} title={info.label}>
          <Icon size={18} aria-hidden />
        </span>
        <div className="session-body">
          <div className="session-heading">
            <h3 id={`${session.id}-title`} className="break-words">
              {session.title}
            </h3>
            {live && (
              <Badge tone="success" icon={CalendarClock}>
                Happening now
              </Badge>
            )}
          </div>
          <ul className="session-meta">
            <li>
              <CalendarDays size={15} aria-hidden />
              <span>{formatRange(session.startsAt, session.endsAt, tz)}</span>
            </li>
            {session.voiceChannelId && (
              <li className="wrap">
                <Volume2 size={15} aria-hidden />
                <span className="break-words">{channel?.label ?? "Voice channel"}</span>
                {guildId && (
                  <a href={channelUrl(guildId, session.voiceChannelId)} target="_blank" rel="noreferrer" className="inline-link">
                    Open in Discord
                    <ExternalLink size={12} aria-hidden />
                    <span className="visually-hidden">(opens in a new tab)</span>
                  </a>
                )}
              </li>
            )}
            <li>
              <Users size={15} aria-hidden />
              <span>
                {session.counts.GOING} going · {session.counts.MAYBE} maybe · {session.counts.NOT_GOING} can't go
              </span>
            </li>
          </ul>
          {session.description && <p className="session-description break-words">{session.description}</p>}
          <p className="subtle">
            {info.label} · Created by <span className="break-words">{session.creator.username}</span>
          </p>
        </div>
      </div>
      <div className="session-actions">
        <div className="cluster">
          <span id={rsvpLabel} className="subtle">
            Your RSVP
          </span>
          <div className="segmented" role="group" aria-labelledby={rsvpLabel}>
            {RSVP_OPTIONS.map(({ status, label, icon: OptionIcon, tone }) => (
              <button
                key={status}
                type="button"
                className={`segment tone-${tone}`}
                aria-pressed={session.myStatus === status}
                disabled={pending !== null}
                onClick={() => rsvp(status)}
              >
                <OptionIcon size={14} aria-hidden className={pending === status ? "spin" : undefined} />
                {label}
              </button>
            ))}
          </div>
        </div>
        {session.canDelete && (
          <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </article>
  );
}

function CreateSessionForm({
  groupId,
  prefill,
  meetingChannels,
  isServerGroup,
  onCreated,
  onCancel,
}: {
  groupId: string;
  prefill: SessionPrefill | null;
  meetingChannels: MeetingChannel[] | null;
  isServerGroup: boolean;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const tz = useTimezone();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(prefill?.category ?? "GAMING");
  // Round the start up so a window clipped to "now" doesn't land in the past
  const [start, setStart] = useState(prefill ? isoToZonedInput(prefill.startsAt, tz, "up") : "");
  const [end, setEnd] = useState(prefill ? isoToZonedInput(prefill.endsAt, tz, "down") : "");
  const [description, setDescription] = useState("");
  const [voiceChannelId, setVoiceChannelId] = useState("");
  const [errors, setErrors] = useState<{ title?: string; start?: string; end?: string }>({});
  const [error, setError] = useState("");

  async function create() {
    setError("");
    const startIso = zonedInputToIso(start, tz);
    const endIso = zonedInputToIso(end, tz);
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Give the session a name.";
    if (!startIso) next.start = "Choose when it starts.";
    else if (Date.parse(startIso) <= Date.now()) next.start = "The start time has already passed.";
    if (!endIso) next.end = "Choose when it ends.";
    else if (startIso && Date.parse(endIso) <= Date.parse(startIso)) next.end = "End time must be after the start.";
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      await api(`/api/groups/${groupId}/events`, {
        method: "POST",
        body: {
          title: title.trim(),
          category,
          startsAt: startIso,
          endsAt: endIso,
          description,
          voiceChannelId: voiceChannelId || undefined,
        },
      });
      onCreated();
    } catch (err) {
      // Everything entered stays in the form so it can be fixed and resubmitted
      setError(errorMessage(err));
    }
  }

  return (
    <form id="create-session" className="card create-session" onSubmit={(e) => e.preventDefault()}>
      <div className="card-header">
        <div className="card-heading">
          <h3 className="card-title">New session</h3>
          {prefill && <p className="card-description">Times filled in from the shared free time you picked.</p>}
        </div>
      </div>
      <div className="stack">
        <div className="form-row">
          <Field label="Session name" required error={errors.title}>
            {(props) => (
              <input
                {...props}
                className="input"
                maxLength={100}
                placeholder="e.g. Ranked night"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            )}
          </Field>
          <Field label="Category">
            {(props) => (
              <select {...props} className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_INFO[c].label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div className="form-row">
          <Field label="Starts" required error={errors.start}>
            {(props) => (
              <input {...props} className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            )}
          </Field>
          <Field label="Ends" required error={errors.end} hint={`Times in ${inputZoneLabel(start || end, tz)}`}>
            {(props) => (
              <input {...props} className="input" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            )}
          </Field>
        </div>
        {isServerGroup && (
          <Field
            label="Voice channel"
            optional
            hint={
              meetingChannels && meetingChannels.length > 0
                ? "Shown on the session and in reminders."
                : "No meeting channels yet. A server manager can add them in this group's Settings tab."
            }
          >
            {(props) => (
              <select
                {...props}
                className="select"
                value={voiceChannelId}
                onChange={(e) => setVoiceChannelId(e.target.value)}
                disabled={!meetingChannels || meetingChannels.length === 0}
              >
                <option value="">No voice channel</option>
                {(meetingChannels ?? []).map((c) => (
                  <option key={c.channelId} value={c.channelId}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field label="Description" optional>
          {(props) => (
            <textarea
              {...props}
              className="textarea"
              rows={3}
              placeholder="What's the plan?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        {error && <Alert tone="danger" title="Couldn't create the session">{error}</Alert>}
        <div className="form-actions">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon={CalendarPlus} onClick={create}>
            Create session
          </Button>
        </div>
      </div>
    </form>
  );
}

export default function Sessions({
  groupId,
  guildId,
  isServerGroup,
  meetingChannels,
  prefill,
  onPrefillUsed,
}: {
  groupId: string;
  guildId: string | null;
  isServerGroup: boolean;
  meetingChannels: MeetingChannel[] | null;
  prefill: SessionPrefill | null;
  onPrefillUsed: () => void;
}) {
  const toast = useToast();
  const now = useNow();
  const { data, error, loading, reload } = useResource<Session[]>(`/api/groups/${groupId}/events`);
  // A prefill (from "Create session" on shared free time) opens the form straight away
  const [formOpen, setFormOpen] = useState(!!prefill);
  const [toDelete, setToDelete] = useState<Session | null>(null);

  function closeForm() {
    setFormOpen(false);
    onPrefillUsed();
  }

  async function rsvp(session: Session, status: RsvpStatus) {
    try {
      await api(`/api/events/${session.id}/rsvp`, { method: "PUT", body: { status } });
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await api(`/api/events/${toDelete.id}`, { method: "DELETE" });
      toast.success(`Deleted "${toDelete.title}"`);
      setToDelete(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      setToDelete(null);
    }
  }

  let list;
  if (loading && !data) list = <SkeletonRows rows={2} height={150} />;
  else if (error) list = <ErrorState title="Couldn't load sessions" message={error.message} onRetry={reload} />;
  else if (data && data.length === 0)
    list = (
      <div className="card">
        {/* The page's "New session" button above is the action, so it isn't repeated here */}
        <EmptyState icon={CalendarDays} title="No upcoming sessions">
          Use New session to schedule one, or Find a time to see when everyone is free.
        </EmptyState>
      </div>
    );
  else if (data)
    list = (
      <div className="stack">
        {data.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            guildId={guildId}
            meetingChannels={meetingChannels}
            now={now}
            onRsvp={(status) => rsvp(s, status)}
            onDelete={() => setToDelete(s)}
          />
        ))}
      </div>
    );

  return (
    <div className="stack">
      <div className="cluster-between">
        <h2 className="section-title">Upcoming sessions</h2>
        {!formOpen && (
          <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
            New session
          </Button>
        )}
      </div>

      {formOpen && (
        <CreateSessionForm
          key={prefill?.nonce ?? 0}
          groupId={groupId}
          prefill={prefill}
          meetingChannels={meetingChannels}
          isServerGroup={isServerGroup}
          onCancel={closeForm}
          onCreated={() => {
            toast.success("Session created. Everyone in the group can now RSVP.");
            closeForm();
            reload();
          }}
        />
      )}

      {list}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this session?"
        confirmLabel="Delete session"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      >
        {toDelete && (
          <>
            "{toDelete.title}" and everyone's RSVPs and reminders for it will be removed. This can't be undone.
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
