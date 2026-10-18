import { useEffect, useState } from "react";

// Current time in ms, refreshed every `intervalMs`. Lets components show relative
// times ("until 7:30 PM", "Happening now") without impure calls during render.
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
