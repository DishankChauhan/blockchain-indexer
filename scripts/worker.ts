import '../src/lib/queue/worker';
import WorkerLogger from '../src/lib/utils/workerLogger';

WorkerLogger.info('Worker process started', {
  component: 'WorkerScript',
  action: 'Initialize',
  pid: process.pid
}); 