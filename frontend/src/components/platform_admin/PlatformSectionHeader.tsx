import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export default function PlatformSectionHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  id,
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <header className="platform-section-heading">
      <div className="flex min-w-0 items-start gap-3">
        <span className="platform-section-icon">
          <Icon size={21} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          {eyebrow && <p className="platform-eyebrow">{eyebrow}</p>}
          <h2 id={id} className="platform-section-title">
            {title}
          </h2>
          {description && (
            <div className="mt-1 text-sm leading-relaxed text-text-muted">
              {description}
            </div>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
