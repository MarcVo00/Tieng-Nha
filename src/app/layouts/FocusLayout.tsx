import { AnimatePresence } from "motion/react";
import { Fragment } from "react";
import { useLanguage } from "@/app/useLanguage";
import { useLocation, useOutlet } from "react-router-dom";
import { PageTransition } from "@/ui";

export function FocusLayout() {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const { language } = useLanguage();
  return (
    <main className="mx-auto min-h-dvh max-w-md overflow-x-hidden">
      <AnimatePresence mode="wait">
        <PageTransition key={pathname} variant="focus">
          <Fragment key={language.id}>{outlet}</Fragment>
        </PageTransition>
      </AnimatePresence>
    </main>
  );
}
