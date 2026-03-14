import { getConfig, saveApiKey, getQueue } from '../storage';
import { RETRY } from '../constants';

async function init(): Promise<void> {
  const [config, queue] = await Promise.all([getConfig(), getQueue()]);

  const dot = document.getElementById('dot')!;
  const statusText = document.getElementById('status-text')!;
  const pendingRow = document.getElementById('pending-row') as HTMLElement;
  const pendingCount = document.getElementById('pending-count')!;
  const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
  const saveBtn = document.getElementById('save-btn')!;
  const savedMsg = document.getElementById('saved-msg') as HTMLElement;
  const failedList = document.getElementById('failed-list')!;

  if (!config.apiKey) {
    dot.className = 'dot error';
    statusText.textContent = 'Sin API Key — configurar abajo';
  } else {
    dot.className = 'dot connected';
    statusText.textContent = 'Conectado';
  }

  if (config.apiKey) {
    apiKeyInput.placeholder = config.apiKey.slice(0, 8) + '••••••••';
  }

  const pending = queue.filter((q) => q.failedAt === null);
  const failed = queue.filter((q) => q.failedAt !== null);

  if (pending.length > 0) {
    pendingRow.style.display = 'flex';
    pendingCount.textContent = String(pending.length);
  }

  if (failed.length > 0) {
    failedList.textContent = `${failed.length} pedido(s) fallaron después de ${RETRY.MAX_ATTEMPTS} intentos`;
  }

  saveBtn.addEventListener('click', async () => {
    const newKey = apiKeyInput.value.trim();
    if (!newKey) return;
    await saveApiKey(newKey);
    apiKeyInput.value = '';
    apiKeyInput.placeholder = newKey.slice(0, 8) + '••••••••';
    savedMsg.style.display = 'block';
    dot.className = 'dot connected';
    statusText.textContent = 'Conectado';
    setTimeout(() => (savedMsg.style.display = 'none'), 2000);
  });
}

init().catch(console.error);
