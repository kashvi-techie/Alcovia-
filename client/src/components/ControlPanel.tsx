import React, { useState, useEffect } from 'react';
import { syncClient } from '../sync-client';
import { syncEngine } from '../sync-engine-client';
import { storage, clientId } from '../storage';
import { DevStatePanel } from './DevStatePanel';

const styles = {
  container: {
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #ddd',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
  },
  online: { backgroundColor: '#4caf50', color: 'white' },
  offline: { backgroundColor: '#f44336', color: 'white' },
  button: {
    padding: '8px 14px',
    backgroundColor: '#2196f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold' as const,
  },
};

export const ControlPanel: React.FC = () => {
  const [isOnline, setIsOnline] = useState(syncEngine.getIsOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showDev, setShowDev] = useState(true);
  const [lastSync, setLastSync] = useState<string>('—');

  useEffect(() => {
    const tick = () => {
      setIsOnline(syncEngine.getIsOnline());
      setPendingCount(syncEngine.getPendingOperations().length);
    };
    const interval = setInterval(tick, 400);
    window.addEventListener('online', tick);
    window.addEventListener('offline', tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', tick);
      window.removeEventListener('offline', tick);
    };
  }, []);

  const toggleOffline = () => {
    const next = !storage.isForceOffline();
    storage.setForceOffline(next);
    setIsOnline(syncEngine.getIsOnline());
  };

  const handleSync = async () => {
    setSyncing(true);
    const result = await syncClient.sync();
    if (result) setLastSync(new Date().toLocaleTimeString());
    setPendingCount(syncEngine.getPendingOperations().length);
    setSyncing(false);
  };

  return (
    <>
      <div style={styles.container}>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
          📱 Client <code>{clientId.toUpperCase()}</code>
        </div>

        <div style={{ ...styles.badge, ...(isOnline ? styles.online : styles.offline) }}>
          {isOnline ? '🌐 ONLINE' : '📡 OFFLINE'}
        </div>

        <button style={{ ...styles.button, backgroundColor: '#ff9800' }} onClick={toggleOffline}>
          {storage.isForceOffline() ? 'Simulate Online' : 'Simulate Offline'}
        </button>

        <div style={{ fontSize: '12px', color: '#555' }}>
          Pending: <strong>{pendingCount}</strong> | Seq:{' '}
          <strong>{syncEngine.getCurrentSequence()}</strong> | Last sync: {lastSync}
        </div>

        <button
          style={styles.button}
          onClick={handleSync}
          disabled={!isOnline || syncing}
        >
          {syncing ? '⏳ Syncing...' : '🔄 Sync Now'}
        </button>

        <button
          style={{ ...styles.button, backgroundColor: '#9c27b0' }}
          onClick={() => setShowDev((v) => !v)}
        >
          {showDev ? 'Hide Dev Panel' : 'Show Dev Panel'}
        </button>
      </div>

      {showDev && <DevStatePanel />}
    </>
  );
};
