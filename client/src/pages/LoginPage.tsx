import { Bell, CalendarDays, LogIn, Users } from "lucide-react";
import { Brand } from "../components/layout/AppShell";

export default function LoginPage() {
  return (
    <main className="splash">
      <div className="card login-card">
        <Brand />
        <h1>Plan voice chats without the back‑and‑forth</h1>
        <p>Share when you're free, see when your group overlaps, and get a Discord reminder before it starts.</p>
        {/* Full page navigation: the server runs the Discord OAuth flow */}
        <a className="btn btn-primary btn-block" href="/auth/discord">
          <LogIn size={16} aria-hidden />
          Log in with Discord
        </a>
        <ul className="feature-list">
          <li>
            <CalendarDays size={16} aria-hidden />
            Weekly availability calendar in your own timezone
          </li>
          <li>
            <Users size={16} aria-hidden />
            Groups for friends or whole Discord servers
          </li>
          <li>
            <Bell size={16} aria-hidden />
            Session reminders sent by the bot
          </li>
        </ul>
      </div>
    </main>
  );
}
