import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ padding: 16, margin: 16, border: '1px solid #e57373', background: '#fff5f5' }}>
          <h3 style={{ marginTop: 0, color: '#c62828' }}>Something went wrong in this section</h3>
          <p style={{ color: '#555' }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button className="btn btn-primary" onClick={this.handleReset}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
