import { useCallback } from "react";
import { LANGUAGES, type Language, type LanguageId } from "@/domain/languages";
import { useSettings } from "@/app/appState";

/** The language being learned. Until one is chosen the app is Vietnamese and `chosen` is false. */
export function useLanguage(): { language: Language; setLanguage(id: LanguageId): Promise<void>; chosen: boolean } {
  const { settings, updateSettings } = useSettings();
  const setLanguage = useCallback((id: LanguageId) => updateSettings({ language: id }), [updateSettings]);
  return { language: LANGUAGES[settings.language ?? "vi"], setLanguage, chosen: settings.language !== null };
}
