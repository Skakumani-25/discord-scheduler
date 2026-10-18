import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type TabItem<T extends string> = { id: T; label: string; icon?: LucideIcon };

// Accessible tabs (arrow keys move between tabs); renders the active panel's children
export default function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  children,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  children: ReactNode;
}) {
  const base = useId();
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(e: KeyboardEvent) {
    const index = tabs.findIndex((t) => t.id === value);
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === -1) return;
    e.preventDefault();
    onChange(tabs[next].id);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <>
      <div className="tabs" role="tablist" aria-label={label} ref={listRef} onKeyDown={onKeyDown}>
        {tabs.map(({ id, label: tabLabel, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`${base}-tab-${id}`}
            aria-selected={id === value}
            aria-controls={`${base}-panel`}
            tabIndex={id === value ? 0 : -1}
            className="tab"
            onClick={() => onChange(id)}
          >
            {Icon && <Icon size={16} aria-hidden />}
            {tabLabel}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${value}`}>
        {children}
      </div>
    </>
  );
}
