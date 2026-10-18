import { useId, type ReactNode } from "react";

// A surface that groups related content, with an optional heading row
export default function Card({
  title,
  description,
  actions,
  children,
  className,
  headingLevel = 2,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const id = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={`card${className ? ` ${className}` : ""}`} aria-labelledby={title ? id : undefined}>
      {(title || actions) && (
        <div className="card-header">
          <div className="card-heading">
            {title && (
              <Heading id={id} className="card-title">
                {title}
              </Heading>
            )}
            {description && <p className="card-description">{description}</p>}
          </div>
          {actions && <div className="cluster">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
