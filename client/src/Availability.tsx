import { useEffect, useState } from "react";

const CATEGORIES = ["GAMING", "STUDYING", "TALKING", "MOVIE", "OTHER"];

type Block = {
  id: string;
  category: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
};

export default function Availability() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [category, setCategory] = useState("GAMING");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/availability");
    if (res.ok) setBlocks(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    setError("");
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        startsAt: start ? new Date(start).toISOString() : "",
        endsAt: end ? new Date(end).toISOString() : "",
        note,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }
    setNote("");
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/availability/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h2>My availability</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={add}>Add</button>
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <ul>
        {blocks.map((b) => (
          <li key={b.id}>
            <strong>{b.category}</strong>{" "}
            {new Date(b.startsAt).toLocaleString()} to {new Date(b.endsAt).toLocaleString()}
            {b.note && ` (${b.note})`}{" "}
            <button onClick={() => remove(b.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}