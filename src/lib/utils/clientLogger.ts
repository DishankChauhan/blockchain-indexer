export interface LogContext {
  [key: string]: any;
}

export function logError(message: string, error?: Error, context?: LogContext) {
  if (typeof window !== 'undefined') {
    console.error(message, error || '', context || '');
  }
}

export function logWarn(message: string, context?: LogContext) {
  if (typeof window !== 'undefined') {
    console.warn(message, context || '');
  }
}

export function logInfo(message: string, context?: LogContext) {
  if (typeof window !== 'undefined') {
    console.info(message, context || '');
  }
}

export function logDebug(message: string, context?: LogContext) {
  if (typeof window !== 'undefined') {
    console.debug(message, context || '');
  }
}

const clientLogger = {
  error: logError,
  warn: logWarn,
  info: logInfo,
  debug: logDebug
};

export default clientLogger; 