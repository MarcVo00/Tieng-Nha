import { useEffect, useRef } from "react";

type Options = { ids: readonly string[]; selected: string | null; disabled: boolean; onSelect: (id: string) => void; onSubmit: () => void };

// Keys 1-4 pick an option, Enter validates. Inactive once the exercise is answered.
export function useChoiceKeys(opts: Options): void {
  const ref = useRef(opts);
  ref.current = opts;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { ids, selected, disabled, onSelect, onSubmit } = ref.current;
      if (disabled || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [role=dialog]")) return;
      if (e.key === "Enter") {
        // The focused "Vérifier" button handles Enter natively.
        if (target instanceof HTMLElement && target.dataset["submit"] === "true") return;
        if (selected === null) return;
        e.preventDefault();
        onSubmit();
        return;
      }
      const index = Number(e.key) - 1;
      const id = Number.isInteger(index) ? ids[index] : undefined;
      if (id !== undefined) onSelect(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
