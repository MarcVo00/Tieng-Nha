import { useMemo } from "react";
import { motion } from "motion/react";
import type { Look } from "@/domain/types";
import { characterLayers, type Expression } from "@/ui/characterLayers";
import { KoBow, type FighterPose } from "@/ui/fight/KoBow";
import type { FighterControls } from "@/ui/fight/useFightBeat";

type FighterSpriteProps = {
  look: Look;
  /** 1 faces right, -1 faces left (mirrored). */
  facing: 1 | -1;
  expression: Expression;
  /** Width in px (height = 4/3). */
  size: number;
  controls?: FighterControls;
  pose?: FighterPose;
  /** `will-change: transform` while a fight is playing, removed afterwards. */
  live?: boolean;
};

const EXPRESSIONS: readonly Expression[] = ["idle", "hurt", "ko"];
const LAYER = "pointer-events-none absolute inset-0 h-full w-full select-none";

/**
 * The fighter alone, without its medallion: the paper medallion stays on the ground like a mat, only the character
 * moves. The three faces are mounted at once (decoded before the fight) and swapped by visibility on contact, so a face
 * change never waits for an image. The hat is its own layer so it can fall on a K.-O. Decorative: callers label it.
 */
export function FighterSprite({ look, facing, expression, size, controls, pose = "stand", live = false }: FighterSpriteProps) {
  const layers = useMemo(() => characterLayers(look), [look]);
  const faces = useMemo(
    () => EXPRESSIONS.map((e) => ({ e, src: characterLayers(look, e).find((l) => l.slot === "face")?.src })),
    [look],
  );
  const mirror = facing === -1 ? { transform: "scaleX(-1)" } : undefined;
  const img = (slot: string, src: string) => <img key={slot} src={src} alt="" draggable={false} data-layer={slot} className={LAYER} />;
  const below = layers.filter((l) => l.slot !== "hat" && l.slot !== "accessory" && l.slot !== "face");
  const hat = layers.find((l) => l.slot === "hat");
  const accessory = layers.find((l) => l.slot === "accessory");
  return (
    <span aria-hidden="true" data-expression={expression} className="relative block" style={{ width: size, height: (size * 4) / 3 }}>
      <motion.span className={`absolute inset-0 origin-bottom ${live ? "will-change-transform" : ""}`} {...(controls ? { animate: controls.body } : {})}>
        <KoBow
          pose={pose}
          dir={facing}
          hat={hat ? <span className="absolute inset-0" style={mirror}>{img("hat", hat.src)}</span> : undefined}
          over={accessory ? <span className="absolute inset-0" style={mirror}>{img("accessory", accessory.src)}</span> : undefined}
        >
          <span className="absolute inset-0" style={mirror}>
            {below.map((l) =>
              l.slot === "base"
                ? [
                    img(l.slot, l.src),
                    ...faces.map((f) =>
                      f.src ? (
                        <img
                          key={`face-${f.e}`}
                          src={f.src}
                          alt=""
                          draggable={false}
                          data-layer="face"
                          data-face={f.e}
                          className={`${LAYER} ${f.e === expression ? "" : "invisible"}`}
                        />
                      ) : null,
                    ),
                  ]
                : img(l.slot, l.src),
            )}
          </span>
        </KoBow>
        {/* Paper plate flashed over the fighter on contact (opacity only), instead of blinking the fighter. */}
        <motion.span data-fx="flash" className="absolute inset-x-[18%] inset-y-[10%] rounded-lg bg-paper opacity-0" initial={{ opacity: 0 }} {...(controls ? { animate: controls.flash } : {})} />
      </motion.span>
    </span>
  );
}
