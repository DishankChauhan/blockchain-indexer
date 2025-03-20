'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('24h');

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="bg-zinc-800 text-white border border-zinc-700 rounded-md px-4 py-2"
        >
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-zinc-800/50 border-zinc-700 p-6">
          <h3 className="text-lg font-medium text-white mb-2">Transactions Processed</h3>
          <p className="text-3xl font-bold text-white">0</p>
          <p className="text-sm text-zinc-400 mt-2">+0% from previous period</p>
        </Card>

        <Card className="bg-zinc-800/50 border-zinc-700 p-6">
          <h3 className="text-lg font-medium text-white mb-2">Active Jobs</h3>
          <p className="text-3xl font-bold text-white">0</p>
          <p className="text-sm text-zinc-400 mt-2">Across all connections</p>
        </Card>

        <Card className="bg-zinc-800/50 border-zinc-700 p-6">
          <h3 className="text-lg font-medium text-white mb-2">Webhook Deliveries</h3>
          <p className="text-3xl font-bold text-white">0</p>
          <p className="text-sm text-zinc-400 mt-2">100% success rate</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-800/50 border-zinc-700 p-6">
          <h3 className="text-lg font-medium text-white mb-4">Transaction Volume</h3>
          <div className="h-64 flex items-center justify-center text-zinc-500">
            No data available
          </div>
        </Card>

        <Card className="bg-zinc-800/50 border-zinc-700 p-6">
          <h3 className="text-lg font-medium text-white mb-4">Job Performance</h3>
          <div className="h-64 flex items-center justify-center text-zinc-500">
            No data available
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="bg-zinc-800/50 border-zinc-700 p-6">
          <h3 className="text-lg font-medium text-white mb-4">Recent Activity</h3>
          <div className="text-center py-8 text-zinc-500">
            No recent activity
          </div>
        </Card>
      </div>
    </div>
  );
} 