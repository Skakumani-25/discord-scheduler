import { Crown } from "lucide-react";
import { categoryInfo } from "../../categories";
import { userAvatarUrl } from "../../discord";
import { formatRange, useTimezone } from "../../time";
import { useNow } from "../../useNow";
import type { Presence } from "../../status";
import { PresenceDot, PresenceLegend } from "../PresenceDot";
import StatusBadge from "../StatusBadge";
import Avatar from "../ui/Avatar";
import Badge from "../ui/Badge";
import Card from "../ui/Card";
import type { Block, Member } from "./types";

export default function Members({
  members,
  blocks,
  presenceOf,
}: {
  members: Member[];
  blocks: Block[];
  presenceOf: (m: Member) => Presence | null;
}) {
  const tz = useTimezone();
  const now = useNow();
  const anyPresence = members.some((m) => presenceOf(m) !== null);

  return (
    <Card
      title={`Members (${members.length})`}
      description="Statuses are set by each member. Discord status updates every minute while this page is open."
    >
      {anyPresence && (
        <div className="members-legend">
          <PresenceLegend />
        </div>
      )}
      <ul className="list">
        {members.map((m) => {
          const presence = presenceOf(m);
          const memberBlocks = blocks.filter((b) => b.userId === m.userId);
          return (
            <li key={m.userId} className="member-row">
              <div className="member-row-main">
                <Avatar
                  src={userAvatarUrl(m.user.discordId, m.user.avatar, 80)}
                  name={m.user.username}
                  size={40}
                  badge={presence && <PresenceDot presence={presence} size={12} />}
                />
                <div className="min-w-0">
                  <div className="cluster">
                    <span className="list-row-title truncate">{m.user.username}</span>
                    {m.role === "OWNER" && (
                      <Badge icon={Crown} tone="accent">
                        Owner
                      </Badge>
                    )}
                  </div>
                  {m.user.status ? (
                    <StatusBadge status={m.user.status} now={now} />
                  ) : (
                    <span className="subtle">No status</span>
                  )}
                </div>
              </div>
              {memberBlocks.length === 0 ? (
                <span className="subtle">No upcoming availability</span>
              ) : (
                <details className="member-times">
                  <summary>
                    {memberBlocks.length} upcoming time{memberBlocks.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="list member-times-list">
                    {memberBlocks.map((b) => {
                      const info = categoryInfo(b.category);
                      const Icon = info.icon;
                      return (
                        <li key={b.id}>
                          <Icon size={14} aria-hidden style={{ color: info.color }} />
                          <span>
                            <span className="visually-hidden">{info.label}: </span>
                            {formatRange(b.startsAt, b.endsAt, tz)}
                            {b.note && <span className="muted"> · {b.note}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
