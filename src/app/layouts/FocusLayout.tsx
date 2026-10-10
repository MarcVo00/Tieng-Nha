import { AnimatePresence } from "motion/react";
import { useLocation, useOutlet } from "react-router-dom";
import { PageTransition } from "@/ui";

export function FocusLayout() {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  return (
    <div className="mx-auto min-h-dvh max-w-md overflow-x-hidden">
      <AnimatePresence mode="wait">
        <PageTransition key={pathname} variant="focus">
          {outlet}
        </PageTransition>
      </AnimatePresence>
    </div>
  );
}
