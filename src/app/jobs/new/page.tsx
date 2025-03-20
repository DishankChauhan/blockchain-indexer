'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface DatabaseConnection {
  id: string;
  host: string;
  port: number;
  database: string;
  username: string;
  status: string;
}

interface JobConfig {
  name: string;
  startSlot: number;
  endSlot: number;
  dbConnectionId: string;
  categories: {
    transactions: boolean;
    nftEvents: boolean;
    tokenTransfers: boolean;
    programInteractions: boolean;
  };
}

export default function NewJobPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [config, setConfig] = useState<JobConfig>({
    name: '',
    startSlot: 0,
    endSlot: 0,
    dbConnectionId: '',
    categories: {
      transactions: true,
      nftEvents: false,
      tokenTransfers: false,
      programInteractions: false,
    },
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchConnections();
    }
  }, [session?.user?.id]);

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/connections');
      if (!response.ok) {
        throw new Error('Failed to fetch connections');
      }
      const { data } = await response.json();
      setConnections(data);
      if (data.length > 0) {
        setConfig(prev => ({ ...prev, dbConnectionId: data[0].id }));
      }
    } catch (err) {
      setError('Failed to load database connections. Please try again later.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create job');
      }

      router.push('/jobs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Create New Indexing Job</h1>

        <Card className="p-6">
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Name
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Database Connection
                </label>
                <select
                  value={config.dbConnectionId}
                  onChange={(e) => setConfig(prev => ({ ...prev, dbConnectionId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a connection</option>
                  {connections.map((conn) => (
                    <option key={conn.id} value={conn.id}>
                      {conn.database}@{conn.host}:{conn.port}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Slot
                  </label>
                  <input
                    type="number"
                    value={config.startSlot}
                    onChange={(e) => setConfig(prev => ({ ...prev, startSlot: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Slot
                  </label>
                  <input
                    type="number"
                    value={config.endSlot}
                    onChange={(e) => setConfig(prev => ({ ...prev, endSlot: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Categories
                </label>
                <div className="space-y-2">
                  {Object.entries(config.categories).map(([key, value]) => (
                    <label key={key} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          categories: {
                            ...prev.categories,
                            [key]: e.target.checked
                          }
                        }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push('/jobs')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Job'}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
} 