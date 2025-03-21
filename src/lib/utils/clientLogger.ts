'use client';

const clientLogger = {
  info: (message: string, metadata?: any) => {
    console.info(message, metadata);
  },
  error: (message: string, error: Error | null, metadata?: any) => {
    console.error(message, error, metadata);
  },
  warn: (message: string, metadata?: any) => {
    console.warn(message, metadata);
  },
  debug: (message: string, metadata?: any) => {
    console.debug(message, metadata);
  }
};

export default clientLogger; 