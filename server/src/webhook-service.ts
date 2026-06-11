import axios from 'axios';

export interface N8nWebhookPayload {
  studentId: string;
  streak: number;
  coinsEarned: number;
  sessionId: string;
  timestamp: number;
  message: string;
}

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/alvico-sync';

const MOCK_NOTIFY_URL =
  process.env.MOCK_NOTIFY_URL || 'http://localhost:3001/api/mock-notify';

export class WebhookService {
  private webhookLog: Array<{
    payload: N8nWebhookPayload;
    status: 'success' | 'failed';
    statusCode?: number;
    error?: string;
    timestamp: number;
  }> = [];

  private notificationLog: Array<{
    sessionId: string;
    message: string;
    timestamp: number;
    source: 'n8n-callback' | 'direct';
  }> = [];

  async fireWebhook(payload: N8nWebhookPayload): Promise<boolean> {
    try {
      const response = await axios.post(N8N_WEBHOOK_URL, payload, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
      });

      this.webhookLog.push({
        payload,
        status: 'success',
        statusCode: response.status,
        timestamp: Date.now(),
      });

      console.log(`✅ Webhook fired for session ${payload.sessionId}`);
      return true;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      // Fall back to mock notification sink when n8n is not running
      try {
        await axios.post(MOCK_NOTIFY_URL, payload, { timeout: 3000 });
        this.notificationLog.push({
          sessionId: payload.sessionId,
          message: payload.message,
          timestamp: Date.now(),
          source: 'direct',
        });
        this.webhookLog.push({
          payload,
          status: 'success',
          statusCode: 200,
          timestamp: Date.now(),
        });
        console.log(`✅ Mock notification logged for session ${payload.sessionId}`);
        return true;
      } catch {
        this.webhookLog.push({
          payload,
          status: 'failed',
          error: errorMsg,
          timestamp: Date.now(),
        });
        console.warn(`⚠️ Webhook failed for session ${payload.sessionId}:`, errorMsg);
        return false;
      }
    }
  }

  recordNotification(sessionId: string, message: string): void {
    this.notificationLog.push({
      sessionId,
      message,
      timestamp: Date.now(),
      source: 'n8n-callback',
    });
  }

  getWebhookLog() {
    return this.webhookLog;
  }

  getNotificationLog() {
    return this.notificationLog;
  }
}

export const webhookService = new WebhookService();
