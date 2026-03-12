export function formatMoney(amount: number | string, currency = 'ARS'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(num);
}

export function formatDate(date: string | Date, timezone = 'America/Buenos_Aires'): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatTime(date: string | Date, timezone = 'America/Buenos_Aires'): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}
