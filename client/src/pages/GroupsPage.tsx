import { useState } from "react";
import { ChevronRight, Crown, LogIn, Plus, Server, Users } from "lucide-react";
import { api, errorMessage, useResource } from "../api";
import { href, navigate } from "../router";
import Avatar from "../components/ui/Avatar";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Field from "../components/ui/Field";
import PageHeader from "../components/ui/PageHeader";
import { EmptyState, ErrorState, SkeletonRows } from "../components/ui/States";
import { useToast } from "../components/ui/toast-context";

type GroupSummary = {
  id: string;
  name: string;
  inviteCode: string;
  type: "CUSTOM" | "DISCORD_SERVER";
  role: "OWNER" | "MEMBER";
  memberCount: number;
};

function CreateGroupCard() {
  const toast = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for the group.");
      return;
    }
    setError("");
    try {
      const group = await api<{ id: string; name: string }>("/api/groups", { method: "POST", body: { name: trimmed } });
      toast.success(`Created ${group.name}`);
      navigate(`/groups/${group.id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card
      title="Create a group"
      description={
        <>
          For friends across servers. For a whole Discord server, use <a href={href("/servers")}>Servers</a>.
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()}>
        <Field label="Group name" required hint="Up to 50 characters" error={error || undefined}>
          {(props) => (
            <input
              {...props}
              className="input"
              maxLength={50}
              placeholder="e.g. Friday raid squad"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" icon={Plus} onClick={create} block>
          Create group
        </Button>
      </form>
    </Card>
  );
}

function JoinGroupCard() {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function join() {
    if (!code.trim()) {
      setError("Enter the invite code you were given.");
      return;
    }
    setError("");
    try {
      const group = await api<{ id: string; name: string }>("/api/groups/join", {
        method: "POST",
        body: { code: code.trim() },
      });
      toast.success(`Joined ${group.name}`);
      navigate(`/groups/${group.id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card title="Join with a code" description="Ask a member for their group's invite code.">
      <form className="stack" onSubmit={(e) => e.preventDefault()}>
        <Field label="Invite code" required error={error || undefined}>
          {(props) => (
            <input
              {...props}
              className="input input-code"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={16}
              placeholder="e.g. 3F9A2C1B"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          )}
        </Field>
        <Button type="submit" icon={LogIn} onClick={join} block>
          Join group
        </Button>
      </form>
    </Card>
  );
}

export default function GroupsPage() {
  const { data, error, loading, reload } = useResource<GroupSummary[]>("/api/groups");

  let list;
  if (loading && !data) list = <SkeletonRows rows={3} height={60} />;
  else if (error) list = <ErrorState title="Couldn't load your groups" message={error.message} onRetry={reload} />;
  else if (data && data.length === 0)
    list = (
      <EmptyState
        icon={Users}
        title="You're not in any groups yet"
        action={
          <a className="btn btn-secondary" href={href("/servers")}>
            <Server size={16} aria-hidden />
            Browse your Discord servers
          </a>
        }
      >
        Create one for your friends, join with an invite code, or make a group from a Discord server.
      </EmptyState>
    );
  else if (data)
    list = (
      <div className="row-list">
        {data.map((g) => (
          <a key={g.id} className="row-link" href={href(`/groups/${g.id}`)}>
            <Avatar name={g.name} size={40} square />
            <span className="list-row-main">
              <span className="list-row-title truncate block">{g.name}</span>
              <span className="row-meta">
                <span className="list-row-meta">
                  {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                </span>
                {g.type === "DISCORD_SERVER" && <Badge icon={Server}>Discord server</Badge>}
                {g.role === "OWNER" && (
                  <Badge icon={Crown} tone="accent">
                    Owner
                  </Badge>
                )}
              </span>
            </span>
            <ChevronRight size={18} className="muted" aria-hidden />
          </a>
        ))}
      </div>
    );

  return (
    <>
      <PageHeader title="Groups" description="Find shared free time and schedule voice chat sessions together." />
      <div className="layout-split">
        <Card title="Your groups">
          {list}
        </Card>
        <div className="page-stack">
          <CreateGroupCard />
          <JoinGroupCard />
        </div>
      </div>
    </>
  );
}
