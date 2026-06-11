import axios from 'axios';
import { SyncPayload, SyncResponse, STUDENT_ID } from '@alvico/shared';
import { syncEngine } from './sync-engine-client';
import { storage, clientId } from './storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export class SyncClient {
  async sync(): Promise<SyncResponse | null> {
    if (!syncEngine.getIsOnline()) {
      console.log('📴 Offline — sync skipped');
      return null;
    }

    syncEngine.reloadPendingOperations();
    const pendingOps = syncEngine.getPendingOperations();

    const payload: SyncPayload = {
      clientId,
      studentId: STUDENT_ID,
      operations: pendingOps,
      lastSyncSequence: storage.getLastSyncSequence(),
    };

    try {
      console.log(`🔄 Syncing ${pendingOps.length} operation(s)...`);
      const response = await axios.post<SyncResponse>(`${API_BASE_URL}/api/sync`, payload, {
        timeout: 10000,
      });

      const result = response.data;

      storage.setSyllabus(result.reconciled.syllabus);
      storage.setStudentStats(result.reconciled.studentStats);
      storage.setLastSyncSequence(result.serverSequence);
      syncEngine.clearPendingOperations();

      if (result.webhookFired) {
        storage.addWebhookLog(result.webhookFired.sessionId, result.webhookFired.message);
      }

      if (result.conflictsResolved.length > 0) {
        console.log('⚖️ Conflicts resolved:', result.conflictsResolved);
      }

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Sync failed:', message);
      return null;
    }
  }

  async fetchServerState() {
    if (!syncEngine.getIsOnline()) return null;
    try {
      const response = await axios.get(`${API_BASE_URL}/api/state`);
      return response.data;
    } catch {
      return null;
    }
  }

  async fetchNotificationLog() {
    if (!syncEngine.getIsOnline()) return [];
    try {
      const response = await axios.get(`${API_BASE_URL}/api/notification-log`);
      return response.data;
    } catch {
      return [];
    }
  }
}

export const syncClient = new SyncClient();
