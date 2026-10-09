import type { Env } from "@/domain/config";
import type { Services } from "@/app/services";
import { createFakeServices } from "@/adapters/fakes";

/** Composition root. Real adapters are wired in T15; until then everything is fake. */
export function createServices(env: Env): Services {
  return createFakeServices({ env });
}
