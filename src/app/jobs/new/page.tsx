'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

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
      // Validate slot range
      if (config.endSlot !== 0 && config.endSlot <= config.startSlot) {
        throw new Error('End slot must be greater than start slot');
      }

      // Validate connection
      if (!config.dbConnectionId) {
        throw new Error('Please select a database connection');
      }

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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-lg font-semibold mb-2">Job Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter job name"
                    value={config.name}
                    onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="connection" className="text-lg font-semibold mb-2">Database Connection</Label>
                  <Select
                    value={config.dbConnectionId}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, dbConnectionId: value }))}
                    className="w-full"
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((conn) => (
                        <SelectItem
                          key={conn.id}
                          value={conn.id}
                        >
                          <span className={`${
                            conn.status === 'active' ? 'text-green-600' :
                            conn.status === 'error' ? 'text-red-600' :
                            'text-yellow-600'
                          } font-medium`}>
                            {`${conn.database}@${conn.host}:${conn.port}`}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startSlot" className="text-lg font-semibold mb-2">Start Slot</Label>
                  <Input
                    id="startSlot"
                    type="number"
                    placeholder="Enter start slot (0 for genesis)"
                    value={config.startSlot}
                    onChange={(e) => setConfig(prev => ({ ...prev, startSlot: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="endSlot" className="text-lg font-semibold mb-2">End Slot</Label>
                  <Input
                    id="endSlot"
                    type="number"
                    placeholder="Enter end slot (0 for continuous)"
                    value={config.endSlot}
                    onChange={(e) => setConfig(prev => ({ ...prev, endSlot: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Data Categories</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(config.categories).map(([category, enabled]) => (
                    <div
                      key={category}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        enabled ? 'border-green-500 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <Checkbox
                          checked={enabled}
                          onCheckedChange={(checked: boolean) => setConfig(prev => ({
                            ...prev,
                            categories: {
                              ...prev.categories,
                              [category as keyof typeof config.categories]: checked
                            }
                          }))}
                        />
                        <span className="font-medium">
                          {category.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </label>
                    </div>
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