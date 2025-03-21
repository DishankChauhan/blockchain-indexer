'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import clientLogger from '@/lib/utils/clientLogger';
import { toast } from 'sonner';

interface DatabaseConnection {
  id: string;
  host: string;
  port: number;
  database: string;
  username: string;
  status: 'active' | 'inactive' | 'error';
  createdAt: string;
  updatedAt: string;
}

interface NewConnection {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export default function ConnectionsPage() {
  const { data: session } = useSession();
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newConnection, setNewConnection] = useState<NewConnection>({
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: ''
  });

  useEffect(() => {
    if (session?.user?.id) {
      loadConnections();
    }
  }, [session]);

  const loadConnections = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/connections');
      if (!response.ok) {
        throw new Error('Failed to fetch connections');
      }
      const { data } = await response.json();
      setConnections(data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load connections';
      clientLogger.error('Failed to load connections', error instanceof Error ? error : null, {
        component: 'ConnectionsPage',
        action: 'LoadConnections',
        userId: session?.user?.id
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConnection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setError(null);
      const response = await fetch('/api/connections/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConnection),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create connection');
      }

      clientLogger.info('Connection created successfully', {
        component: 'ConnectionsPage',
        action: 'CreateConnection',
        userId: session?.user?.id
      });

      await loadConnections();
      setNewConnection({
        host: '',
        port: 5432,
        database: '',
        username: '',
        password: ''
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create connection';
      clientLogger.error('Failed to create connection', error instanceof Error ? error : null, {
        component: 'ConnectionsPage',
        action: 'CreateConnection',
        userId: session?.user?.id
      });
      setError(errorMessage);
    }
  };

  const handleTestConnection = async (connectionId: string) => {
    try {
      setError(null);
      toast.loading('Testing connection...');
      const response = await fetch(`/api/connections/${connectionId}/test`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Connection test failed');
      }

      toast.success('Connection test successful!');
      clientLogger.info('Connection test successful', {
        component: 'ConnectionsPage',
        action: 'TestConnection',
        connectionId,
        userId: session?.user?.id
      });

      await loadConnections();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      clientLogger.error('Failed to test connection', error instanceof Error ? error : null, {
        component: 'ConnectionsPage',
        action: 'TestConnection',
        connectionId,
        userId: session?.user?.id
      });
      setError(errorMessage);
    }
  };

  const handleRemoveConnection = async (connectionId: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/connections/${connectionId}/remove`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove connection');
      }

      clientLogger.info('Connection removed successfully', {
        component: 'ConnectionsPage',
        action: 'RemoveConnection',
        connectionId,
        userId: session?.user?.id
      });

      await loadConnections();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove connection';
      clientLogger.error('Failed to remove connection', error instanceof Error ? error : null, {
        component: 'ConnectionsPage',
        action: 'RemoveConnection',
        connectionId,
        userId: session?.user?.id
      });
      setError(errorMessage);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setNewConnection(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) : value
    }));
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
      <div className="grid grid-cols-1 gap-6">
        {/* New Connection Form */}
        <Card>
          <CardHeader>
            <CardTitle>Add New Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateConnection} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  name="host"
                  placeholder="Host"
                  value={newConnection.host}
                  onChange={handleInputChange}
                  required
                />
                <Input
                  name="port"
                  type="number"
                  placeholder="Port"
                  value={newConnection.port}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <Input
                name="database"
                placeholder="Database"
                value={newConnection.database}
                onChange={handleInputChange}
                required
              />
              <Input
                name="username"
                placeholder="Username"
                value={newConnection.username}
                onChange={handleInputChange}
                required
              />
              <Input
                name="password"
                type="password"
                placeholder="Password"
                value={newConnection.password}
                onChange={handleInputChange}
                required
              />
              <Button type="submit" className="w-full">Add Connection</Button>
            </form>
          </CardContent>
        </Card>

        {/* Connections List */}
        <Card>
          <CardHeader>
            <CardTitle>Database Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="p-4 border rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{connection.database}@{connection.host}:{connection.port}</p>
                      <p className="text-sm text-gray-500">Username: {connection.username}</p>
                      <p className="text-sm text-gray-500">
                        Status: <span className={`font-semibold ${
                          connection.status === 'active' ? 'text-green-600' :
                          connection.status === 'error' ? 'text-red-600' :
                          'text-yellow-600'
                        }`}>{connection.status}</span>
                      </p>
                    </div>
                    <div className="space-x-2">
                      <Button
                        onClick={() => handleTestConnection(connection.id)}
                        variant="outline"
                      >
                        Test
                      </Button>
                      <Button
                        onClick={() => handleRemoveConnection(connection.id)}
                        variant="destructive"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {connections.length === 0 && (
                <p className="text-center text-gray-500">No connections found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 