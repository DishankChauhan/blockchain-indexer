'use client';

import { useState } from 'react';
import { IndexingCategory, IndexingConfig } from '@/types';

export function IndexingConfigForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (category: IndexingCategory, config: IndexingConfig) => Promise<void>;
  isLoading: boolean;
}) {
  const [category, setCategory] = useState<IndexingCategory>(IndexingCategory.NFT_BIDS);
  const [config, setConfig] = useState<IndexingConfig>({
    nftBids: {
      marketplace: '',
      collection: '',
      updateFrequency: 60,
      minPrice: 0,
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(category, config);
  };

  const renderConfigFields = () => {
    switch (category) {
      case IndexingCategory.NFT_BIDS:
        return (
          <>
            <div>
              <label htmlFor="marketplace" className="block text-sm font-medium text-gray-700">Marketplace</label>
              <input
                type="text"
                id="marketplace"
                value={config.nftBids?.marketplace || ''}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  nftBids: { ...prev.nftBids!, marketplace: e.target.value }
                }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="collection" className="block text-sm font-medium text-gray-700">Collection</label>
              <input
                type="text"
                id="collection"
                value={config.nftBids?.collection || ''}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  nftBids: { ...prev.nftBids!, collection: e.target.value }
                }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="minPrice" className="block text-sm font-medium text-gray-700">Minimum Price (SOL)</label>
              <input
                type="number"
                id="minPrice"
                value={config.nftBids?.minPrice || 0}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  nftBids: { ...prev.nftBids!, minPrice: parseFloat(e.target.value) }
                }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                min="0"
                step="0.1"
              />
            </div>
          </>
        );
      // Add other cases for different categories
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Configure Indexing</h2>
      
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as IndexingCategory)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          {Object.values(IndexingCategory).map((cat) => (
            <option key={cat} value={cat}>
              {cat.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="updateFrequency" className="block text-sm font-medium text-gray-700">Update Frequency (seconds)</label>
        <input
          type="number"
          id="updateFrequency"
          value={config.nftBids?.updateFrequency || 60}
          onChange={(e) => setConfig(prev => ({
            ...prev,
            nftBids: { ...prev.nftBids!, updateFrequency: parseInt(e.target.value) }
          }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          min="10"
          required
        />
      </div>

      {renderConfigFields()}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {isLoading ? 'Configuring...' : 'Start Indexing'}
      </button>
    </form>
  );
} 