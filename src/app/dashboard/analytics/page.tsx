'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { AnalyticsService } from '@/lib/services/analyticsService';
import type { TransactionMetrics, NFTMetrics, TokenMetrics } from '@/lib/services/analyticsService';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { LineChart, BarChart } from '@/components/Charts';

export default function AnalyticsDashboard() {
  const { data: session } = useSession();
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<{
    transactions?: TransactionMetrics;
    nft?: NFTMetrics;
    tokens?: TokenMetrics;
    trends?: any;
  }>({});

  useEffect(() => {
    if (session?.user?.id) {
      loadMetrics();
    }
  }, [session, timeRange]);

  const getTimeRange = () => {
    const end = new Date();
    const start = new Date();
    switch (timeRange) {
      case '24h':
        start.setHours(start.getHours() - 24);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      default:
        start.setHours(start.getHours() - 24);
    }
    return { startDate: start, endDate: end };
  };

  const loadMetrics = async () => {
    if (!session?.user?.id) return;

    setLoading(true);
    try {
      const analyticsService = AnalyticsService.getInstance();
      const range = getTimeRange();

      const [transactions, nft, tokens, trends] = await Promise.all([
        analyticsService.getTransactionMetrics(session.user.id, range),
        analyticsService.getNFTMetrics(session.user.id, range),
        analyticsService.getTokenMetrics(session.user.id, range),
        analyticsService.getHistoricalTrends(session.user.id, range, timeRange === '24h' ? 'hour' : 'day')
      ]);

      setMetrics({ transactions, nft, tokens, trends });
    } catch (error) {
      console.error('Failed to load metrics:', error);
      // TODO: Add proper error handling/notification
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Transaction Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>Total: {metrics.transactions?.totalTransactions}</p>
              <p>Success Rate: {(metrics.transactions?.successRate || 0) * 100}%</p>
              <p>Avg Fee: {metrics.transactions?.averageFee?.toFixed(4)} SOL</p>
            </div>
          </CardContent>
        </Card>

        {/* NFT Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>NFT Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>Sales: {metrics.nft?.totalSales}</p>
              <p>Volume: {metrics.nft?.totalVolume?.toFixed(2)} SOL</p>
              <p>Unique Buyers: {metrics.nft?.uniqueBuyers}</p>
            </div>
          </CardContent>
        </Card>

        {/* Token Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Token Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>Total: {metrics.tokens?.totalTransfers}</p>
              <p>Unique Tokens: {metrics.tokens?.uniqueTokens}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Transaction Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              data={metrics.trends?.map((t: any) => ({
                x: new Date(t.period).toLocaleString(),
                y: t.transactionCount
              })) || []}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Program Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={Object.entries(metrics.transactions?.programDistribution || {}).map(([key, value]) => ({
                x: key,
                y: value
              }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Top Addresses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Senders</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {metrics.tokens?.topSenders.map((sender, i) => (
                <li key={i} className="flex justify-between">
                  <span className="truncate">{sender.address}</span>
                  <span>{sender.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Receivers</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {metrics.tokens?.topReceivers.map((receiver, i) => (
                <li key={i} className="flex justify-between">
                  <span className="truncate">{receiver.address}</span>
                  <span>{receiver.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 