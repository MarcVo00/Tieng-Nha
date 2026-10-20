import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { fr } from "@/i18n/fr";
import { duration, ease, spring, tap } from "@/ui/motion";

export type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
};

const VARIANT: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "overflow-hidden bg-primary text-primary-on border-b-4 border-primary-hover active:translate-y-[2px] active:border-b-2",
  secondary: "bg-surface border-2 border-line text-ink",
  ghost: "bg-transparent text-primary",
  danger: "bg-error text-primary-on border-b-4 border-ink active:translate-y-[2px] active:border-b-2",
};

// Disabled primary reads as "not available": red is reserved for an action that can be taken now.
const PRIMARY_DISABLED = "overflow-hidden cursor-not-allowed bg-surface-2 text-ink-muted border-b-4 border-line";

/** One lacquer glint sweeping across the button, mounted only when it turns from disabled to enabled (transform only). */
function Shine() {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12"
      style={{ background: "linear-gradient(90deg, transparent, var(--shine), transparent)" }}
      initial={{ x: "-120%" }}
      animate={{ x: "420%" }}
      transition={{ duration: duration.celebrate, ease: ease.out }}
    />
  );
}

function Dots() {
  return (
    <span className="absolute inset-0 flex items-center justify-center gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-current"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: duration.pulse, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

export function Button({ variant = "primary", size = "md", loading = false, fullWidth = false, className, disabled, children, type = "button", ...rest }: ButtonProps) {
  const reduced = useReducedMotion();
  const wasDisabled = useRef(disabled === true);
  const [shine, setShine] = useState(0);
  useEffect(() => {
    const now = disabled === true;
    if (variant === "primary" && wasDisabled.current && !now && !reduced) setShine((n) => n + 1);
    wasDisabled.current = now;
  }, [disabled, variant, reduced]);
  const greyed = variant === "primary" && disabled === true && !loading;
  const sizing = size === "lg" ? "px-5 py-4 text-heading" : "px-5 py-3 text-body-strong";
  return (
    <motion.button
      type={type}
      whileTap={tap}
      transition={spring.snappy}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative inline-flex min-h-11 min-w-11 select-none items-center justify-center gap-2 rounded-md ${greyed ? "" : "disabled:opacity-50"} ${sizing} ${greyed ? PRIMARY_DISABLED : VARIANT[variant]} ${fullWidth ? "w-full" : ""} ${className ?? ""}`}
      {...rest}
    >
      <span className={`inline-flex items-center justify-center gap-2 ${loading ? "opacity-0" : ""}`}>{children}</span>
      {shine > 0 ? <Shine key={shine} /> : null}
      {loading ? (
        <>
          <Dots />
          <span className="sr-only">{fr.ui.button.loading}</span>
        </>
      ) : null}
    </motion.button>
  );
}
