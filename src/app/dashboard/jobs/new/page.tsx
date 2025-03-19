'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClient } from '@/lib/api/apiClient';
import { toast } from 'react-hot-toast';
import IndexingConfigForm from '@/components/IndexingConfigForm';

export default function NewJobPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const apiClient = ApiClient.getInstance();

  const handleSubmit = async (config: any) => {
    try {
      setIsLoading(true);
      await apiClient.post('/api/jobs', {
        type: 'solana',
        config: config
      });
      toast.success('Indexing job created successfully');
      router.push('/dashboard');
    } catch (error) {
      console.error('Job creation error:', error);
      toast.error('Failed to create indexing job');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Indexing Job</h1>
          <p className="mt-2 text-sm text-gray-600">
            Configure your Solana blockchain indexing parameters
          </p>
        </div>
        <IndexingConfigForm onSubmit={handleSubmit} isLoading={isLoading} />
      </div>
    </div>
  );
} 