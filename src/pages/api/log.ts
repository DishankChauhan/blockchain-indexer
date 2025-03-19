import { NextApiRequest, NextApiResponse } from 'next';
import { ServerLogger } from '@/lib/utils/serverLogger';

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
        ServerLogger.error(message, new Error(message), meta);
        break;
      case 'warn':
        ServerLogger.warn(message, meta);
        break;
      case 'info':
        ServerLogger.info(message, meta);
        break;
      case 'debug':
        ServerLogger.debug(message, meta);
        break;
      default:
        ServerLogger.info(message, meta);
    }

    return res.status(200).json({ message: 'Log recorded successfully' });
  } catch (error) {
    console.error('Error logging message:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 