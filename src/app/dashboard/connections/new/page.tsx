'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatabaseConnectionForm } from '@/components/DatabaseConnectionForm';
import { ApiClient } from '@/lib/api/apiClient';
import { toast } from 'react-hot-toast';
import { DatabaseCredentials } from '@/types';

export default function NewConnectionPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const apiClient = ApiClient.getInstance();

  const handleSubmit = async (credentials: DatabaseCredentials) => {
    try {
      setIsLoading(true);
      await apiClient.post('/api/connections', credentials);
      toast.success('Database connected successfully');
      router.push('/dashboard');
    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Failed to connect to database');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Connect New Database</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your PostgreSQL database credentials below
          </p>
        </div>
        <DatabaseConnectionForm onSubmit={handleSubmit} isLoading={isLoading} />
      </div>
    </div>
  );
} 