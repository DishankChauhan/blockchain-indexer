import { NextApiRequest, NextApiResponse } from 'next';
import { logError, logWarn, logInfo, logDebug } from '@/lib/utils/serverLogger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { level, message, meta } = req.body;

    if (!level || !message) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    switch (level) {
      case 'error':
        logError(message, new Error(message), meta);
        break;
      case 'warn':
        logWarn(message, meta);
        break;
      case 'info':
        logInfo(message, meta);
        break;
      case 'debug':
        logDebug(message, meta);
        break;
      default:
        logInfo(message, meta);
    }

    return res.status(200).json({ message: 'Log recorded successfully' });
  } catch (error) {
    console.error('Error logging message:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 