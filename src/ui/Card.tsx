import type { ReactNode } from "react";

type CardProps = { as?: "div" | "section" | "li"; raised?: boolean; className?: string; children?: ReactNode };

export function Card({ as: Tag = "div", raised = false, className, children }: CardProps) {
  return <Tag className={`rounded-md bg-surface ${raised ? "shadow-raised" : "shadow-card"} ${className ?? ""}`}>{children}</Tag>;
}
