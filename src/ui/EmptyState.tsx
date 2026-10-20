import type { ReactNode } from "react";
import type { Look } from "@/domain/types";
import { HeroMedallion } from "@/ui/HeroMedallion";
import { Motif } from "@/ui/Motif";
import type { Expression } from "@/ui/characterLayers";

/** A staged moment: the hero centred on a cloud-patterned page, a Vietnamese line, then the sentence and the action. */
type Scene = { look: Look; line: string; expression?: Expression; overline?: string; heading?: "h1" | "h2" };

type EmptyStateProps = { title: string; body?: string; illustration?: "bowl" | "lantern" | "boat"; action?: ReactNode; scene?: Scene };

const ART = {
  bowl: (
    <>
      <path d="M12 34h48c0 12-9 20-24 20S12 46 12 34Z" className="fill-primary" />
      <path d="M12 34h48" className="stroke-gold" strokeWidth={3} />
      <path d="M26 20c-3-4 3-6 0-10M38 22c-3-4 3-6 0-12M50 20c-3-4 3-6 0-10" className="stroke-ink-muted" strokeWidth={2.5} fill="none" />
      <path d="M28 58h16" className="stroke-line" strokeWidth={3} />
    </>
  ),
  lantern: (
    <>
      <path d="M36 6v10" className="stroke-ink-muted" strokeWidth={3} />
      <ellipse cx="36" cy="38" rx="20" ry="22" className="fill-primary" />
      <path d="M36 16v44M24 20c-6 12-6 24 0 36M48 20c6 12 6 24 0 36" className="stroke-gold" strokeWidth={2.5} fill="none" />
      <rect x="28" y="14" width="16" height="5" rx="2" className="fill-gold" />
      <rect x="28" y="58" width="16" height="5" rx="2" className="fill-gold" />
      <path d="M36 63v6M32 69h8" className="stroke-gold" strokeWidth={2.5} />
    </>
  ),
  boat: (
    <>
      <path d="M8 46h56c-4 10-12 16-28 16S12 56 8 46Z" className="fill-primary" />
      <path d="M36 12v34" className="stroke-ink-muted" strokeWidth={3} />
      <path d="M38 14c14 6 20 16 22 28H38V14Z" className="fill-gold" />
      <path d="M2 66c6-3 10-3 16 0s10 3 16 0 10-3 16 0 10 3 16 0" className="stroke-info" strokeWidth={2.5} fill="none" />
    </>
  ),
} as const;

// Hierarchy (scene): the hero is the moment; the Vietnamese line speaks for them; one full-width action.
function SceneState({ title, body, action, scene }: Omit<EmptyStateProps, "scene" | "illustration"> & { scene: Scene }) {
  const Heading = scene.heading ?? "h2";
  return (
    <div className="relative flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-5 py-8 text-center text-ink">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-ink" style={{ maskImage: "linear-gradient(to bottom, black 55%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent)" }}>
        <Motif kind="clouds" />
      </div>
      <div className="relative flex flex-col items-center gap-3">
        <HeroMedallion look={scene.look} size={160} expression={scene.expression ?? "idle"} />
        <p lang="vi" className="text-title text-gold-ink">
          {scene.line}
        </p>
        {scene.overline ? <p className="text-caption text-ink-muted">{scene.overline}</p> : null}
        <Heading className="text-heading text-ink">{title}</Heading>
        {body ? <p className="max-w-xs text-body text-ink-muted">{body}</p> : null}
        {action ? <div className="flex w-full max-w-sm flex-col gap-2 pt-3 [&>*]:w-full">{action}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, illustration = "bowl", action, scene }: EmptyStateProps) {
  if (scene) return <SceneState title={title} {...(body ? { body } : {})} {...(action ? { action } : {})} scene={scene} />;
  return (
    <div className="flex flex-col items-start gap-3 px-5 py-8">
      <svg viewBox="0 0 72 72" width={96} height={96} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ART[illustration]}
      </svg>
      <h2 className="text-heading text-ink">{title}</h2>
      {body ? <p className="max-w-xs text-body text-ink-muted">{body}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
