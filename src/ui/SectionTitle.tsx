import type { ReactNode } from "react";

type SectionTitleProps = {
  /** Id of the heading, referenced by the section's aria-labelledby. */
  id?: string;
  children: ReactNode;
  /** Short spaced Vietnamese label above the heading; decorative, hidden from assistive tech. */
  overline?: string;
  className?: string;
};

// Hierarchy: the heading is the hero; the gold overline and the brush stroke only give the section a mark.
export function SectionTitle({ id, children, overline, className }: SectionTitleProps) {
  return (
    <div className={`flex flex-col ${className ?? ""}`}>
      {overline ? (
        <span aria-hidden="true" className="text-caption font-semibold uppercase tracking-[0.18em] text-gold-ink">
          {overline}
        </span>
      ) : null}
      <h2 id={id} className="text-heading text-ink">
        {children}
      </h2>
      <svg aria-hidden="true" viewBox="0 0 48 6" width="48" height="6" className="mt-1 text-gold" fill="currentColor">
        <path d="M1 3.4C5 1.2 9 1 14 2.1c6 1.2 11-1.4 17-.7 5 .6 9 .9 16 .3-.7 1.3-1.6 2.2-3.4 2.6-5.6 1.2-9.6.1-14.6.6-5 .5-9.2 1.3-14.2.7C9.6 5.4 5.4 4.8 1 3.4Z" />
      </svg>
    </div>
  );
}
