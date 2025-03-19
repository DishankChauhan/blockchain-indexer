interface ClientLogger {
  info: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  [key: string]: any;
}

const logToServer = async (level: string, message: string, meta?: any) => {
  try {
    const response = await fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ level, message, meta }),
    });

    if (!response.ok) {
      console.error('Failed to send log to server:', await response.text());
    }
  } catch (error) {
    console.error('Error sending log to server:', error);
  }
};

// Browser-safe logger that sends logs to server
const clientLogger: ClientLogger = {
  info: async (message: string, context?: LogContext) => {
    console.info(message);
    await fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 'info', message, meta: context }) });
  },
  error: async (message: string, error: Error | unknown, context?: LogContext) => {
    console.error(message, error);
    const errorObj = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 'error', message, meta: { ...context, error: errorObj } }),
    });
  },
  warn: async (message: string, context?: LogContext) => {
    console.warn(message);
    await fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 'warn', message, meta: context }) });
  },
  debug: async (message: string, context?: LogContext) => {
    console.debug(message);
    await fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 'debug', message, meta: context }) });
  },
};

export default clientLogger; 