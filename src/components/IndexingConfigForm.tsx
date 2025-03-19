import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';

// Validation schema
const configSchema = z.object({
  categories: z.object({
    transactions: z.boolean(),
    nftEvents: z.boolean(),
    tokenTransfers: z.boolean(),
    accountActivity: z.boolean(),
    programInteractions: z.boolean(),
    defiTransactions: z.boolean(),
    governance: z.boolean(),
  }),
  filters: z.object({
    programIds: z.string(),
    accounts: z.string(),
    startSlot: z.string().optional(),
    includeMints: z.boolean(),
    includeMetadata: z.boolean(),
  }),
  webhook: z.object({
    enabled: z.boolean(),
    url: z.string().url().optional(),
    secret: z.string().min(32).optional(),
  }),
});

type FormValues = z.infer<typeof configSchema>;

type IndexingConfig = {
  categories: FormValues['categories'];
  filters: {
    programIds: string[];
    accounts: string[];
    startSlot?: number;
    includeMints: boolean;
    includeMetadata: boolean;
  };
  webhook: FormValues['webhook'];
};

interface Props {
  onSubmit: (config: IndexingConfig) => Promise<void>;
  isLoading: boolean;
}

export default function IndexingConfigForm({ onSubmit, isLoading }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
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
        programIds: '',
        accounts: '',
        startSlot: '',
        includeMints: true,
        includeMetadata: true,
      },
      webhook: {
        enabled: false,
        url: '',
        secret: '',
      },
    },
  });

  const watchWebhookEnabled = watch('webhook.enabled');

  const handleFormSubmit = async (data: FormValues) => {
    try {
      const transformedData: IndexingConfig = {
        ...data,
        filters: {
          ...data.filters,
          programIds: data.filters.programIds.split(',').map(s => s.trim()).filter(Boolean),
          accounts: data.filters.accounts.split(',').map(s => s.trim()).filter(Boolean),
          startSlot: data.filters.startSlot ? parseInt(data.filters.startSlot, 10) : undefined,
        }
      };
      await onSubmit(transformedData);
      toast.success('Indexing configuration saved successfully');
      setSelectedCategory(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save configuration');
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Categories</h3>
        <div className="mt-4 space-y-4">
          {Object.keys(configSchema.shape.categories.shape).map((category) => (
            <div key={category} className="flex items-center">
              <input
                type="checkbox"
                {...register(`categories.${category as keyof IndexingConfig['categories']}`)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label className="ml-3 block text-sm font-medium text-gray-700 capitalize">
                {category.replace(/([A-Z])/g, ' $1').trim()}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Filters</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Program IDs</label>
            <input
              type="text"
              {...register('filters.programIds')}
              placeholder="Comma-separated program IDs"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Account Addresses</label>
            <input
              type="text"
              {...register('filters.accounts')}
              placeholder="Comma-separated account addresses"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Start Slot (Optional)</label>
            <input
              type="number"
              {...register('filters.startSlot')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('filters.includeMints')}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label className="ml-2 block text-sm text-gray-900">Include Mints</label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('filters.includeMetadata')}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label className="ml-2 block text-sm text-gray-900">Include Metadata</label>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Webhook Configuration</h3>
          <div className="flex items-center">
            <input
              type="checkbox"
              {...register('webhook.enabled')}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label className="ml-2 block text-sm text-gray-900">Enable Webhook</label>
          </div>
        </div>

        {watchWebhookEnabled && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Webhook URL</label>
              <input
                type="url"
                {...register('webhook.url')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="https://your-webhook-url.com"
              />
              {errors.webhook?.url && (
                <p className="mt-1 text-sm text-red-600">{errors.webhook.url.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Webhook Secret</label>
              <input
                type="password"
                {...register('webhook.secret')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Your webhook secret (min 32 characters)"
              />
              {errors.webhook?.secret && (
                <p className="mt-1 text-sm text-red-600">{errors.webhook.secret.message}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className={`inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </form>
  );
} 