import express from 'express';
import cors from 'cors';
import { SyncPayload } from '@alvico/shared';
import {
  processSync,
  getServerState,
  getAuditTrail,
  getWebhookLog,
  getNotificationLog,
} from './sync-processor';
import { webhookService } from './webhook-service';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.post('/api/sync', async (req, res) => {
  try {
    const payload: SyncPayload = req.body;

    console.log(`\n📱 Sync from client ${payload.clientId}: ${payload.operations.length} ops`);

    const response = await processSync(payload);

    console.log(`✅ Sync done — webhook: ${response.webhookFired ? 'yes' : 'no'}`);

    res.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Sync error:', message);
    res.status(500).json({ success: false, error: message });
  }
});

app.get('/api/state', (_req, res) => {
  res.json(getServerState());
});

app.get('/api/audit-trail', (_req, res) => {
  res.json(getAuditTrail());
});

app.get('/api/webhook-log', (_req, res) => {
  res.json(getWebhookLog());
});

app.get('/api/notification-log', (_req, res) => {
  res.json(getNotificationLog());
});

/** Mock notification sink — n8n workflow POSTs here, or server falls back directly */
app.post('/api/mock-notify', (req, res) => {
  const { sessionId, message, studentId, streak, coinsEarned } = req.body;
  const text =
    message ||
    `Streak now ${streak} days, +${coinsEarned} coins. (session ${sessionId})`;

  webhookService.recordNotification(sessionId, text);
  console.log(`🔔 Notification: ${text} [student=${studentId}]`);

  res.json({ success: true, logged: true, sessionId });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log('   POST /api/sync');
  console.log('   GET  /api/state');
  console.log('   POST /api/mock-notify (mock WhatsApp sink)\n');
});
