import { Component, type ReactNode, type ErrorInfo } from 'react';
import { DelightfulError } from './DelightfulError';

interface Props {
  children: ReactNode;
  /** Label shown in the fallback UI (e.g. "Settings", "History"). */
  panel: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Lightweight error boundary for individual panels.
 * Shows a recoverable inline error with a retry button.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[PanelErrorBoundary:${this.props.panel}]`, error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <DelightfulError
          variant="generic"
          title={`${this.props.panel} error`}
          message={this.state.error?.message || 'Something went wrong in this panel.'}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}
