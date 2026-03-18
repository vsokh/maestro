import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">!</div>
            <h2 style={{ fontWeight: 600, fontSize: '20px', color: 'var(--dm-text)', marginBottom: '8px' }}>
              Something went wrong
            </h2>
            <p className="text-light" style={{ fontSize: '14px', marginBottom: '24px', maxWidth: '400px', textAlign: 'center' }}>
              An unexpected error occurred. You can try reloading or continue from where you left off.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={this.handleRetry}
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontSize: '14px' }}
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-secondary"
                style={{ padding: '10px 24px', fontSize: '14px' }}
              >
                Reload page
              </button>
            </div>
            {this.state.error && (
              <details style={{ marginTop: '24px', maxWidth: '500px', width: '100%' }}>
                <summary className="text-light" style={{ fontSize: '12px', cursor: 'pointer' }}>
                  Error details
                </summary>
                <pre className="error-boundary-details">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
