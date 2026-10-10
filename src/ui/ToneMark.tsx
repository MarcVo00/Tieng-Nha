import { fr } from "@/i18n/fr";
import type { Tone } from "@/domain/types";

export type ToneUi = { name: string; sign: string; className: string };

// Single source for how a tone is shown: colour + sign + name, never colour alone.
export const TONE_UI: Record<Tone, ToneUi> = {
  ngang: { name: fr.ui.tones.ngang, sign: "–", className: "text-tone-ngang" },
  huyen: { name: fr.ui.tones.huyen, sign: "`", className: "text-tone-huyen" },
  sac: { name: fr.ui.tones.sac, sign: "´", className: "text-tone-sac" },
  hoi: { name: fr.ui.tones.hoi, sign: " ̉", className: "text-tone-hoi" },
  nga: { name: fr.ui.tones.nga, sign: "˜", className: "text-tone-nga" },
  nang: { name: fr.ui.tones.nang, sign: ".", className: "text-tone-nang" },
};

type ToneMarkProps = { tone: Tone; showName?: boolean };

export function ToneMark({ tone, showName = false }: ToneMarkProps) {
  const ui = TONE_UI[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-body-strong ${ui.className}`}>
      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-sm border-2 border-current px-1 leading-none" aria-hidden={showName ? true : undefined}>
        {ui.sign}
      </span>
      {showName ? (
        <span lang="vi">{ui.name}</span>
      ) : (
        <span className="sr-only" lang="vi">
          {ui.name}
        </span>
      )}
    </span>
  );
}
