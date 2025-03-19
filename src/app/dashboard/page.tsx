'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ApiClient } from '@/lib/api/apiClient';
import { AppError, handleError } from '@/lib/utils/errorHandling';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// Types
type User = {
  id: string;
  email: string;
};

type Notification = {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  status: 'unread' | 'read';
};

type DatabaseConnection = {
  id: string;
  database: string;
  status: 'connected' | 'disconnected' | 'error';
};

type Job = {
  id: string;
  status: string;
  type: string;
  createdAt: string;
};

type DashboardData = {
  user: User;
  notifications: Notification[];
  connections: DatabaseConnection[];
  jobs: Job[];
};

// Analytics tracking (replace with your analytics service)
const trackPageView = () => {
  // Implementation depends on your analytics service
  // Example: mixpanel.track('Dashboard View')
};

const trackError = (error: Error) => {
  // Implementation depends on your analytics service
  // Example: mixpanel.track('Dashboard Error', { message: error.message })
};

// Components
const LoadingSpinner = () => (
  <div className="flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
  </div>
);

const ErrorDisplay = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div className="sm:mx-auto sm:w-full sm:max-w-md">
      <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Unable to load dashboard</h2>
          <p className="text-gray-600 mb-6">{message}</p>
          <button
            onClick={onRetry}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  </div>
);

const UserInfo = ({ user }: { user: User }) => (
  <div className="bg-white shadow rounded-lg p-6 mb-6">
    <h2 className="text-xl font-semibold mb-4">User Information</h2>
    <p>Email: {user.email}</p>
  </div>
);

const ConnectionsList = ({ connections }: { connections: DatabaseConnection[] }) => (
  <div className="bg-white shadow rounded-lg p-6 mb-6">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-semibold">Database Connections</h2>
      <Link 
        href="/dashboard/connections/new" 
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
      >
        Add Connection
      </Link>
    </div>
    {connections.length === 0 ? (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">No database connections configured</p>
        <Link 
          href="/dashboard/connections/new"
          className="text-indigo-600 hover:text-indigo-500"
        >
          Click here to add your first database connection
        </Link>
      </div>
    ) : (
      <ul className="divide-y divide-gray-200">
        {connections.map((conn) => (
          <li key={conn.id} className="py-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{conn.database}</p>
              <p className="text-sm text-gray-500">Status: {conn.status}</p>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => testConnection(conn.id)}
                className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-500"
              >
                Test Connection
              </button>
              <button 
                onClick={() => removeConnection(conn.id)}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-500"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const JobsList = ({ jobs }: { jobs: Job[] }) => (
  <div className="bg-white shadow rounded-lg p-6 mb-6">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-semibold">Indexing Jobs</h2>
      <Link 
        href="/dashboard/jobs/new" 
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
      >
        Create New Job
      </Link>
    </div>
    {jobs.length === 0 ? (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">No indexing jobs configured</p>
        <Link 
          href="/dashboard/jobs/new"
          className="text-indigo-600 hover:text-indigo-500"
        >
          Click here to create your first indexing job
        </Link>
      </div>
    ) : (
      <ul className="divide-y divide-gray-200">
        {jobs.map((job) => (
          <li key={job.id} className="py-4 flex justify-between items-center">
            <div>
              <p className="font-medium">Job {job.id}</p>
              <p className="text-sm text-gray-500">
                Type: {job.type} • Status: {job.status}
              </p>
              <p className="text-xs text-gray-400">
                Created: {new Date(job.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex space-x-2">
              {job.status !== 'active' && (
                <button 
                  onClick={() => startJob(job.id)}
                  className="px-3 py-1 text-sm text-green-600 hover:text-green-500"
                >
                  Start
                </button>
              )}
              {job.status === 'active' && (
                <button 
                  onClick={() => pauseJob(job.id)}
                  className="px-3 py-1 text-sm text-yellow-600 hover:text-yellow-500"
                >
                  Pause
                </button>
              )}
              <button 
                onClick={() => stopJob(job.id)}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-500"
              >
                Stop
              </button>
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const NotificationsList = ({ notifications }: { notifications: Notification[] }) => (
  <div className="bg-white shadow rounded-lg p-6">
    <h2 className="text-xl font-semibold mb-4">Recent Notifications</h2>
    {notifications.length === 0 ? (
      <p className="text-gray-500">No recent notifications</p>
    ) : (
      <ul className="divide-y divide-gray-200">
        {notifications.map((notification) => (
          <li key={notification.id} className="py-4">
            <p className="font-medium">{notification.message}</p>
            <p className="text-sm text-gray-500">
              Type: {notification.type} • Status: {notification.status}
            </p>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// Custom hook for dashboard data
const useDashboardData = () => {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();
  const apiClient = ApiClient.getInstance();

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const session = await apiClient.get<{ user?: User }>('/api/auth/session');
      if (!session?.user) {
        router.push('/auth/signin');
        return;
      }

      const [userData, notifications, connections, jobs] = await Promise.all([
        apiClient.get<User>('/api/user'),
        apiClient.get<Notification[]>('/api/notifications'),
        apiClient.get<DatabaseConnection[]>('/api/connections'),
        apiClient.get<Job[]>('/api/jobs')
      ]);

      setData({ user: userData, notifications, connections, jobs });
    } catch (error: unknown) {
      const errorMessage = handleError(
        {
          component: 'Dashboard',
          action: 'fetchData'
        },
        error
      );
      setError(errorMessage);
      
      if (error instanceof Error) {
        trackError(error);
      }
    } finally {
      setLoading(false);
    }
  }, [apiClient, router]);

  React.useEffect(() => {
    trackPageView();
    fetchData();
  }, [fetchData]);

  return { data, loading, error, retry: fetchData };
};

// Add these functions at the top level of the file
const testConnection = async (connectionId: string) => {
  try {
    const apiClient = ApiClient.getInstance();
    await apiClient.post(`/api/connections/${connectionId}/test`, {});
    toast.success('Connection test successful');
  } catch (error) {
    toast.error('Failed to test connection');
  }
};

const removeConnection = async (connectionId: string) => {
  try {
    const apiClient = ApiClient.getInstance();
    await apiClient.post(`/api/connections/${connectionId}/remove`, {});
    toast.success('Connection removed successfully');
    window.location.reload();
  } catch (error) {
    toast.error('Failed to remove connection');
  }
};

const startJob = async (jobId: string) => {
  try {
    const apiClient = ApiClient.getInstance();
    await apiClient.post(`/api/jobs/${jobId}/start`, {});
    toast.success('Job started successfully');
    window.location.reload();
  } catch (error) {
    toast.error('Failed to start job');
  }
};

const pauseJob = async (jobId: string) => {
  try {
    const apiClient = ApiClient.getInstance();
    await apiClient.post(`/api/jobs/${jobId}/pause`, {});
    toast.success('Job paused successfully');
    window.location.reload();
  } catch (error) {
    toast.error('Failed to pause job');
  }
};

const stopJob = async (jobId: string) => {
  try {
    const apiClient = ApiClient.getInstance();
    await apiClient.post(`/api/jobs/${jobId}/stop`, {});
    toast.success('Job stopped successfully');
    window.location.reload();
  } catch (error) {
    toast.error('Failed to stop job');
  }
};

// Main component
export default function DashboardPage() {
  const { data, loading, error, retry } = useDashboardData();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={retry} />;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <UserInfo user={data.user} />
      <ConnectionsList connections={data.connections} />
      <JobsList jobs={data.jobs || []} />
      <NotificationsList notifications={data.notifications} />
    </div>
  );
} 