import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { fr } from "@/i18n/fr";
import { Button, EmptyState } from "@/ui";

type Props = { children?: ReactNode };
type State = { failed: boolean };

export class FeatureErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced in the browser console only; there is no remote error sink in V1.
    console.error(error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ failed: false });
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
