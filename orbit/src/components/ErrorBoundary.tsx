import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, ErrorBox } from "./ui";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  name?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[ErrorBoundary:${this.props.name ?? "unnamed"}] caught error:`,
      error,
      errorInfo,
    );
  }

  reset = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error, this.reset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div role="alert" className="mx-auto my-6 max-w-[640px] px-4">
          <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger-soft text-danger">
                <AlertTriangle size={16} aria-hidden />
              </span>
              <h3 className="text-[15px] font-bold text-ink">
                Something went wrong{" "}
                {this.props.name ? `in ${this.props.name}` : ""}
              </h3>
            </div>
            <ErrorBox
              message={
                this.state.error.message ||
                "An unexpected rendering error occurred."
              }
            />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={this.reset}>
                Try again
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.location.reload()}
              >
                Reload page
              </Button>
              <a
                href="/"
                className="text-[12.5px] font-semibold text-brand hover:underline"
              >
                Go to Dashboard
              </a>
            </div>
            {import.meta.env.DEV && this.state.error.stack ? (
              <details className="mt-4 font-mono text-[11px] text-muted">
                <summary className="cursor-pointer">
                  View technical stack
                </summary>
                <pre className="mt-2 max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
              </details>
            ) : null}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
