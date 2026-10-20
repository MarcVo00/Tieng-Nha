import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { spring } from "@/ui/motion";

/** A balance (xu, Kim bài) that drops in when its text changes; the first render and reduced motion are instant. */
export function DropNumber({ children, className }: { children: string; className?: string }) {
  const reduced = useReducedMotion();
  const previous = useRef(children);
  const changed = previous.current !== children;
  useEffect(() => {
    previous.current = children;
  });
  return (
    <motion.span
      key={children}
      className={`inline-block ${className ?? ""}`}
      initial={changed && !reduced ? { y: -14, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={spring.snappy}
    >
      {children}
    </motion.span>
  );
}
