import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { fr } from "@/i18n/fr";
import { Button, EmptyState } from "@/ui";

type Props = { children?: ReactNode };
type State = { failed: boolean; chunkError: boolean };
const CHUNK_ERROR = /dynamically imported module|Loading chunk|Failed to fetch/i;

export class FeatureErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false, chunkError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, chunkError: error instanceof Error && CHUNK_ERROR.test(error.message) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced in the browser console only; there is no remote error sink in V1.
    console.error(error, info.componentStack);
  }

  private reset = (): void => {
    // A stale deploy leaves missing chunks: only a full reload can recover.
    if (this.state.chunkError) window.location.reload();
    else this.setState({ failed: false, chunkError: false });
  };

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <EmptyState
        title={fr.app.error.title}
        body={fr.app.error.body}
        illustration="boat"
        action={
          <div className="flex flex-col items-start gap-2">
            <Button onClick={this.reset}>{fr.app.error.retry}</Button>
            <Link to="/" className="inline-flex min-h-11 items-center text-body-strong text-primary">
              {fr.app.error.home}
            </Link>
          </div>
        }
      />
    );
  }
}
