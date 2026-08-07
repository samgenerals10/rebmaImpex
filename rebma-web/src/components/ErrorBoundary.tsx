import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Without this, any uncaught render error anywhere in the tree silently
// unmounts the whole app — the user is left staring at a blank page with
// no error message and no way to recover except guessing to hard-refresh.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '1rem',
          background: '#0f172a', color: 'white', textAlign: 'center', padding: '1.5rem', zIndex: 10000,
        }}>
          <p style={{ fontSize: '1rem', fontWeight: 700 }}>Something went wrong.</p>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: '24rem' }}>
            The app hit an unexpected error. Reloading usually fixes this.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.6rem 1.5rem', background: '#22c55e', color: 'white',
              border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
