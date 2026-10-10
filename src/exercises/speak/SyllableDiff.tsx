import type { FC } from "react";
import type { Tone } from "@/domain/types";
import { toneOfSyllable } from "@/domain/tones";
import type { Exercise } from "@/domain/types";
import type { GradeResult } from "@/exercises/types";
import { fr } from "@/i18n/fr";
import type { SyllableDiff } from "@/services/pronunciation";
import type { SpeakDetail } from "./grade";

type Speak = Extract<Exercise, { type: "speak" }>;

// Static class names so Tailwind can see them.
const TONE_DECORATION: Record<Tone, string> = {
  ngang: "decoration-tone-ngang",
  huyen: "decoration-tone-huyen",
  sac: "decoration-tone-sac",
  hoi: "decoration-tone-hoi",
  nga: "decoration-tone-nga",
  nang: "decoration-tone-nang",
};

function isDetail(d: unknown): d is SpeakDetail {
  return typeof d === "object" && d !== null && Array.isArray((d as SpeakDetail).diff) && typeof (d as SpeakDetail).heard === "string";
}

function Syllable({ item }: { item: SyllableDiff & { expected: string } }) {
  if (item.status === "ok") return <span>{item.expected}</span>;
  if (item.status === "tone") {
    return (
      <span className={`underline decoration-[3px] underline-offset-4 ${TONE_DECORATION[toneOfSyllable(item.expected)]}`}>
        {item.expected}
        <span className="sr-only"> {fr.exercises.speak.toneLabel}</span>
      </span>
    );
  }
  return <span className="text-error underline decoration-dotted decoration-2 underline-offset-4">{item.expected}</span>;
}

export const SyllableDiffView: FC<{ exercise: Speak; result: GradeResult }> = ({ result }) => {
  if (result.selfAssessed || result.skipped || !isDetail(result.detail)) return null;
  const { diff, heard } = result.detail;
  const shown = diff.flatMap((d) => (d.expected === null ? [] : [{ ...d, expected: d.expected }]));
  return (
    <div className="flex flex-col gap-2">
      <p lang="vi" className="text-heading flex flex-wrap gap-x-2">
        {shown.map((d, i) => (
          <Syllable key={i} item={d} />
        ))}
      </p>
      {heard ? (
        <p className="text-caption text-ink-muted">{fr.exercises.speak.heard} «&nbsp;<span lang="vi">{heard}</span>&nbsp;»
        </p>
      ) : null}
    </div>
  );
};
