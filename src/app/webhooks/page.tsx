'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { WebhookService } from '@/lib/services/webhookService';
import type { WebhookConfig } from '@/lib/services/webhookService';
import type { WebhookLog } from '@prisma/client';
import clientLogger from '@/lib/utils/clientLogger';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function WebhooksPage() {
  const { data: session } = useSession();
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [newWebhook, setNewWebhook] = useState<Partial<WebhookConfig>>({
    url: '',
    secret: '',
    retryCount: 3,
    retryDelay: 1000,
    filters: {
      programIds: [],
      accountIds: [],
      eventTypes: [],
    },
  });

  useEffect(() => {
    if (session?.user?.id) {
      loadWebhooks();
    }
  }, [session]);

  useEffect(() => {
    if (selectedWebhook) {
      loadWebhookLogs(selectedWebhook);
    }
  }, [selectedWebhook]);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/webhooks');
      if (!response.ok) {
        throw new Error('Failed to fetch webhooks');
      }
      const { data } = await response.json();
      setWebhooks(data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load webhooks';
      clientLogger.error('Failed to load webhooks', error as Error, {
        component: 'WebhooksPage',
        action: 'LoadWebhooks',
        userId: session?.user?.id
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadWebhookLogs = async (webhookId: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/webhooks/${webhookId}/logs`);
      if (!response.ok) {
        throw new Error('Failed to fetch webhook logs');
      }
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load webhook logs';
      clientLogger.error('Failed to load webhook logs', error as Error, {
        component: 'WebhooksPage',
        action: 'LoadWebhookLogs',
        webhookId,
        userId: session?.user?.id
      });
      setError(errorMessage);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newWebhook),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create webhook');
      }

      clientLogger.info('Webhook created successfully', {
        component: 'WebhooksPage',
        action: 'CreateWebhook',
        userId: session?.user?.id
      });

      await loadWebhooks();
      setNewWebhook({
        url: '',
        secret: '',
        retryCount: 3,
        retryDelay: 1000,
        filters: {
          programIds: [],
          accountIds: [],
          eventTypes: [],
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create webhook';
      clientLogger.error('Failed to create webhook', error as Error, {
        component: 'WebhooksPage',
        action: 'CreateWebhook',
        userId: session?.user?.id
      });
      setError(errorMessage);
    }
  };

  const handleUpdateWebhook = async (webhookId: string, updates: Partial<WebhookConfig>) => {
    try {
      setError(null);
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update webhook');
      }

      clientLogger.info('Webhook updated successfully', {
        component: 'WebhooksPage',
        action: 'UpdateWebhook',
        webhookId,
        userId: session?.user?.id
      });

      await loadWebhooks();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update webhook';
      clientLogger.error('Failed to update webhook', error as Error, {
        component: 'WebhooksPage',
        action: 'UpdateWebhook',
        webhookId,
        userId: session?.user?.id
      });
      setError(errorMessage);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete webhook');
      }

      clientLogger.info('Webhook deleted successfully', {
        component: 'WebhooksPage',
        action: 'DeleteWebhook',
        webhookId,
        userId: session?.user?.id
      });

      await loadWebhooks();
      if (selectedWebhook === webhookId) {
        setSelectedWebhook(null);
        setLogs([]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete webhook';
      clientLogger.error('Failed to delete webhook', error as Error, {
        component: 'WebhooksPage',
        action: 'DeleteWebhook',
        webhookId,
        userId: session?.user?.id
      });
      setError(errorMessage);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
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

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Webhooks List */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Webhooks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {webhooks.map((webhook) => (
                  <div
                    key={webhook.id}
                    className={`p-4 border rounded-lg cursor-pointer ${
                      selectedWebhook === webhook.id ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedWebhook(webhook.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{webhook.url}</p>
                        <p className="text-sm text-gray-500">
                          Retry: {webhook.retryCount} times, {webhook.retryDelay}ms delay
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWebhook(webhook.id);
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm">
                        Programs: {webhook.filters.programIds?.length || 0}
                      </p>
                      <p className="text-sm">
                        Accounts: {webhook.filters.accountIds?.length || 0}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Create New Webhook */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Create New Webhook</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateWebhook} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">URL</label>
                  <input
                    type="url"
                    value={newWebhook.url}
                    onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Secret</label>
                  <input
                    type="text"
                    value={newWebhook.secret}
                    onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Retry Count</label>
                  <input
                    type="number"
                    value={newWebhook.retryCount}
                    onChange={(e) => setNewWebhook({ ...newWebhook, retryCount: parseInt(e.target.value) })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    min="0"
                    max="10"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Retry Delay (ms)</label>
                  <input
                    type="number"
                    value={newWebhook.retryDelay}
                    onChange={(e) => setNewWebhook({ ...newWebhook, retryDelay: parseInt(e.target.value) })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    min="1000"
                    max="30000"
                    step="1000"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Create Webhook
                </button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Webhook Logs */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Webhook Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedWebhook ? (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-4 border rounded-lg ${
                        log.status === 'success'
                          ? 'border-green-200 bg-green-50'
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex justify-between">
                        <span
                          className={`text-sm font-semibold ${
                            log.status === 'success' ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {log.status.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-500">
                          Attempt {log.attempt}
                        </span>
                      </div>
                      <p className="text-sm mt-2">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                      {log.error && (
                        <p className="text-sm text-red-600 mt-2">{log.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500">
                  Select a webhook to view its logs
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 