import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

// Page title (the page's single h1) with a description and the page's primary action
export default function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="page-header">
      <div className="page-heading">
        {back && (
          <a className="back-link" href={back.href}>
            <ArrowLeft size={15} aria-hidden />
            {back.label}
          </a>
        )}
        <h1 id="page-title" tabIndex={-1} className="break-words">
          {title}
        </h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="cluster">{actions}</div>}
    </header>
  );
}
