'use client';

import React from 'react';
import IndexingConfigForm from '@/components/IndexingConfigForm';
import { IndexingConfig } from '@/types';

export default function ConfigureIndexing() {
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
              <IndexingConfigForm onSubmit={function (category: string, config: any): Promise<void> {
                throw new Error('Function not implemented.');
              } } isLoading={false} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 