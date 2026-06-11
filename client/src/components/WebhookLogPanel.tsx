import React, { useState, useEffect } from 'react';
import { storage } from '../storage';

export const WebhookLogPanel: React.FC = () => {
  const [logs, setLogs] = useState(storage.getWebhookLogs());

  useEffect(() => {
    const interval = setInterval(() => setLogs(storage.getWebhookLogs()), 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '12px', backgroundColor: '#f3e5f5', borderRadius: '8px', margin: '12px 0' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#4a148c' }}>
        🎣 Webhook / Notification Log (client view)
      </div>
      {logs.length === 0 ? (
        <div style={{ fontSize: '12px', color: '#999' }}>No notifications yet — complete a focus session and sync</div>
      ) : (
        logs.map((log, idx) => (
          <div
            key={log.sessionId}
            style={{
              padding: '8px',
              borderBottom: idx < logs.length - 1 ? '1px solid #eee' : 'none',
              fontSize: '12px',
              fontFamily: 'monospace',
            }}
          >
            ✅ {log.message}{' '}
            <span style={{ color: '#888' }}>
              [{log.sessionId.slice(0, 8)}… @ {new Date(log.timestamp).toLocaleTimeString()}]
            </span>
          </div>
        ))
      )}
    </div>
  );
};
