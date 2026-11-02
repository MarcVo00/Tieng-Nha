import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fr } from "@/i18n/fr";
import type { LanguageId } from "@/domain/languages";
import { useLanguage } from "@/app/useLanguage";
import { LanguageList, Motif, useToast } from "@/ui";

// Hero: the question. One action: tapping a language (Vietnamese is highlighted, never chosen for the player).
// Secondary: the line saying the choice can change later. Error: a toast, the tiles stay usable.
export function LanguagePickerScreen() {
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function choose(id: LanguageId) {
    setSaving(true);
    try {
      await setLanguage(id);
    } catch {
      setSaving(false);
      toast.show({ title: fr.languages.saveError });
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="relative min-h-dvh px-5 pb-10 pt-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 text-primary [mask-image:linear-gradient(to_bottom,black,transparent)]">
        <Motif kind="waves" />
      </div>
      <div className="relative">
        <h1 className="text-title text-ink">{fr.languages.title}</h1>
        <p className="mt-2 text-body text-ink-muted">{fr.languages.intro}</p>
        <LanguageList className="mt-8" current={language.id} onPick={(id) => void choose(id)} disabled={saving} />
      </div>
    </div>
  );
}
