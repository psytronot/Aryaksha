import { Component, StrictMode } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Remove campaign/share query parameters so the app always opens on a clean URL.
if (window.location.search) {
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.hash);
}

type RootErrorBoundaryProps = { children: ReactNode };
type RootErrorBoundaryState = { hasError: boolean; error: Error | null };

class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Orbital Lab render failure:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const error = this.state.error;
      return (
        <main
          role="alert"
          style={{
            minHeight: '100vh',
            boxSizing: 'border-box',
            display: 'grid',
            placeItems: 'center',
            padding: '24px',
            background: '#030712',
            color: '#f8fafc',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          <section style={{ width: '100%', maxWidth: '720px', padding: '24px', border: '1px solid #374151', borderRadius: '10px', background: '#0b0f19' }}>
            <h1 style={{ margin: '0 0 12px', color: '#f87171', fontSize: '18px' }}>Orbital Lab — Runtime Error</h1>
            <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>The interface encountered a rendering error. Reload the simulation to try again.</p>
            <p style={{ overflowWrap: 'anywhere', color: '#fca5a5', fontSize: '13px' }}>
              {error?.name || 'Error'}: {error?.message || 'Unknown rendering error'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ border: 0, borderRadius: '6px', padding: '10px 14px', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
            >
              Reload Simulation
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </StrictMode>
  );
} else {
  console.error('Orbital Lab initialization failed: #root element is missing.');
  const fallback = document.createElement('main');
  fallback.setAttribute('role', 'alert');
  fallback.style.cssText = 'min-height:100vh;box-sizing:border-box;padding:24px;background:#030712;color:#f87171;font-family:ui-monospace,monospace;';
  fallback.textContent = 'Orbital Lab could not start because the root mount element is missing. Check index.html.';
  document.body.appendChild(fallback);
}
