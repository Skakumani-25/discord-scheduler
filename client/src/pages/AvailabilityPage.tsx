import Availability from "../components/Availability";
import MyStatus from "../components/MyStatus";
import PageHeader from "../components/ui/PageHeader";
import type { User } from "../types";

export default function AvailabilityPage({ user, onUserChange }: { user: User; onUserChange: (u: User) => void }) {
  return (
    <>
      <PageHeader
        title="Availability"
        description="Tell your groups when you're free so they can find a time that works for everyone."
      />
      <div className="page-stack">
        <Availability />
        <MyStatus current={user.status} onSaved={(status) => onUserChange({ ...user, status })} />
      </div>
    </>
  );
}
