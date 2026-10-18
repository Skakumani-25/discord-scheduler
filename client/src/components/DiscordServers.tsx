import { Bot, ExternalLink, LogIn, Plus, RefreshCw, Server, ShieldCheck, UserPlus } from "lucide-react";
import { api, errorMessage, useResource } from "../api";
import { guildIconUrl } from "../discord";
import { href, navigate } from "../router";
import Alert from "./ui/Alert";
import Avatar from "./ui/Avatar";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import Card from "./ui/Card";
import { EmptyState, ErrorState, SkeletonRows } from "./ui/States";
import { useToast } from "./ui/toast-context";

type Guild = {
  id: string;
  name: string;
  icon: string | null;
  canManage: boolean;
  group: { id: string; isMember: boolean } | null;
};

function InviteBotCard() {
  const invite = useResource<{ url: string }>("/api/discord/invite-url");
  return (
    <Card
      title="Add the bot to a server"
      description="The bot needs to be in a server before you can make a group for it. It only asks to view channels, send messages and connect."
    >
      {invite.loading && <div className="skeleton skeleton-button" />}
      {invite.error && (
        <Alert tone="warning" title="Bot invite link unavailable">
          {invite.error.status === 503
            ? "The server doesn't have a Discord client ID configured, so it can't build an invite link."
            : invite.error.message}
        </Alert>
      )}
      {invite.data && (
        <a className="btn btn-secondary" href={invite.data.url} target="_blank" rel="noreferrer">
          <Bot size={16} aria-hidden />
          Invite the bot
          <ExternalLink size={14} aria-hidden />
          <span className="visually-hidden">(opens in a new tab)</span>
        </a>
      )}
    </Card>
  );
}

export default function DiscordServers() {
  const toast = useToast();
  const { data, error, loading, reload } = useResource<Guild[]>("/api/discord/guilds");

  async function act(path: "from-guild" | "join-guild", guild: Guild) {
    try {
      const group = await api<{ id: string }>(`/api/groups/${path}`, {
        method: "POST",
        body: { guildId: guild.id },
      });
      toast.success(path === "from-guild" ? `Created a group for ${guild.name}` : `Joined ${guild.name}`);
      navigate(`/groups/${group.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      reload();
    }
  }

  let body;
  if (loading && !data) {
    body = <SkeletonRows rows={3} />;
  } else if (error?.body?.reauth) {
    body = (
      <EmptyState
        icon={LogIn}
        title="Reconnect Discord to see your servers"
        action={
          <a className="btn btn-primary" href="/auth/discord">
            <LogIn size={16} aria-hidden />
            Log in with Discord
          </a>
        }
      >
        Your Discord sign-in has expired. Logging in again lets us read which servers you're in.
      </EmptyState>
    );
  } else if (error) {
    body = (
      <ErrorState
        title={error.status === 503 ? "The bot is offline" : "Couldn't load your servers"}
        message={
          error.status === 503
            ? "Server groups need the Discord bot, and it isn't connected right now. Try again in a minute."
            : error.message
        }
        onRetry={reload}
      />
    );
  } else if (data && data.length === 0) {
    body = (
      <EmptyState icon={Server} title="None of your servers have the bot yet">
        Invite the bot to a server you're in, then refresh this list.
      </EmptyState>
    );
  } else if (data) {
    body = (
      <ul className="list">
        {data.map((g) => (
          <li key={g.id} className="list-row">
            <Avatar src={guildIconUrl(g.id, g.icon, 64)} name={g.name} size={40} square />
            <div className="list-row-main">
              <div className="list-row-title truncate">{g.name}</div>
              <div className="cluster">
                {g.canManage && (
                  <Badge icon={ShieldCheck} tone="accent">
                    You manage this server
                  </Badge>
                )}
                <span className="list-row-meta">
                  {!g.group ? "No group yet" : g.group.isMember ? "You're in this group" : "Group available"}
                </span>
              </div>
            </div>
            {!g.group && (
              <Button variant="primary" size="sm" icon={Plus} onClick={() => act("from-guild", g)}>
                Create group
              </Button>
            )}
            {g.group && !g.group.isMember && (
              <Button size="sm" icon={UserPlus} onClick={() => act("join-guild", g)}>
                Join group
              </Button>
            )}
            {g.group?.isMember && (
              <a className="btn btn-ghost btn-sm" href={href(`/groups/${g.group.id}`)}>
                Open group
              </a>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="page-stack">
      <Card
        title="Your servers with the bot"
        description="Only servers you share with the bot are listed. Anyone in the server can join its group."
        actions={
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={reload} loading={loading && !!data}>
            Refresh
          </Button>
        }
      >
        {body}
      </Card>
      <InviteBotCard />
    </div>
  );
}
