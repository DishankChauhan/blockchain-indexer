'use client'

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { DatabaseConnectionForm } from '@/components/DatabaseConnectionForm';
import IndexingConfigForm from '@/components/IndexingConfigForm';
import { DatabaseConnection, IndexingJob } from '@/types';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [dbConnections, setDbConnections] = useState<DatabaseConnection[]>([]);
  const [indexingJobs, setIndexingJobs] = useState<IndexingJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetchUserData();
    }
  }, [session]);

  const fetchUserData = async () => {
    try {
      const [connectionsRes, jobsRes] = await Promise.all([
        fetch('/api/database/connections'),
        fetch('/api/indexing/jobs'),
      ]);

      if (connectionsRes.ok && jobsRes.ok) {
        const [connections, jobs] = await Promise.all([
          connectionsRes.json(),
          jobsRes.json(),
        ]);

        setDbConnections(connections);
        setIndexingJobs(jobs);
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  };

  const handleDatabaseConnect = async (credentials: any) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/database/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (response.ok) {
        await fetchUserData();
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Failed to connect database:', error);
      // Handle error (show toast, etc.)
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigureIndexing = async (category: any, config: any) => {
    if (!dbConnections.length) {
      alert('Please connect a database first');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/indexing/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbConnectionId: dbConnections[0].id, // Using first connection for simplicity
          category,
          config,
        }),
      });

      if (response.ok) {
        await fetchUserData();
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Failed to configure indexing:', error);
      // Handle error (show toast, etc.)
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return <div>Please sign in to access the dashboard.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Blockchain Indexing Dashboard</h1>
      
      {!dbConnections.length ? (
        <DatabaseConnectionForm
          onSubmit={handleDatabaseConnect}
          isLoading={isLoading}
        />
      ) : (
        <IndexingConfigForm
          onSubmit={handleConfigureIndexing}
          isLoading={isLoading}
        />
      )}

      {/* Display active connections and jobs */}
      {dbConnections.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Active Connections</h2>
          <div className="space-y-4">
            {dbConnections.map((conn) => (
              <div
                key={conn.id}
                className="p-4 bg-white rounded-lg shadow"
              >
                <p>Database: {conn.database}</p>
                <p>Status: {conn.status}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {indexingJobs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Indexing Jobs</h2>
          <div className="space-y-4">
            {indexingJobs.map((job) => (
              <div
                key={job.id}
                className="p-4 bg-white rounded-lg shadow"
              >
                <p>Category: {job.category}</p>
                <p>Status: {job.status}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 