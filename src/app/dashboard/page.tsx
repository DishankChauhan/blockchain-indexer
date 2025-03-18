import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { DatabaseConnectionForm } from '@/components/DatabaseConnectionForm';
import IndexingConfigForm from '@/components/IndexingConfigForm';
import { DatabaseConnection, IndexingJob } from '@/types';
import { handleError } from '@/lib/utils/errorHandler';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [dbConnections, setDbConnections] = useState<DatabaseConnection[]>([]);
  const [indexingJobs, setIndexingJobs] = useState<IndexingJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) {
      fetchUserData();
    }
  }, [session]);

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [connectionsRes, jobsRes] = await Promise.all([
        fetch('/api/database/connections'),
        fetch('/api/indexing/jobs'),
      ]);

      if (!connectionsRes.ok || !jobsRes.ok) {
        throw new Error('Failed to fetch user data');
      }

      const [connections, jobs] = await Promise.all([
        connectionsRes.json(),
        jobsRes.json(),
      ]);

      setDbConnections(connections);
      setIndexingJobs(jobs);
    } catch (error) {
      const errorResponse = await handleError(error as Error, session?.user?.id, {
        component: 'dashboard',
        action: 'fetchUserData',
      });
      setError(errorResponse.error.message);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDatabaseConnect = async (credentials: any) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/database/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      await fetchUserData();
      toast.success('Database connected successfully');
    } catch (error) {
      const errorResponse = await handleError(error as Error, session?.user?.id, {
        component: 'dashboard',
        action: 'connectDatabase',
        credentials: { ...credentials, password: '[REDACTED]' },
      });
      setError(errorResponse.error.message);
      toast.error('Failed to connect database');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigureIndexing = async (category: string, config: any) => {
    if (!dbConnections.length) {
      toast.error('Please connect a database first');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/indexing/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbConnectionId: dbConnections[0].id,
          category,
          config,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      await fetchUserData();
      toast.success('Indexing configured successfully');
    } catch (error) {
      const errorResponse = await handleError(error as Error, session?.user?.id, {
        component: 'dashboard',
        action: 'configureIndexing',
        category,
        config,
      });
      setError(errorResponse.error.message);
      toast.error('Failed to configure indexing');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-gray-600">Please sign in to access the dashboard.</p>
          <button
            onClick={() => signIn()}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Blockchain Indexing Dashboard</h1>
      
      {error && (
        <div className="mb-8 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {!dbConnections.length ? (
        <DatabaseConnectionForm
          onSubmit={handleDatabaseConnect}
          isLoading={isLoading}
        />
      ) : (
        <IndexingConfigForm
          onSubmit={(config) => handleConfigureIndexing('defaultCategory', config)}
          isLoading={isLoading}
        />
      )}

      {dbConnections.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Active Connections</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dbConnections.map((conn) => (
              <div
                key={conn.id}
                className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{conn.database}</p>
                    <p className="text-sm text-gray-500">{conn.host}:{conn.port}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    conn.status === 'active' ? 'bg-green-100 text-green-800' :
                    conn.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {conn.status}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <p>Last connected: {conn.lastConnectedAt ? new Date(conn.lastConnectedAt).toLocaleString() : 'Never'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {indexingJobs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Indexing Jobs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {indexingJobs.map((job) => (
              <div
                key={job.id}
                className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{job.category}</p>
                    <p className="text-sm text-gray-500">ID: {job.id}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    job.status === 'active' ? 'bg-green-100 text-green-800' :
                    job.status === 'error' ? 'bg-red-100 text-red-800' :
                    job.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <p>Last indexed: {job.lastIndexedAt ? new Date(job.lastIndexedAt).toLocaleString() : 'Never'}</p>
                  <p className="mt-1">Configuration: {JSON.stringify(job.config, null, 2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 