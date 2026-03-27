import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  ERROR_TITLE, ERROR_MESSAGE, ERROR_TRY_AGAIN, ERROR_RELOAD, ERROR_DETAILS,
} from '../constants/strings.ts';

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
            <h2 className="font-600 text-20 mb-8" style={{ color: 'var(--dm-text)' }}>
              {ERROR_TITLE}
            </h2>
            <p className="text-light text-14 text-center" style={{ marginBottom: '24px', maxWidth: '400px' }}>
              {ERROR_MESSAGE}
            </p>
            <div className="flex gap-12">
              <button
                onClick={this.handleRetry}
                className="btn btn-primary text-14"
                style={{ padding: '10px 24px' }}
              >
                {ERROR_TRY_AGAIN}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-secondary text-14"
                style={{ padding: '10px 24px' }}
              >
                {ERROR_RELOAD}
              </button>
            </div>
            {this.state.error && (
              <details className="w-full" style={{ marginTop: '24px', maxWidth: '500px' }}>
                <summary className="text-light text-12 cursor-pointer">
                  {ERROR_DETAILS}
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
