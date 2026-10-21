import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useServices } from "@/app/ServicesProvider";
import { markVersionSeen } from "@/app/useNews";
import type { ChangelogEntry } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { Button, Card, duration, EmptyState, ease, Icon, Skeleton, tap } from "@/ui";

// Hero: the newest version at the top, then the history on a quiet rail. No action: reading is the point.
// Opening the page marks the newest version as seen (the dot on « Moi » goes away).

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; entries: ChangelogEntry[] };

const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));

export function NewsScreen() {
  const { content } = useServices();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    content.getChangelog().then(
      (entries) => {
        if (cancelled) return;
        setLoad({ status: "ready", entries });
        const newest = entries[0];
        if (newest) markVersionSeen(newest.version);
      },
      () => !cancelled && setLoad({ status: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [content, attempt]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.base, ease: ease.out }}
      className="flex flex-col gap-4 pb-8"
    >
      <div className="flex items-center gap-1">
        <motion.div whileTap={tap}>
          <Link
            to="/me"
            aria-label={fr.news.back}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted"
          >
            <Icon name="chevron-left" size={24} />
          </Link>
        </motion.div>
        <h1 className="text-title text-ink">{fr.news.title}</h1>
      </div>

      {load.status === "loading" ? (
        <div role="status" aria-label={fr.app.loading}>
          <Skeleton lines={4} className="h-16" />
        </div>
      ) : load.status === "error" ? (
        <EmptyState
          title={fr.news.error.title}
          body={fr.news.error.body}
          illustration="boat"
          action={
            <Button variant="secondary" onClick={retry}>
              {fr.app.error.retry}
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-body text-ink-muted">{fr.news.lead}</p>
          <ol aria-label={fr.news.listLabel} className="flex list-none flex-col gap-4">
            {load.entries.map((entry) => {
              const current = entry.version === __APP_VERSION__;
              return (
                <li key={entry.version}>
                  <Card raised={current} className="flex flex-col gap-2 p-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="tabular text-heading text-ink">{fr.news.version(entry.version)}</p>
                      {current ? (
                        <span className="rounded-full bg-primary px-3 py-0.5 text-caption font-semibold text-primary-on">
                          {fr.news.current}
                        </span>
                      ) : null}
                      <p className="ml-auto text-caption text-ink-muted">{formatDate(entry.date)}</p>
                    </div>
                    <p className="text-body-strong text-ink">{entry.title}</p>
                    <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-ink-muted marker:text-line">
                      {entry.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </Card>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </motion.div>
  );
}
