import { useEffect, useState } from "react";
import GroupDetail, { type GroupDetailData } from "./components/GroupDetail";
import DiscordServers from "./components/DiscordServers";

type GroupSummary = {
  id: string;
  name: string;
  inviteCode: string;
  type: "CUSTOM" | "DISCORD_SERVER";
  role: string;
  memberCount: number;
};

export default function Groups() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selected, setSelected] = useState<GroupDetailData | null>(null);
  const [newName, setNewName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function loadGroups() {
    const res = await fetch("/api/groups");
    if (res.ok) setGroups(await res.json());
  }

  useEffect(() => {
    loadGroups();
  }, []);

  async function open(id: string) {
    const res = await fetch(`/api/groups/${id}`);
    if (res.ok) setSelected(await res.json());
  }

  async function create() {
    setError("");
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not create group");
      return;
    }
    setNewName("");
    loadGroups();
  }

  async function join() {
    setError("");
    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not join group");
      return;
    }
    setCode("");
    loadGroups();
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h2>My groups</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input placeholder="New group name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button onClick={create}>Create</button>
        <input placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} />
        <button onClick={join}>Join</button>
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <ul>
        {groups.map((g) => (
          <li key={g.id}>
            <button onClick={() => open(g.id)}>{g.name}</button> ({g.memberCount} members
            {g.type === "DISCORD_SERVER" ? (
              ", Discord server"
            ) : (
              <>
                , code: <code>{g.inviteCode}</code>
              </>
            )}
            )
          </li>
        ))}
      </ul>

      <DiscordServers
        onOpenGroup={(id) => {
          loadGroups();
          open(id);
        }}
      />

      {selected && <GroupDetail key={selected.id} group={selected} />}
    </div>
  );
}