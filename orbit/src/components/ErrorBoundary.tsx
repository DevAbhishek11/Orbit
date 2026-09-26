import { Component, type ErrorInfo, type ReactNode } from "react";

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
        <div
          className="error-boundary-box"
          role="alert"
          style={{ padding: 24, margin: "16px auto", maxWidth: 640 }}
        >
          <div className="error-box">
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>
              Something went wrong{" "}
              {this.props.name ? `in ${this.props.name}` : ""}
            </h3>
            <p style={{ margin: "0 0 12px", fontSize: 13.5, opacity: 0.9 }}>
              {this.state.error.message ||
                "An unexpected rendering error occurred."}
            </p>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="btn btn--sm"
                onClick={this.reset}
              >
                Try again
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
              <a href="/" className="btn btn--sm btn--ghost">
                Go to Dashboard
              </a>
            </div>
            {import.meta.env.DEV && this.state.error.stack ? (
              <details
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  fontFamily: "monospace",
                  opacity: 0.8,
                }}
              >
                <summary style={{ cursor: "pointer", marginBottom: 4 }}>
                  View technical stack
                </summary>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
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
