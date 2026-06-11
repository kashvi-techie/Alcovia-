import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  FOCUS_DURATION_OPTIONS,
  BACKGROUND_GRACE_MS,
  StudentStats,
  COINS_PER_SESSION,
} from '@alvico/shared';
import { syncEngine } from '../sync-engine-client';
import { storage, clientId } from '../storage';

const styles = {
  container: {
    padding: '16px',
    backgroundColor: '#fff3e0',
    borderRadius: '8px',
    margin: '12px 0',
  },
  title: { fontSize: '16px', fontWeight: 'bold' as const, marginBottom: '12px', color: '#e65100' },
  row: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: '12px' },
  timer: { fontSize: '28px', fontWeight: 'bold' as const, fontFamily: 'monospace', color: '#e65100' },
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
  stats: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#555',
    padding: '8px',
    backgroundColor: '#fff9c4',
    borderRadius: '4px',
  },
};

export const FocusTimer: React.FC<{ onSessionComplete?: () => void }> = ({ onSessionComplete }) => {
  const [targetMinutes, setTargetMinutes] = useState<number>(25);
  const [isActive, setIsActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [stats, setStats] = useState<StudentStats>(storage.getStudentStats());

  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backgroundTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setStats(storage.getStudentStats()), 500);
    return () => clearInterval(interval);
  }, []);

  const endSession = useCallback(
    (status: 'completed' | 'abandoned', failReason?: 'give_up' | 'app_switch') => {
      if (!sessionIdRef.current) return;

      setIsActive(false);
      const actualDurationMs = Date.now() - startedAtRef.current;

      syncEngine.recordFocusSession(
        sessionIdRef.current,
        targetMinutes,
        actualDurationMs,
        status,
        status === 'abandoned' ? failReason || 'give_up' : undefined,
        startedAtRef.current,
        clientId
      );

      sessionIdRef.current = null;
      setStats(storage.getStudentStats());
      onSessionComplete?.();
    },
    [targetMinutes, onSessionComplete]
  );

  const endSessionRef = useRef(endSession);
  endSessionRef.current = endSession;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isActive && sessionIdRef.current) {
        backgroundTimeRef.current = Date.now();
      } else if (!document.hidden && backgroundTimeRef.current && isActive) {
        const backgroundDuration = Date.now() - backgroundTimeRef.current;
        if (backgroundDuration > BACKGROUND_GRACE_MS) {
          endSessionRef.current('abandoned', 'app_switch');
        }
        backgroundTimeRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            setTimeout(() => endSessionRef.current('completed'), 0);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  const startSession = () => {
    sessionIdRef.current = uuidv4();
    startedAtRef.current = Date.now();
    setSecondsLeft(targetMinutes * 60);
    setIsActive(true);
    backgroundTimeRef.current = null;
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div style={styles.container}>
      <div style={styles.title}>⏱️ Focus Session</div>

      <div style={styles.row}>
        <label style={{ fontSize: '12px' }}>
          Target:{' '}
          <select
            disabled={isActive}
            value={targetMinutes}
            onChange={(e) => {
              const mins = Number(e.target.value);
              setTargetMinutes(mins);
              if (!isActive) setSecondsLeft(mins * 60);
            }}
          >
            {FOCUS_DURATION_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={styles.row}>
        <div style={styles.timer}>
          {mm}:{ss}
        </div>
        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
          {isActive ? '🟢 RUNNING' : '⏸️ IDLE'}
        </span>
      </div>

      <div style={styles.row}>
        {!isActive ? (
          <button style={styles.button} onClick={startSession}>
            ▶️ Start
          </button>
        ) : (
          <>
            <button
              style={{ ...styles.button, backgroundColor: '#4caf50' }}
              onClick={() => endSession('completed')}
            >
              ✅ Complete Early
            </button>
            <button
              style={{ ...styles.button, backgroundColor: '#f44336' }}
              onClick={() => endSession('abandoned', 'give_up')}
            >
              ✕ Give Up
            </button>
          </>
        )}
      </div>

      <div style={styles.stats}>
        🪙 Coins: <strong>{stats.totalCoins}</strong> | 🔥 Streak:{' '}
        <strong>{stats.focusStreak}</strong> | 📅 Today:{' '}
        <strong>{stats.todayFocusMinutes} min</strong> | Reward per success:{' '}
        <strong>+{COINS_PER_SESSION}</strong>
      </div>
    </div>
  );
};
