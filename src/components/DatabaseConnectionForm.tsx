'use client';

import { useState } from 'react';
import { DatabaseCredentials } from '@/types';

export function DatabaseConnectionForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (credentials: DatabaseCredentials) => Promise<void>;
  isLoading: boolean;
}) {
  const [credentials, setCredentials] = useState<DatabaseCredentials>({
    name: 'Local Database',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(credentials);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Connect Database</h2>
      
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Connection Name</label>
        <input
          type="text"
          id="name"
          value={credentials.name}
          onChange={(e) => setCredentials(prev => ({ ...prev, name: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          required
        />
      </div>

      <div>
        <label htmlFor="host" className="block text-sm font-medium text-gray-700">Host</label>
        <input
          type="text"
          id="host"
          value={credentials.host}
          onChange={(e) => setCredentials(prev => ({ ...prev, host: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          required
        />
      </div>

      <div>
        <label htmlFor="port" className="block text-sm font-medium text-gray-700">Port</label>
        <input
          type="number"
          id="port"
          value={credentials.port}
          onChange={(e) => setCredentials(prev => ({ ...prev, port: parseInt(e.target.value) }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          required
        />
      </div>

      <div>
        <label htmlFor="database" className="block text-sm font-medium text-gray-700">Database Name</label>
        <input
          type="text"
          id="database"
          value={credentials.database}
          onChange={(e) => setCredentials(prev => ({ ...prev, database: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          required
        />
      </div>

      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
        <input
          type="text"
          id="username"
          value={credentials.username}
          onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
        <input
          type="password"
          id="password"
          value={credentials.password}
          onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {isLoading ? 'Connecting...' : 'Connect Database'}
      </button>
    </form>
  );
} 