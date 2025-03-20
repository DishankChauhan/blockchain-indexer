'use client';

import { useEffect, useState } from 'react';
import { ApiClient } from '@/lib/api/apiClient';
import { handleError } from '@/lib/utils/errorHandling';
import { toast } from 'react-hot-toast';

interface JobMetric {
  id: string;
  status: string;
  progress: number;
  processedCount: number;
  lastUpdated: string;
}

interface TimeSeriesData {
  timestamp: Date;
  data: any;
}

interface AnalyticsData {
  jobMetrics: JobMetric[];
  timeSeriesData: TimeSeriesData[];
}

interface ApiResponse<T> {
  data: T;
  status: number;
}

const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
  </div>
);

export default function AnalyticsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setIsLoading(true);
        const apiClient = ApiClient.getInstance();
        const response = await apiClient.get<ApiResponse<AnalyticsData>>('/api/analytics');
        setData(response.data);
      } catch (err) {
        const error = await handleError(err instanceof Error ? err : new Error('Failed to load analytics'), {
          component: 'AnalyticsPage',
          action: 'loadAnalytics'
        });
        setError(error.message);
        toast.error('Failed to load analytics data');
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Analytics Dashboard</h1>
      
      {/* Job Metrics */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Job Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.jobMetrics.map((metric) => (
            <div key={metric.id} className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-medium">Job {metric.id}</h3>
              <p className="text-sm text-gray-500">Status: {metric.status}</p>
              <p className="text-sm text-gray-500">Progress: {metric.progress}%</p>
              <p className="text-sm text-gray-500">Processed: {metric.processedCount} items</p>
              <p className="text-sm text-gray-500">
                Last Updated: {new Date(metric.lastUpdated).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Time Series Data */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.timeSeriesData.map((item, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(item.data, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 