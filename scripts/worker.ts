import '../src/lib/queue/worker';
import AppLogger from '../src/lib/utils/logger';

AppLogger.info('Worker process started', {
  component: 'WorkerScript',
  action: 'Initialize',
  pid: process.pid
}); 