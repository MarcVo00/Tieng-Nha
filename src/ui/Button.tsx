import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { fr } from "@/i18n/fr";
import { duration, spring, tap } from "@/ui/motion";

export type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
};

const VARIANT: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-primary text-primary-on border-b-4 border-primary-hover active:translate-y-[2px] active:border-b-2",
  secondary: "bg-surface border-2 border-line text-ink",
  ghost: "bg-transparent text-primary",
  danger: "bg-error text-primary-on border-b-4 border-ink active:translate-y-[2px] active:border-b-2",
};

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
  const sizing = size === "lg" ? "px-5 py-4 text-heading" : "px-5 py-3 text-body-strong";
  return (
    <motion.button
      type={type}
      whileTap={tap}
      transition={spring.snappy}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative inline-flex min-h-11 min-w-11 select-none items-center justify-center gap-2 rounded-md disabled:opacity-50 ${sizing} ${VARIANT[variant]} ${fullWidth ? "w-full" : ""} ${className ?? ""}`}
      {...rest}
    >
      <span className={`inline-flex items-center justify-center gap-2 ${loading ? "opacity-0" : ""}`}>{children}</span>
      {loading ? (
        <>
          <Dots />
          <span className="sr-only">{fr.ui.button.loading}</span>
        </>
      ) : null}
    </motion.button>
  );
}
