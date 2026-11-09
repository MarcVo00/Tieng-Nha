import { useEffect, useState } from "react";
import { VOICE_NOTICE_KEY } from "@/domain/storageKeys";
import { fr } from "@/i18n/fr";

function seen(): boolean {
  try {
    return localStorage.getItem(VOICE_NOTICE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Says where the voice goes, next to the microphone, the first time this device sees one. */
export function VoiceNotice() {
  const [show] = useState(() => !seen());

  useEffect(() => {
    if (!show) return;
    return () => {
      try {
        localStorage.setItem(VOICE_NOTICE_KEY, "1");
      } catch {
        // Storage unavailable: the notice simply shows again.
      }
    };
  }, [show]);

  return show ? <p className="text-caption text-ink-muted">{fr.privacy.voiceNotice}</p> : null;
}
