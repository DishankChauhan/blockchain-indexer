'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface TableData {
  columns: string[];
  rows: any[];
  totalCount: number;
}

const AVAILABLE_TABLES = [
  { id: 'nft_bids', name: 'NFT Bids', description: 'Currently available bids on NFTs' },
  { id: 'nft_prices', name: 'NFT Prices', description: 'Current prices of NFTs' },
  { id: 'lending_rates', name: 'Borrowable Tokens', description: 'Currently available tokens to borrow' },
  { id: 'token_prices', name: 'Token Prices', description: 'Token prices across platforms' }
];

export default function DataBrowserPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TableData | null>(null);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (selectedTable && session?.user?.id) {
      fetchTableData();
    }
  }, [selectedTable, page, refreshKey, session?.user?.id]);

  const fetchTableData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/data-browser?table=${selectedTable}&page=${page}`);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (status === 'loading') {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Data Browser</h1>
          <div className="flex items-center space-x-4">
            <Select
              value={selectedTable}
              onValueChange={setSelectedTable}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue>
                  <span className="text-gray-500">Select a table to view</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_TABLES.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    <div>
                      <div className="font-medium">{table.name}</div>
                      <div className="text-sm text-gray-500">{table.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleRefresh}
              variant="outline"
              disabled={loading || !selectedTable}
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {selectedTable ? (
          <Card className="p-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : data ? (
              <div>
                <div className="mb-4 text-sm text-gray-600">
                  Showing {data.rows.length} of {data.totalCount} records
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {data.columns.map((column) => (
                          <th
                            key={column}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {data.columns.map((column) => (
                            <td
                              key={column}
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                            >
                              {typeof row[column] === 'object'
                                ? JSON.stringify(row[column])
                                : String(row[column])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <Button
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1 || loading}
                  >
                    Previous Page
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {page}
                  </span>
                  <Button
                    onClick={() => setPage(prev => prev + 1)}
                    disabled={data.rows.length < 10 || loading}
                  >
                    Next Page
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No data available in the selected table
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-6">
            <div className="text-center py-8 text-gray-500">
              Select a table to view its data
            </div>
          </Card>
        )}
      </div>
    </div>
  );
} 