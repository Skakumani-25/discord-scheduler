import { useEffect, useState } from "react";

type Guild = {
  id: string;
  name: string;
  icon: string | null;
  canManage: boolean;
  group: { id: string; isMember: boolean } | null;
};
type GuildsState =
  | { status: "loading" }
  | { status: "ok"; guilds: Guild[] }
  | { status: "error"; error: string; reauth: boolean };

async function fetchGuilds(): Promise<GuildsState> {
  const res = await fetch("/api/discord/guilds");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { status: "error", error: body.error ?? "Could not load your servers", reauth: !!body.reauth };
  }
  return { status: "ok", guilds: body };
}

export default function DiscordServers({ onOpenGroup }: { onOpenGroup: (groupId: string) => void }) {
  const [state, setState] = useState<GuildsState>({ status: "loading" });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    fetchGuilds().then(setState);
    fetch("/api/discord/invite-url")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setInviteUrl(body?.url ?? null));
  }, []);

  async function reload() {
    setState(await fetchGuilds());
  }

  async function act(path: "from-guild" | "join-guild", guildId: string) {
    setActionError("");
    const res = await fetch(`/api/groups/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(body.error ?? "Something went wrong");
      reload();
      return;
    }
    await reload();
    onOpenGroup(body.id);
  }

  return (
    <section style={{ marginTop: 16, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <h3 style={{ marginTop: 0 }}>Add a Discord server</h3>
      {inviteUrl && (
        <p>
          Bot not in your server yet?{" "}
          <a href={inviteUrl} target="_blank" rel="noreferrer">
            Invite the bot
          </a>
          , then <button onClick={reload}>Refresh</button>
        </p>
      )}

      {state.status === "loading" && <p>Loading your servers...</p>}
      {state.status === "error" && (
        <p style={{ color: "red" }}>
          {state.error} {state.reauth && <a href="/auth/discord">Log in again</a>}
        </p>
      )}
      {actionError && <p style={{ color: "red" }}>{actionError}</p>}

      {state.status === "ok" && state.guilds.length === 0 && (
        <p>None of your servers have the bot yet.</p>
      )}
      {state.status === "ok" && state.guilds.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {state.guilds.map((g) => (
            <li key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              {g.icon ? (
                <img
                  src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=32`}
                  alt=""
                  width={24}
                  height={24}
                  style={{ borderRadius: "50%" }}
                />
              ) : (
                <span style={{ width: 24 }} />
              )}
              <span>
                {g.name}
                {g.canManage && <small> (you manage this server)</small>}
              </span>
              {!g.group && <button onClick={() => act("from-guild", g.id)}>Create group</button>}
              {g.group && !g.group.isMember && (
                <button onClick={() => act("join-guild", g.id)}>Join this server's group</button>
              )}
              {g.group?.isMember && <button onClick={() => onOpenGroup(g.group!.id)}>Open</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
