import type { Look } from "@/domain/types";

const FILES = import.meta.glob("@/assets/characters/*/*.svg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

/** `{ "hat/non_la": url }` from the glob keys, whatever the alias prefix. */
const URLS = new Map<string, string>(
  Object.entries(FILES).flatMap(([path, url]) => {
    const m = /([^/]+)\/([^/]+)\.svg$/.exec(path);
    return m ? [[`${m[1]}/${m[2]}`, url] as [string, string]] : [];
  }),
);

const DEFAULTS = { outfit: "ao_ba_ba", hat: "non_la" } as const;

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
  push("base", urlOf("base", "hero"));
  push("face", urlOf("face", "hero"));
  push("outfit", urlOf("outfit", look.outfit ?? "") ?? urlOf("outfit", DEFAULTS.outfit));
  push("hat", urlOf("hat", look.hat ?? "") ?? urlOf("hat", DEFAULTS.hat));
  if (look.accessory) push("accessory", urlOf("accessory", look.accessory));
  return layers;
}
