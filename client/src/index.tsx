import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './components/App';

// Error boundary to catch and display errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red' }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error?.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

console.log('[Index] Starting app initialization...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[Index] Root element not found!');
  throw new Error('Root element not found');
}

console.log('[Index] Root element found, creating React root...');

const root = ReactDOM.createRoot(rootElement);
console.log('[Index] React root created, rendering App...');

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

console.log('[Index] App rendered successfully!');
