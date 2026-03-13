import { DEFAULTS, STORAGE_KEYS } from './constants';
import type { QueueItem, StoredConfig } from './extension.types';

export function getConfig(): Promise<StoredConfig> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(
      [STORAGE_KEYS.API_KEY, STORAGE_KEYS.BACKEND_URL],
      (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve({
          apiKey: (result[STORAGE_KEYS.API_KEY] as string) ?? '',
          backendUrl: (result[STORAGE_KEYS.BACKEND_URL] as string) ?? DEFAULTS.BACKEND_URL,
        });
      },
    );
  });
}

export function saveApiKey(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [STORAGE_KEYS.API_KEY]: apiKey }, () => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      resolve();
    });
  });
}

export function saveBackendUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [STORAGE_KEYS.BACKEND_URL]: url }, () => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      resolve();
    });
  });
}

export function getQueue(): Promise<QueueItem[]> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([STORAGE_KEYS.QUEUE], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve((result[STORAGE_KEYS.QUEUE] as QueueItem[]) ?? []);
    });
  });
}

export function saveQueue(queue: QueueItem[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.QUEUE]: queue }, () => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      resolve();
    });
  });
}
