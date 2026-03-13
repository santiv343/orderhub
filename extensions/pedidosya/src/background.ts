import { RETRY } from './constants';
import type { QueueItem } from './extension.types';
import type { ImportedOrder } from '@orderhub/types';
import { getConfig, getQueue, saveQueue } from './storage';
import { sendOrders } from './api';
import { tryExtractOrder } from './parser';

// ─── Queue logic (exported for tests) ──────────────────────────────────────

export interface QueueProcessor {
  send: (orders: ImportedOrder[], apiKey: string, backendUrl: string) => Promise<unknown>;
  saveQueue: (queue: QueueItem[]) => Promise<void>;
}

export function getNextDelay(attempts: number): number {
  const index = Math.min(attempts, RETRY.DELAYS.length - 1);
  return RETRY.DELAYS[index];
}

// Exported for tests — not part of public API
export function isReadyToRetry(item: QueueItem): boolean {
  if (item.failedAt !== null) return false;
  if (item.lastAttemptAt === null) return true;
  return Date.now() - item.lastAttemptAt >= getNextDelay(item.attempts);
}

export async function processQueue(
  queue: QueueItem[],
  apiKey: string,
  backendUrl: string,
  processor: QueueProcessor = { send: sendOrders, saveQueue },
): Promise<void> {
  const pending = queue.filter(isReadyToRetry);
  if (pending.length === 0) return;

  const updatedQueue = [...queue];

  for (const item of pending) {
    const idx = updatedQueue.findIndex((q) => q.id === item.id);
    try {
      await processor.send([item.order], apiKey, backendUrl);
      updatedQueue.splice(idx, 1);
    } catch {
      const updated = { ...item, attempts: item.attempts + 1, lastAttemptAt: Date.now() };
      if (updated.attempts >= RETRY.MAX_ATTEMPTS) {
        updated.failedAt = Date.now();
      }
      updatedQueue[idx] = updated;
    }
  }

  await processor.saveQueue(updatedQueue);
  updateBadge(updatedQueue);
}

export async function enqueueOrder(order: ImportedOrder): Promise<void> {
  const queue = await getQueue();
  const item: QueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    order,
    attempts: 0,
    lastAttemptAt: null,
    failedAt: null,
  };
  await saveQueue([...queue, item]);
  updateBadge([...queue, item]);
}

function updateBadge(queue: QueueItem[]): void {
  const pending = queue.filter((q) => q.failedAt === null).length;
  chrome.action.setBadgeText({ text: pending > 0 ? String(pending) : '' });
  chrome.action.setBadgeBackgroundColor({ color: pending > 0 ? '#f59e0b' : '#22c55e' });
}

// ─── Service worker runtime ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: { type: string; payload?: unknown }) => {
  if (message.type !== 'INTERCEPTED_REQUEST') return;

  const { url, data } = message.payload as { url: string; data: unknown };
  const order = tryExtractOrder(url, data);

  if (order) {
    enqueueOrder(order).catch(console.error);
    triggerProcessQueue();
  }
});

async function triggerProcessQueue(): Promise<void> {
  const [queue, config] = await Promise.all([getQueue(), getConfig()]);
  if (!config.apiKey) return;
  await processQueue(queue, config.apiKey, config.backendUrl);
}

// Reintentos periódicos cada 60 segundos
const ALARM_NAME = 'orderhub-retry';
chrome.alarms?.create(ALARM_NAME, { periodInMinutes: 1 });
chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) triggerProcessQueue();
});
