'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ApiClient } from '@/lib/api/apiClient';
import { AppError } from '@/lib/utils/errorHandling';
import { captureException } from '@sentry/nextjs';

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

type DashboardData = {
  user: User;
  notifications: Notification[];
  connections: DatabaseConnection[];
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
    <h2 className="text-xl font-semibold mb-4">Database Connections</h2>
    {connections.length === 0 ? (
      <p className="text-gray-500">No database connections configured</p>
    ) : (
      <ul className="divide-y divide-gray-200">
        {connections.map((conn) => (
          <li key={conn.id} className="py-4">
            <p className="font-medium">{conn.database}</p>
            <p className="text-sm text-gray-500">Status: {conn.status}</p>
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

      const [userData, notifications, connections] = await Promise.all([
        apiClient.get<User>('/api/user'),
        apiClient.get<Notification[]>('/api/notifications'),
        apiClient.get<DatabaseConnection[]>('/api/connections')
      ]);

      setData({ user: userData, notifications, connections });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(message);
      
      if (err instanceof AppError && !err.isOperational) {
        captureException(err);
      }
    } finally {
      setLoading(false);
    }
  }, [apiClient, router]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, retry: fetchData };
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
      <NotificationsList notifications={data.notifications} />
    </div>
  );
} 