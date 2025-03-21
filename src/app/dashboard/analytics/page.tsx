'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Card } from '@/components/ui/card';
import { ApiClient } from '@/lib/api/apiClient';

interface JobMetric {
  jobId: string;
  jobName: string;
  progress: number;
  status: string;
  startTime: string;
  endTime?: string;
}

interface AnalyticsData {
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalTransactions: number;
  recentJobs: JobMetric[];
}

interface ApiResponse<T> {
  data: T;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const apiClient = ApiClient.getInstance();
        const response = await apiClient.get<ApiResponse<AnalyticsData>>('/api/analytics');
        setData(response.data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics data';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!data) {
    return <div>No data available</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <h2 className="text-lg font-semibold">Active Jobs</h2>
            <p className="text-3xl">{data.activeJobs}</p>
          </div>
        </Card>
        
        <Card>
          <div className="p-4">
            <h2 className="text-lg font-semibold">Completed Jobs</h2>
            <p className="text-3xl">{data.completedJobs}</p>
          </div>
        </Card>
        
        <Card>
          <div className="p-4">
            <h2 className="text-lg font-semibold">Failed Jobs</h2>
            <p className="text-3xl">{data.failedJobs}</p>
          </div>
        </Card>
        
        <Card>
          <div className="p-4">
            <h2 className="text-lg font-semibold">Total Transactions</h2>
            <p className="text-3xl">{data.totalTransactions}</p>
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Jobs</h2>
        <div className="space-y-4">
          {data.recentJobs.map((job) => (
            <Card key={job.jobId}>
              <div className="p-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">{job.jobName}</h3>
                  <span className={`px-2 py-1 rounded text-sm ${
                    job.status === 'completed' ? 'bg-green-100 text-green-800' :
                    job.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="h-2 bg-gray-200 rounded">
                    <div
                      className="h-2 bg-blue-500 rounded"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    Started: {new Date(job.startTime).toLocaleString()}
                    {job.endTime && ` • Ended: ${new Date(job.endTime).toLocaleString()}`}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
} 