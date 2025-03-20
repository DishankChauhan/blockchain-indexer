'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface Job {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  updatedAt: string;
  config: {
    startSlot: number;
    endSlot: number;
    categories: {
      transactions: boolean;
      nftEvents: boolean;
      tokenTransfers: boolean;
      programInteractions: boolean;
    };
  };
}

export default function JobsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchJobs();
    }
  }, [session?.user?.id]);

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/jobs');
      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }
      const data = await response.json();
      setJobs(data);
      setError(null);
    } catch (err) {
      setError('Failed to load jobs. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/stop`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to stop job');
      }
      await fetchJobs(); // Refresh jobs list
    } catch (err) {
      setError('Failed to stop job. Please try again later.');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete job');
      }
      await fetchJobs(); // Refresh jobs list
    } catch (err) {
      setError('Failed to delete job. Please try again later.');
    }
  };

  if (status === 'loading' || loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Indexing Jobs</h1>
        <Button onClick={() => router.push('/jobs/new')}>
          Create New Job
        </Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {jobs.map((job) => (
          <Card key={job.id} className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold mb-2">{job.name}</h2>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Status: <span className={`font-medium ${
                    job.status === 'running' ? 'text-green-600' :
                    job.status === 'failed' ? 'text-red-600' :
                    job.status === 'completed' ? 'text-blue-600' :
                    'text-gray-600'
                  }`}>{job.status}</span></p>
                  <p>Progress: {job.progress}%</p>
                  <p>Slot Range: {job.config.startSlot} - {job.config.endSlot}</p>
                  <p>Created: {new Date(job.createdAt).toLocaleString()}</p>
                  <p>Last Updated: {new Date(job.updatedAt).toLocaleString()}</p>
                </div>
                <div className="mt-2">
                  <h3 className="text-sm font-medium mb-1">Categories:</h3>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(job.config.categories).map(([category, enabled]) => (
                      enabled && (
                        <span
                          key={category}
                          className="px-2 py-1 bg-gray-100 rounded-full text-xs"
                        >
                          {category}
                        </span>
                      )
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {job.status === 'running' && (
                  <Button
                    variant="secondary"
                    onClick={() => handleStopJob(job.id)}
                  >
                    Stop
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteJob(job.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
            {job.status === 'running' && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              </div>
            )}
          </Card>
        ))}

        {jobs.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            No jobs found. Create a new job to start indexing blockchain data.
          </div>
        )}
      </div>
    </div>
  );
} 