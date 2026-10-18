import { useEffect, useState } from "react";
import { CalendarDays, CalendarSearch, Copy, Crown, Server, Settings, Users } from "lucide-react";
import { useResource } from "../api";
import { href } from "../router";
import type { Presence } from "../status";
import AnnouncementChannel from "../components/group/AnnouncementChannel";
import FindTime from "../components/group/FindTime";
import MeetingChannels from "../components/group/MeetingChannels";
import Members from "../components/group/Members";
import Sessions from "../components/group/Sessions";
import type { GroupDetailData, Member, MeetingInfo, OverlapWindow, SessionPrefill } from "../components/group/types";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { EmptyState, ErrorState, SkeletonRows } from "../components/ui/States";
import Tabs, { type TabItem } from "../components/ui/Tabs";
import { useToast } from "../components/ui/toast-context";

type Tab = "sessions" | "find" | "members" | "settings";

function InviteCode({ code }: { code: string }) {
  const toast = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Invite code copied");
    } catch {
      toast.error(`Couldn't copy automatically. The code is ${code}.`);
    }
  }
  return (
    <div className="invite-code">
      <span className="subtle">Invite code</span>
      <code>{code}</code>
      <Button size="sm" variant="ghost" icon={Copy} iconOnly aria-label="Copy invite code" onClick={copy} />
    </div>
  );
}

function GroupView({ group }: { group: GroupDetailData }) {
  const isServerGroup = group.type === "DISCORD_SERVER";
  const meeting = useResource<MeetingInfo>(isServerGroup ? `/api/groups/${group.id}/meeting-channels` : null);
  const canManageChannels = !!meeting.data?.canManage;
  const isOwner = group.role === "OWNER";
  const showSettings = isServerGroup && (isOwner || canManageChannels);

  const [tab, setTab] = useState<Tab>("sessions");
  const [prefill, setPrefill] = useState<SessionPrefill | null>(null);

  // Live Discord presence: refreshed every 60s while open (skipped while the browser tab
  // is hidden). Reopening the group remounts this page with fresh data.
  const [polledPresence, setPolledPresence] = useState<Record<string, Presence | null> | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      fetch(`/api/groups/${group.id}/presence`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setPolledPresence(data));
    }, 60_000);
    return () => clearInterval(timer);
  }, [group.id]);
  const presenceOf = (m: Member) =>
    polledPresence && m.userId in polledPresence ? polledPresence[m.userId] : m.user.presence;

  function createSessionFrom(w: OverlapWindow, category?: string) {
    setPrefill((prev) => ({ nonce: (prev?.nonce ?? 0) + 1, startsAt: w.startsAt, endsAt: w.endsAt, category }));
    setTab("sessions");
    requestAnimationFrame(() =>
      document.getElementById("create-session")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  const tabs: TabItem<Tab>[] = [
    { id: "sessions", label: "Sessions", icon: CalendarDays },
    { id: "find", label: "Find a time", icon: CalendarSearch },
    { id: "members", label: "Members", icon: Users },
    ...(showSettings ? [{ id: "settings" as const, label: "Settings", icon: Settings }] : []),
  ];

  return (
    <>
      <PageHeader
        back={{ href: href("/groups"), label: "All groups" }}
        title={group.name}
        description={
          <span className="cluster">
            {isServerGroup ? <Badge icon={Server}>Discord server</Badge> : <Badge icon={Users}>Custom group</Badge>}
            {isOwner && (
              <Badge icon={Crown} tone="accent">
                Owner
              </Badge>
            )}
            <span>
              {group.members.length} member{group.members.length === 1 ? "" : "s"}
            </span>
          </span>
        }
        actions={!isServerGroup && <InviteCode code={group.inviteCode} />}
      />

      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Group sections">
        {tab === "sessions" && (
          <Sessions
            groupId={group.id}
            guildId={group.discordGuildId}
            isServerGroup={isServerGroup}
            meetingChannels={isServerGroup ? (meeting.data?.channels ?? []) : null}
            prefill={prefill}
            onPrefillUsed={() => setPrefill(null)}
          />
        )}
        {tab === "find" && <FindTime group={group} presenceOf={presenceOf} onCreateSession={createSessionFrom} />}
        {tab === "members" && <Members members={group.members} blocks={group.blocks} presenceOf={presenceOf} />}
        {tab === "settings" && showSettings && (
          <div className="page-stack">
            {isOwner && <AnnouncementChannel groupId={group.id} current={group.announcementChannelId} />}
            {canManageChannels && meeting.data && (
              <MeetingChannels groupId={group.id} channels={meeting.data.channels} onChange={meeting.reload} />
            )}
          </div>
        )}
      </Tabs>
    </>
  );
}

export default function GroupPage({ id }: { id: string }) {
  const { data, error, loading, reload } = useResource<GroupDetailData>(`/api/groups/${encodeURIComponent(id)}`);

  if (loading && !data) {
    return (
      <>
        <PageHeader back={{ href: href("/groups"), label: "All groups" }} title="Loading group…" />
        <SkeletonRows rows={3} height={120} />
      </>
    );
  }
  if (error?.status === 404) {
    return (
      <>
        <PageHeader back={{ href: href("/groups"), label: "All groups" }} title="Group not found" />
        <div className="card">
          <EmptyState
            icon={Users}
            title="This group doesn't exist or you're not a member"
            action={
              <a className="btn btn-primary" href={href("/groups")}>
                Back to your groups
              </a>
            }
          >
            Ask a member for an invite code, or join it from the Servers page if it belongs to a Discord server.
          </EmptyState>
        </div>
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHeader back={{ href: href("/groups"), label: "All groups" }} title="Group" />
        <div className="card">
          <ErrorState
            title="Couldn't load this group"
            message={error?.message ?? "Something went wrong."}
            onRetry={reload}
          />
        </div>
      </>
    );
  }
  return <GroupView group={data} />;
}
