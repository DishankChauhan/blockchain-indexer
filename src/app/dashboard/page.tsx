'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClient, apiRequest } from '@/lib/api/apiClient';
import { AppError } from '@/lib/utils/errorHandling';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import clientLogger from '@/lib/utils/clientLogger';
import { LoadingSpinner } from '@/components/LoadingSpinner';


// Types
interface DashboardData {
  user: any;
  connections: any[];
  jobs: any[];
  notifications: any[];
}

interface ApiResponse<T> {
  data: T;
  status: number;
}

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

const UserInfo = ({ user }: { user: any }) => (
  <div className="bg-white shadow rounded-lg p-6 mb-6">
    <h2 className="text-xl font-semibold text-gray-900 mb-4">User Information</h2>
    <p className="text-gray-700">Email: {user?.email}</p>
  </div>
);

const ConnectionsList = ({ connections = [] }: { connections?: any[] }) => (
  <div className="bg-white shadow rounded-lg p-6 mb-6">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-semibold text-gray-900">Database Connections</h2>
      <Link 
        href="/connections/new" 
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
      >
        Add Connection
      </Link>
    </div>
    {!connections?.length ? (
      <p className="text-gray-500">No database connections configured</p>
    ) : (
      <ul className="divide-y divide-gray-200">
        {connections.map((conn) => (
          <li key={conn.id} className="py-4 flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900">{conn.database}</p>
              <p className="text-sm">
                Status: <span className={`font-medium ${
                  conn.status === 'active' ? 'text-green-600' :
                  conn.status === 'error' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>{conn.status}</span>
              </p>
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

const JobsList = ({ jobs = [] }: { jobs?: any[] }) => (
  <div className="bg-white shadow rounded-lg p-6 mb-6">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-semibold text-gray-900">Indexing Jobs</h2>
      <Link 
        href="/jobs/new" 
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
      >
        Create New Job
      </Link>
    </div>
    {!jobs?.length ? (
      <p className="text-gray-500">No indexing jobs configured</p>
    ) : (
      <ul className="divide-y divide-gray-200">
        {jobs.map((job) => (
          <li key={job.id} className="py-4 flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900">Job {job.id}</p>
              <p className="text-sm text-gray-600">
                Type: {job.type} • Status: <span className={`font-medium ${
                  job.status === 'active' ? 'text-green-600' :
                  job.status === 'error' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>{job.status}</span>
              </p>
              <p className="text-xs text-gray-500">
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

const NotificationsList = ({ notifications = [] }: { notifications?: any[] }) => (
  <div className="bg-white shadow rounded-lg p-6">
    <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Notifications</h2>
    {!notifications?.length ? (
      <p className="text-gray-500">No recent notifications</p>
    ) : (
      <ul className="divide-y divide-gray-200">
        {notifications.map((notification) => (
          <li key={notification.id} className="py-4">
            <p className="font-medium text-gray-900">{notification.message}</p>
            <p className="text-sm text-gray-600">
              Type: {notification.type} • Status: <span className={`font-medium ${
                notification.status === 'success' ? 'text-green-600' :
                notification.status === 'error' ? 'text-red-600' :
                notification.status === 'warning' ? 'text-yellow-600' :
                'text-blue-600'
              }`}>{notification.status}</span>
            </p>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// Custom hook for dashboard data
const useDashboardData = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        const apiClient = ApiClient.getInstance();
        const response = await apiClient.get<ApiResponse<DashboardData>>('/api/dashboard');
        setData(response.data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard';
        clientLogger.error('Failed to load dashboard', err as Error, {
          component: 'DashboardPage',
          action: 'loadDashboard'
        });
        setError(errorMessage);
        toast.error('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  return { isLoading, error, data };
};

// Add these functions at the top level of the file
const testConnection = async (connectionId: string) => {
  try {
    const apiClient = ApiClient.getInstance();
    await apiClient.post(`/api/connections/${connectionId}/test`, {});
    toast.success('Connection test successful');
  } catch (error) {
    clientLogger.error('Failed to test connection', error as Error, {
      component: 'DashboardPage',
      action: 'testConnection',
      connectionId
    });
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
    clientLogger.error('Failed to remove connection', error as Error, {
      component: 'DashboardPage',
      action: 'removeConnection',
      connectionId
    });
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
  const { data: session } = useSession();
  const { isLoading, error, data: dashboardData } = useDashboardData();

  useEffect(() => {
    trackPageView();
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UserInfo user={session?.user} />
        <ConnectionsList connections={dashboardData?.connections} />
        <JobsList jobs={dashboardData?.jobs} />
        <NotificationsList notifications={dashboardData?.notifications} />
      </div>
    </div>
  );
} 