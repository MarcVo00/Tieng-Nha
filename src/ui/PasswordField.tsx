import { useId, useState, type InputHTMLAttributes } from "react";
import { motion } from "motion/react";
import { fr } from "@/i18n/fr";
import { Icon } from "@/ui/icons";
import { tap } from "@/ui/motion";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className" | "type"> & {
  label: string;
  autoComplete: "current-password" | "new-password";
  error?: string | null;
  hint?: string;
};

/** Password input with a show/hide eye. The eye is a toggle button (aria-pressed), 44 px wide, inside the field's right edge. */
export function PasswordField({ label, error, hint, ...rest }: PasswordFieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const [shown, setShown] = useState(false);
  const note = error ?? hint;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body-strong text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          autoCapitalize="none"
          spellCheck={false}
          className={`min-h-12 w-full rounded-md border-2 bg-surface pl-4 pr-12 text-body text-ink placeholder:text-ink-muted ${error ? "border-error" : "border-line"}`}
          {...rest}
        />
        <motion.button
          type="button"
          whileTap={tap}
          aria-label={fr.password.show}
          aria-pressed={shown}
          onClick={() => setShown((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-md text-ink-muted"
        >
          <Icon name={shown ? "eye-off" : "eye"} size={22} />
        </motion.button>
      </div>
      {note ? (
        <p id={noteId} role={error ? "alert" : undefined} className={`text-caption ${error ? "text-error" : "text-ink-muted"}`}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
