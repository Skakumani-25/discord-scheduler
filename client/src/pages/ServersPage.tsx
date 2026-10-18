import DiscordServers from "../components/DiscordServers";
import PageHeader from "../components/ui/PageHeader";

export default function ServersPage() {
  return (
    <>
      <PageHeader
        title="Servers"
        description="Turn a Discord server into a group, with its voice channels and bot announcements."
      />
      <DiscordServers />
    </>
  );
}
