'use client';

import React, { useState } from 'react';

interface IndexingConfigFormProps {
  onSubmit: (category: string, config: IndexingConfig) => Promise<void>;
  isLoading: boolean;
}

interface IndexingConfig {
  categories: {
    transactions: boolean;
    nftEvents: boolean;
    tokenTransfers: boolean;
    accountActivity: boolean;
    programInteractions: boolean;
    defiTransactions: boolean;
    governance: boolean;
  };
  filters: {
    programIds: string[];
    accounts: string[];
    startSlot?: number;
    includeMints: boolean;
    includeMetadata: boolean;
  };
  webhook: {
    enabled: boolean;
    url?: string;
    secret?: string;
  };
}

export default function IndexingConfigForm({ onSubmit, isLoading }: IndexingConfigFormProps) {
  const [config, setConfig] = useState<IndexingConfig>({
    categories: {
      transactions: false,
      nftEvents: false,
      tokenTransfers: false,
      accountActivity: false,
      programInteractions: false,
      defiTransactions: false,
      governance: false,
    },
    filters: {
      programIds: [],
      accounts: [],
      includeMints: true,
      includeMetadata: true,
    },
    webhook: {
      enabled: false,
    },
  });

  const [newProgramId, setNewProgramId] = useState('');
  const [newAccount, setNewAccount] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit('custom', config);
  };


  const handleCategoryChange = (category: keyof IndexingConfig['categories']) => {
    setConfig({
      ...config,
      categories: {
        ...config.categories,
        [category]: !config.categories[category],
      },
    });
  };

  const handleAddProgramId = () => {
    if (newProgramId && !config.filters.programIds.includes(newProgramId)) {
      setConfig({
        ...config,
        filters: {
          ...config.filters,
          programIds: [...config.filters.programIds, newProgramId],
        },
      });
      setNewProgramId('');
    }
  };

  const handleAddAccount = () => {
    if (newAccount && !config.filters.accounts.includes(newAccount)) {
      setConfig({
        ...config,
        filters: {
          ...config.filters,
          accounts: [...config.filters.accounts, newAccount],
        },
      });
      setNewAccount('');
    }
  };

  const handleRemoveProgramId = (programId: string) => {
    setConfig({
      ...config,
      filters: {
        ...config.filters,
        programIds: config.filters.programIds.filter(id => id !== programId),
      },
    });
  };

  const handleRemoveAccount = (account: string) => {
    setConfig({
      ...config,
      filters: {
        ...config.filters,
        accounts: config.filters.accounts.filter(acc => acc !== account),
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Submit configuration to backend
    console.log('Submitting config:', config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 divide-y divide-gray-200">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">Indexing Categories</h3>
          <p className="mt-1 text-sm text-gray-500">Select the types of blockchain data you want to index.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries(config.categories).map(([category, enabled]) => (
            <div key={category} className="relative flex items-start">
              <div className="flex h-5 items-center">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => handleCategoryChange(category as keyof IndexingConfig['categories'])}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor={category} className="font-medium text-gray-700">
                  {category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </label>
                <p className="text-gray-500">{getCategoryDescription(category)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">Filters</h3>
            <p className="mt-1 text-sm text-gray-500">Configure specific filters for the data you want to index.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Program IDs</label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="text"
                  value={newProgramId}
                  onChange={(e) => setNewProgramId(e.target.value)}
                  placeholder="Enter program ID"
                  className="flex-1 rounded-none rounded-l-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddProgramId}
                  className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {config.filters.programIds.map((programId) => (
                  <span
                    key={programId}
                    className="inline-flex items-center rounded-full bg-indigo-100 py-1 pl-2.5 pr-1 text-sm font-medium text-indigo-700"
                  >
                    {programId}
                    <button
                      type="button"
                      onClick={() => handleRemoveProgramId(programId)}
                      className="ml-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-indigo-400 hover:bg-indigo-200 hover:text-indigo-500 focus:bg-indigo-500 focus:text-white focus:outline-none"
                    >
                      <span className="sr-only">Remove {programId}</span>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Account Addresses</label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="text"
                  value={newAccount}
                  onChange={(e) => setNewAccount(e.target.value)}
                  placeholder="Enter account address"
                  className="flex-1 rounded-none rounded-l-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddAccount}
                  className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {config.filters.accounts.map((account) => (
                  <span
                    key={account}
                    className="inline-flex items-center rounded-full bg-indigo-100 py-1 pl-2.5 pr-1 text-sm font-medium text-indigo-700"
                  >
                    {account}
                    <button
                      type="button"
                      onClick={() => handleRemoveAccount(account)}
                      className="ml-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-indigo-400 hover:bg-indigo-200 hover:text-indigo-500 focus:bg-indigo-500 focus:text-white focus:outline-none"
                    >
                      <span className="sr-only">Remove {account}</span>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  checked={config.filters.includeMints}
                  onChange={(e) => setConfig({
                    ...config,
                    filters: { ...config.filters, includeMints: e.target.checked }
                  })}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700">Include Mints</label>
                <p className="text-gray-500 text-sm">Track NFT and token mint events</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  checked={config.filters.includeMetadata}
                  onChange={(e) => setConfig({
                    ...config,
                    filters: { ...config.filters, includeMetadata: e.target.checked }
                  })}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700">Include Metadata</label>
                <p className="text-gray-500 text-sm">Include token and NFT metadata in indexed data</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">Webhook Configuration</h3>
            <p className="mt-1 text-sm text-gray-500">Configure webhook notifications for indexed data.</p>
          </div>

          <div className="flex items-start space-x-4">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                checked={config.webhook.enabled}
                onChange={(e) => setConfig({
                  ...config,
                  webhook: { ...config.webhook, enabled: e.target.checked }
                })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700">Enable Webhook Notifications</label>
              <p className="text-gray-500 text-sm">Receive real-time notifications for indexed data</p>
            </div>
          </div>

          {config.webhook.enabled && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Webhook URL</label>
                <input
                  type="url"
                  value={config.webhook.url || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    webhook: { ...config.webhook, url: e.target.value }
                  })}
                  placeholder="https://your-webhook-url.com"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Webhook Secret</label>
                <input
                  type="password"
                  value={config.webhook.secret || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    webhook: { ...config.webhook, secret: e.target.value }
                  })}
                  placeholder="Enter webhook secret"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-5">
        <div className="flex justify-end">
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </form>
  );
}

function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    transactions: 'Index all Solana transactions',
    nftEvents: 'Track NFT mints, transfers, and sales',
    tokenTransfers: 'Monitor SPL token transfers and swaps',
    accountActivity: 'Track changes in account data and balances',
    programInteractions: 'Index interactions with specific programs',
    defiTransactions: 'Monitor DeFi protocol transactions',
    governance: 'Track DAO and governance-related activities',
  };
  return descriptions[category] || '';
} 