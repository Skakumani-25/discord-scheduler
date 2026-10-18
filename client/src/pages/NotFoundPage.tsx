import { Compass } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/States";
import { href } from "../router";

export default function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <div className="card">
        <EmptyState
          icon={Compass}
          title="There's nothing at this address"
          action={
            <a className="btn btn-primary" href={href("/availability")}>
              Go to Availability
            </a>
          }
        >
          The link may be out of date.
        </EmptyState>
      </div>
    </>
  );
}
