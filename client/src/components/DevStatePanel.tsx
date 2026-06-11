import React, { useEffect, useState } from 'react';
import { StudentStats, Syllabus } from '@alvico/shared';
import { storage } from '../storage';
import { syncClient } from '../sync-client';
import { syncEngine } from '../sync-engine-client';

const box: React.CSSProperties = {
  padding: '12px',
  backgroundColor: '#eceff1',
  borderBottom: '1px solid #cfd8dc',
  fontSize: '11px',
  fontFamily: 'monospace',
};

export const DevStatePanel: React.FC = () => {
  const [syllabus, setSyllabus] = useState<Syllabus>(storage.getSyllabus());
  const [stats, setStats] = useState<StudentStats>(storage.getStudentStats());
  const [serverState, setServerState] = useState<unknown>(null);
  const [notifications, setNotifications] = useState<unknown[]>([]);

  useEffect(() => {
    const refresh = async () => {
      setSyllabus(storage.getSyllabus());
      setStats(storage.getStudentStats());
      if (syncEngine.getIsOnline()) {
        setServerState(await syncClient.fetchServerState());
        setNotifications(await syncClient.fetchNotificationLog());
      }
    };

    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  const completedTasks = syllabus.subjects
    .flatMap((s) => s.chapters)
    .flatMap((c) => c.tasks)
    .filter((t) => t.status === 'completed' && !t.deleted).length;

  return (
    <div style={box}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>🛠️ Dev Panel — Device State</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <div>Local coins: {stats.totalCoins} | streak: {stats.focusStreak} | today: {stats.todayFocusMinutes}m</div>
          <div>Completed tasks (local): {completedTasks}</div>
          <div>Pending ops: {syncEngine.getPendingOperations().length}</div>
          <div>Force offline: {storage.isForceOffline() ? 'yes' : 'no'}</div>
        </div>
        <div>
          <div style={{ fontWeight: 'bold' }}>Server state snapshot</div>
          <pre style={{ maxHeight: '120px', overflow: 'auto', margin: 0 }}>
            {serverState ? JSON.stringify(serverState, null, 2) : 'offline / unavailable'}
          </pre>
        </div>
      </div>
      <div style={{ marginTop: '8px' }}>
        <div style={{ fontWeight: 'bold' }}>
          n8n / mock notifications ({notifications.length}) — deduped by sessionId
        </div>
        <pre style={{ maxHeight: '80px', overflow: 'auto', margin: 0 }}>
          {JSON.stringify(notifications, null, 2)}
        </pre>
      </div>
    </div>
  );
};
