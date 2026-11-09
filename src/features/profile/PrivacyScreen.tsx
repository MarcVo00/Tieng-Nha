import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { duration, ease, Icon, tap } from "@/ui";

// Hero: plain answers to « what happens to my data ». Reading is the point, so no card and no action.
// The contact comes from the group row: the code is public, the contact is for members only.

export function PrivacyScreen() {
  const { auth } = useServices();
  const t = fr.privacy;
  const [contact, setContact] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    auth.getPrivacyContact().then(
      (c) => !cancelled && setContact(c),
      () => undefined, // offline: the page keeps its fallback sentence
    );
    return () => {
      cancelled = true;
    };
  }, [auth]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.base, ease: ease.out }}
      className="flex flex-col gap-6 pb-8"
    >
      <div className="flex items-center gap-1">
        <motion.div whileTap={tap}>
          <Link to="/me" aria-label={t.back} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted">
            <Icon name="chevron-left" size={24} />
          </Link>
        </motion.div>
        <h1 className="text-title text-ink">{t.title}</h1>
      </div>

      <section>
        <h2 className="text-heading text-ink">{t.who.title}</h2>
        <p className="mt-1 text-body text-ink-muted">{contact ? t.who.body(contact) : t.who.fallback}</p>
      </section>

      {t.sections.map((s) => (
        <section key={s.title}>
          <h2 className="text-heading text-ink">{s.title}</h2>
          <p className="mt-1 text-body text-ink-muted">{s.body}</p>
        </section>
      ))}
    </motion.div>
  );
}
