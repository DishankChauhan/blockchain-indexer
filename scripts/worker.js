require('tsconfig-paths').register({
  baseUrl: '.',
  paths: {
    '@/*': ['src/*']
  }
});

require('ts-node').register({
  project: 'tsconfig.worker.json',
  transpileOnly: true
});

require('../src/lib/queue/worker.ts'); 