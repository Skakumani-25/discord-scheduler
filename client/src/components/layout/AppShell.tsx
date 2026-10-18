import { useEffect, useRef, type ReactNode } from "react";
import { CalendarDays, CalendarClock, Server, Settings, Users, type LucideIcon } from "lucide-react";
import Avatar from "../ui/Avatar";
import StatusBadge from "../StatusBadge";
import { href, type Route } from "../../router";
import { userAvatarUrl } from "../../discord";
import type { User } from "../../types";

type NavItem = { path: string; label: string; icon: LucideIcon; matches: Route["name"][] };

const NAV: NavItem[] = [
  { path: "/availability", label: "Availability", icon: CalendarDays, matches: ["availability"] },
  { path: "/groups", label: "Groups", icon: Users, matches: ["groups", "group"] },
  { path: "/servers", label: "Servers", icon: Server, matches: ["servers"] },
  { path: "/settings", label: "Settings", icon: Settings, matches: ["settings"] },
];

function NavLinks({ route }: { route: Route }) {
  return (
    <>
      {NAV.map(({ path, label, icon: Icon, matches }) => (
        <a
          key={path}
          href={href(path)}
          className="nav-link"
          aria-current={matches.includes(route.name) ? "page" : undefined}
        >
          <Icon size={18} aria-hidden />
          <span>{label}</span>
        </a>
      ))}
    </>
  );
}

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <CalendarClock size={18} aria-hidden />
      </span>
      VC Scheduler
    </span>
  );
}

// Sidebar navigation on desktop; top bar + bottom tab bar on narrow screens
export default function AppShell({
  user,
  route,
  routeKey,
  children,
}: {
  user: User;
  route: Route;
  routeKey: string;
  children: ReactNode;
}) {
  const firstRender = useRef(true);

  // On navigation: start at the top and move focus to the new page's heading
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.getElementById("page-title")?.focus({ preventScroll: true });
  }, [routeKey]);

  const avatar = userAvatarUrl(user.discordId, user.avatar, 64);

  return (
    <div className="shell">
      {/* preventDefault: with hash routing, following "#main" would change the route */}
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("page-title")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <nav className="nav" aria-label="Main">
          <NavLinks route={route} />
        </nav>
        <a href={href("/settings")} className="sidebar-user" aria-label={`${user.username}, open settings`}>
          <Avatar src={avatar} name={user.username} size={32} />
          <span className="sidebar-user-text">
            <span className="sidebar-user-name truncate">{user.username}</span>
            {user.status ? <StatusBadge status={user.status} /> : <span className="subtle">No status set</span>}
          </span>
        </a>
      </aside>

      <header className="topbar">
        <Brand />
        <a href={href("/settings")} aria-label="Settings">
          <Avatar src={avatar} name={user.username} size={30} />
        </a>
      </header>

      <main className="main" id="main">
        <div className="content">{children}</div>
      </main>

      <nav className="bottom-nav" aria-label="Main">
        <NavLinks route={route} />
      </nav>
    </div>
  );
}
