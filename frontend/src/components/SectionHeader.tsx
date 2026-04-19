import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

type SectionHeadingLevel = "h2" | "h3" | "h4";

type SectionHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  headingLevel?: SectionHeadingLevel;
  variant?: "panel" | "section" | "subsection";
  className?: string;
};

export function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  eyebrow,
  headingLevel = "h2",
  variant = "panel",
  className,
}: SectionHeaderProps) {
  const HeadingTag = headingLevel;
  const classes = ["section-header", `section-header--${variant}`];
  if (className) classes.push(className);

  return (
    <header className={classes.join(" ")}>
      <div className="section-header__lead">
        {Icon && (
          <span className="section-header__icon" aria-hidden>
            <Icon strokeWidth={2} />
          </span>
        )}
        <div className="section-header__text">
          {eyebrow && <p className="section-header__eyebrow">{eyebrow}</p>}
          <HeadingTag className="section-header__title">{title}</HeadingTag>
          {subtitle && <p className="section-header__subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="section-header__actions">{actions}</div>}
    </header>
  );
}
