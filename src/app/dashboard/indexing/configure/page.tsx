'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import IndexingConfigForm from '@/components/IndexingConfigForm';
import { IndexingConfig } from '@/types';
import { handleError } from '@/lib/utils/errorHandler';

export default function ConfigureIndexing() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (config: IndexingConfig) => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/indexing/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      toast.success('Indexing configuration saved successfully');
      router.push('/dashboard');
    } catch (error) {
      const errorResponse = await handleError(error as Error, undefined, {
        component: 'configureIndexing',
        config,
      });
      toast.error(errorResponse.error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-10">
      <header>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
            Configure Indexing
          </h1>
        </div>
      </header>
      <main>
        <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="px-4 py-8 sm:px-0">
            <div className="bg-white px-6 py-8 shadow-sm ring-1 ring-gray-900/5 sm:rounded-lg">
              <IndexingConfigForm
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 