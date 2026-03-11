export const EVENTS = {
  // Orders
  ORDER_IMPORTED: 'order.imported',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_CANCELLED: 'order.cancelled',

  // Daily Close
  DAILY_CLOSE_OPENED: 'daily_close.opened',
  DAILY_CLOSE_CLOSED: 'daily_close.closed',

  // Notifications
  NOTIFICATION_SEND_EMAIL: 'notification.send_email',

  // Connectors
  CONNECTOR_CONNECTED: 'connector.connected',
  CONNECTOR_DISCONNECTED: 'connector.disconnected',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
