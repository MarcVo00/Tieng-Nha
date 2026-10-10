import { useId, type InputHTMLAttributes } from "react";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
  label: string;
  error?: string | null;
  hint?: string;
  inputClassName?: string;
};

export function TextField({ label, error, hint, inputClassName, ...rest }: TextFieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body-strong text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={`min-h-12 rounded-md border-2 bg-surface px-4 text-body text-ink placeholder:text-ink-muted ${
          error ? "border-error" : "border-line"
        } ${inputClassName ?? ""}`}
        {...rest}
      />
      {note ? (
        <p id={noteId} role={error ? "alert" : undefined} className={`text-caption ${error ? "text-error" : "text-ink-muted"}`}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
