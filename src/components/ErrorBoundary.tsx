import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as any).message)
        : String(err);
    return { hasError: true, message: msg };
  }

  componentDidCatch(err: unknown) {
    // Keep console signal for debugging (no UI change)
    console.error("CineSafari React error boundary caught:", err);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ margin: "0 0 8px" }}>CineSafari hit an error.</h2>
        <p style={{ margin: "0 0 12px" }}>
          Try refreshing. If this happened after an update, you may need to clear
          the site cache.
        </p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,.25)",
            background: "rgba(17,24,39,.65)",
            color: "#f9fafb",
            overflow: "auto",
          }}
        >
          {this.state.message || "Unknown error"}
        </pre>
      </div>
    );
  }
}
