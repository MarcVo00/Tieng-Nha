import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useServices } from "@/app/ServicesProvider";
import type { VocabItem } from "@/domain/types";
import { SLOW_VOICE_RATE } from "@/exercises/types";
import { fr } from "@/i18n/fr";
import { Button, Card, duration, EXIT_RATIO, ease, ReportButton, SpeakerButton, spring } from "@/ui";

export const SWIPE_THRESHOLD = 80; // px

type VocabDeckProps = {
  vocab: readonly VocabItem[];
  voiceRate: number;
  ttsEnabled: boolean;
  onReport: (vocabId: string) => void;
  onStart: () => void;
};

// Hero: the Vietnamese word on the top card. Secondary: translation, note. Action: Suivant, then "C'est parti !".
// The next card waits behind at scale 0.94 / y 10 and settles forward when the top one leaves.
const cardVariants = {
  top: { scale: 1, y: 0, x: 0, opacity: 1, transition: spring.soft },
  behind: { scale: 0.94, y: 10, x: 0, opacity: 1, transition: spring.soft },
  exit: (dir: number) => ({ x: dir * 140, opacity: 0, transition: { duration: duration.fast * EXIT_RATIO, ease: ease.in } }),
};

function WordCard({ item, top, dir, onSwipe }: { item: VocabItem; top: boolean; dir: number; onSwipe: (dir: number) => void }) {
  return (
    <motion.div
      custom={dir}
      variants={cardVariants}
      initial="behind"
      animate={top ? "top" : "behind"}
      exit="exit"
      drag={top ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.5}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) >= SWIPE_THRESHOLD) onSwipe(info.offset.x < 0 ? 1 : -1);
      }}
      aria-hidden={top ? undefined : true}
      className="col-start-1 row-start-1 touch-pan-y"
      style={{ zIndex: top ? 2 : 1, transformOrigin: "50% 100%" }}
    >
      <Card raised className="flex h-full min-h-72 flex-col justify-center gap-3 p-6">
        <p lang="vi" className="break-words text-display text-ink">
          {item.vi}
        </p>
        <p className="text-body text-ink-muted">{item.fr}</p>
        {item.note ? <p className="mt-2 rounded-sm bg-surface-2 p-3 text-caption text-info">{item.note}</p> : null}
      </Card>
    </motion.div>
  );
}

export function VocabDeck({ vocab, voiceRate, ttsEnabled, onReport, onStart }: VocabDeckProps) {
  const { tts } = useServices();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const item = vocab[index];
  const last = index >= vocab.length - 1;

  // Auto-play the word whenever its card becomes the top one.
  const topId = item?.id;
  const topVi = item?.vi;
  useEffect(() => {
    if (!ttsEnabled || topVi === undefined) return;
    tts.speak(topVi, { rate: voiceRate }).catch(() => undefined);
    return () => tts.cancel();
    // Only a change of top card replays; rate/service changes must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topId]);

  if (!item) return null;
  const next = vocab[index + 1];

  const go = (d: number) => {
    if (d > 0 && last) return;
    if (d < 0 && index === 0) return;
    setDir(d);
    setIndex((i) => i + d);
  };

  const shown = next ? [item, next] : [item];
  return (
    <section aria-label={fr.lessons.deck.label} className="flex flex-col gap-5 px-5 pb-8">
      <p className="text-caption tabular text-ink-muted" aria-live="polite">
        {fr.lessons.deck.counter(index + 1, vocab.length)}
      </p>
      <div className="grid">
        <AnimatePresence custom={dir} initial={false}>
          {shown.map((v) => (
            <WordCard key={v.id} item={v} top={v.id === item.id} dir={dir} onSwipe={go} />
          ))}
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-between">
        <SpeakerButton
          size="md"
          onSpeak={() => tts.speak(item.vi, { rate: voiceRate }).catch(() => undefined)}
          onSpeakSlow={() => tts.speak(item.vi, { rate: SLOW_VOICE_RATE }).catch(() => undefined)}
          disabled={!ttsEnabled}
          disabledReason={fr.lessons.deck.noAudio}
        />
        <ReportButton onClick={() => onReport(item.id)} />
      </div>
      <Button size="lg" fullWidth onClick={last ? onStart : () => go(1)}>
        {last ? fr.lessons.deck.start : fr.lessons.deck.next}
      </Button>
    </section>
  );
}
