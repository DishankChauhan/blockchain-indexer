'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import clientLogger from '@/lib/utils/clientLogger';

interface DashboardData {
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  connections: Array<{
    id: string;
    database: string;
    host: string;
    status: string;
  }>;
  jobs: Array<{
    id: string;
    type: string;
    status: string;
    progress: number;
    config: any;
  }>;
  notifications: Array<{
    id: string;
    message: string;
    type: string;
  }>;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard', {
        credentials: 'include'
      });
      
      if (response.status === 401) {
        router.push('/auth/signin');
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const result = await response.json();
      if (!result.data) {
        throw new Error('Invalid response format');
      }
      
      setDashboardData(result.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load dashboard';
      clientLogger.error('Failed to load dashboard', error as Error, {
        component: 'DashboardPage',
        action: 'FetchData'
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      fetchDashboardData();
    }
  }, [status, router]);

  const handleStartJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/start`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to start job');
      }

      // Refresh dashboard data
      fetchDashboardData();
    } catch (error) {
      clientLogger.error('Failed to start job', error as Error, {
        component: 'DashboardPage',
        action: 'StartJob',
        jobId
      });
      setError('Failed to start job');
    }
  };

  const handleStopJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/stop`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to stop job');
      }

      // Refresh dashboard data
      fetchDashboardData();
    } catch (error) {
      clientLogger.error('Failed to stop job', error as Error, {
        component: 'DashboardPage',
        action: 'StopJob',
        jobId
      });
      setError('Failed to stop job');
    }
  };

  if (status === 'loading' || loading) {
    return <LoadingSpinner />;
  }

  if (status === 'unauthenticated') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Please Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <p>You need to be signed in to view the dashboard.</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!dashboardData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p>No dashboard data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Email: {dashboardData.user?.email}</p>
          <p>Name: {dashboardData.user?.name || 'Not set'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Database Connections</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboardData.connections.length > 0 ? (
            <div className="space-y-4">
              {dashboardData.connections.map(conn => (
                <div key={conn.id} className="p-4 border rounded-lg">
                  <p className="font-medium">{conn.database} @ {conn.host}</p>
                  <p className={`text-sm ${conn.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                    Status: {conn.status}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p>No database connections found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Indexing Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboardData.jobs.length > 0 ? (
            <div className="space-y-4">
              {dashboardData.jobs.map(job => (
                <div key={job.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{job.type}</p>
                      <p className={`text-sm ${
                        job.status === 'active' ? 'text-green-600' : 
                        job.status === 'failed' ? 'text-red-600' : 
                        'text-yellow-600'
                      }`}>
                        Status: {job.status} ({job.progress}%)
                      </p>
                    </div>
                    <div className="space-x-2">
                      {job.status !== 'active' && (
                        <Button 
                          onClick={() => handleStartJob(job.id)}
                          variant="default"
                          size="sm"
                        >
                          Start
                        </Button>
                      )}
                      {job.status === 'active' && (
                        <Button 
                          onClick={() => handleStopJob(job.id)}
                          variant="destructive"
                          size="sm"
                        >
                          Stop
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        job.status === 'active' ? 'bg-green-600' :
                        job.status === 'failed' ? 'bg-red-600' :
                        'bg-yellow-600'
                      }`}
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No indexing jobs found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboardData.notifications.length > 0 ? (
            <div className="space-y-4">
              {dashboardData.notifications.map(notification => (
                <div 
                  key={notification.id} 
                  className={`p-4 border rounded-lg ${
                    notification.type === 'error' ? 'bg-red-50 border-red-200' :
                    notification.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-green-50 border-green-200'
                  }`}
                >
                  <p>{notification.message}</p>
                  <p className="text-sm text-gray-600 mt-1">Type: {notification.type}</p>
                </div>
              ))}
            </div>
          ) : (
            <p>No notifications found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 