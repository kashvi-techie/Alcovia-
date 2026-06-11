import React from 'react';
import { ControlPanel } from './ControlPanel';
import { FocusTimer } from './FocusTimer';
import { SyllabusTracker } from './SyllabusTracker';
import { WebhookLogPanel } from './WebhookLogPanel';

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#fafafa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0',
  },
};

export const App: React.FC = () => {
  return (
    <div style={styles.app}>
      <ControlPanel />

      <div style={styles.main}>
        <FocusTimer />
        <SyllabusTracker />
        <WebhookLogPanel />
      </div>
    </div>
  );
};
