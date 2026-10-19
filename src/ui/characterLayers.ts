import type { Look } from "@/domain/types";

const FILES = import.meta.glob("@/assets/characters/*/*.svg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

/** `{ "hat/non_la": url }` from the glob keys, whatever the alias prefix. */
const URLS = new Map<string, string>(
  Object.entries(FILES).flatMap(([path, url]) => {
    const m = /([^/]+)\/([^/]+)\.svg$/.exec(path);
    return m ? [[`${m[1]}/${m[2]}`, url] as [string, string]] : [];
  }),
);

type Defaults = { base: string; face: string; outfit: string; hat: string | null };
const HERO: Defaults = { base: "hero", face: "hero", outfit: "ao_ba_ba", hat: "non_la" };
/** Per-character defaults; a character without a default hat has its headgear in the base. */
const CHARACTERS: Record<string, Defaults> = {
  hero: HERO,
  char_kiem_khach: { base: "char_kiem_khach", face: "char_kiem_khach", outfit: "char_kiem_khach", hat: null },
  char_phap_su: { base: "char_phap_su", face: "char_phap_su", outfit: "char_phap_su", hat: null },
};

function urlOf(slot: string, id: string): string | undefined {
  return URLS.get(`${slot}/${id}`);
}

/** Layers bottom to top: aura, shadow, base, face, outfit, hat, accessory. Unknown ids fall back to the defaults. */
export function characterLayers(look: Look): { slot: string; src: string }[] {
  const layers: { slot: string; src: string }[] = [];
  const push = (slot: string, src: string | undefined) => {
    if (src) layers.push({ slot, src });
  };
  if (look.aura) push("aura", urlOf("aura", look.aura));
  push("shadow", urlOf("shadow", "hero"));
  const d = (look.character !== undefined ? CHARACTERS[look.character] : undefined) ?? HERO;
  push("base", urlOf("base", d.base));
  push("face", urlOf("face", d.face));
  push("outfit", urlOf("outfit", look.outfit ?? "") ?? urlOf("outfit", d.outfit));
  push("hat", urlOf("hat", look.hat ?? "") ?? (d.hat === null ? undefined : urlOf("hat", d.hat)));
  if (look.accessory) push("accessory", urlOf("accessory", look.accessory));
  return layers;
}
