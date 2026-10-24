import { useEffect } from "react";
import { useServices } from "@/app/ServicesProvider";
import { recoverGachaPulls, useRecoveredPulls } from "@/app/useGachaPulls";
import { fr } from "@/i18n/fr";
import { useToast } from "@/ui";

/**
 * Without any UI of its own: on mount and whenever the network comes back, recovers the gacha pulls the server made
 * but this device never applied (crash mid-request, closed app), and announces each recovered pull once.
 */
export function GachaSync() {
  const { gacha, activity } = useServices();
  const { show } = useToast();
  const push = useRecoveredPulls((s) => s.push);

  useEffect(() => {
    let running = false;
    let again = false;
    let stopped = false;

    const run = async (): Promise<void> => {
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        const recovered = await recoverGachaPulls({ gacha, activity });
        if (!stopped && recovered.length > 0) {
          push(recovered);
          for (let i = 0; i < recovered.length; i++) show({ title: fr.gacha.recovered, body: fr.gacha.recoveredBody });
        }
      } finally {
        running = false;
      }
      if (again && !stopped) {
        again = false;
        await run();
      }
    };

    void run();
    const onOnline = () => void run();
    window.addEventListener("online", onOnline);
    return () => {
      stopped = true;
      window.removeEventListener("online", onOnline);
    };
  }, [gacha, activity, push, show]);

  return null;
}
