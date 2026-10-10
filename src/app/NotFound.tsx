import { Link } from "react-router-dom";
import { fr } from "@/i18n/fr";
import { EmptyState } from "@/ui";

export function NotFound() {
  return (
    <EmptyState
      title={fr.app.notFound.title}
      body={fr.app.notFound.body}
      illustration="boat"
      action={
        <Link to="/" className="inline-flex min-h-11 items-center text-body-strong text-primary">
          {fr.app.notFound.home}
        </Link>
      }
    />
  );
}
