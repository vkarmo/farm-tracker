import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ padding: '20px', border: '2px solid red' }}>
          <h2 style={{ color: 'red' }}>Something went wrong loading this tab.</h2>
          <details style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', background: '#f5f5f5', padding: '10px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>{this.state.error?.toString()}</summary>
            {this.state.errorInfo?.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
