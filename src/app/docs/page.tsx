"use client";

import React from 'react';
import { motion } from "framer-motion";
import { Card } from '@/components/ui/card';

const DATA_TYPES = [
  {
    name: 'NFT Bids',
    description: 'Track currently available bids on NFTs across various marketplaces.',
    schema: `
CREATE TABLE nft_bids (
    id SERIAL PRIMARY KEY,
    nft_address TEXT NOT NULL,
    bid_amount NUMERIC NOT NULL,
    bidder_address TEXT NOT NULL,
    marketplace TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    status TEXT NOT NULL
);`,
    example: {
      nft_address: 'DYtKK1G9pV5JhwWkyP6HSHwqH8VTkxDPKcUYQoRqtc5Y',
      bid_amount: '50.5',
      bidder_address: '8ZJ3eSQUVy4px2zcotm4ZgXm5yQMxKwNJKwF4BQZGH3t',
      marketplace: 'magic_eden',
      timestamp: '2024-03-21T19:33:53Z',
      expires_at: '2024-03-22T19:33:53Z',
      status: 'active'
    }
  },
  {
    name: 'NFT Prices',
    description: 'Monitor current prices of NFTs across different marketplaces.',
    schema: `
CREATE TABLE nft_prices (
    id SERIAL PRIMARY KEY,
    nft_address TEXT NOT NULL,
    collection_address TEXT NOT NULL,
    price NUMERIC NOT NULL,
    marketplace TEXT NOT NULL,
    seller_address TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    status TEXT NOT NULL
);`,
    example: {
      nft_address: 'DYtKK1G9pV5JhwWkyP6HSHwqH8VTkxDPKcUYQoRqtc5Y',
      collection_address: '4mKSoDDqApmF1DqXvVTSL6tu2zixrSSNjqMxUnwvVzy2',
      price: '100.75',
      marketplace: 'tensor',
      seller_address: '8ZJ3eSQUVy4px2zcotm4ZgXm5yQMxKwNJKwF4BQZGH3t',
      timestamp: '2024-03-21T19:33:53Z',
      status: 'listed'
    }
  },
  {
    name: 'Borrowable Tokens',
    description: 'Track currently available tokens to borrow from lending protocols.',
    schema: `
CREATE TABLE lending_rates (
    id SERIAL PRIMARY KEY,
    token_mint TEXT NOT NULL,
    amount_available NUMERIC NOT NULL,
    interest_rate NUMERIC NOT NULL,
    platform TEXT NOT NULL,
    ltv_ratio NUMERIC,
    timestamp TIMESTAMP NOT NULL,
    status TEXT NOT NULL
);`,
    example: {
      token_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount_available: '1000000.0',
      interest_rate: '0.05',
      platform: 'solend',
      ltv_ratio: '0.8',
      timestamp: '2024-03-21T19:33:53Z',
      status: 'active'
    }
  },
  {
    name: 'Token Prices',
    description: 'Monitor token prices across various platforms and DEXs.',
    schema: `
CREATE TABLE token_prices (
    id SERIAL PRIMARY KEY,
    token_mint TEXT NOT NULL,
    price_usd NUMERIC NOT NULL,
    platform TEXT NOT NULL,
    volume_24h NUMERIC,
    liquidity NUMERIC,
    timestamp TIMESTAMP NOT NULL
);`,
    example: {
      token_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      price_usd: '1.00',
      platform: 'jupiter',
      volume_24h: '5000000.0',
      liquidity: '10000000.0',
      timestamp: '2024-03-21T19:33:53Z'
    }
  }
];

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-black text-white py-24">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-400 to-white mb-8">
            Documentation
          </h1>
          
          {/* Quick Start Guide */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-6">Quick Start Guide</h2>
            <div className="prose prose-invert max-w-none">
              <div className="bg-black/50 border border-purple-500/20 rounded-xl p-8 mb-8">
                <h3 className="text-xl font-semibold mb-4">Installation</h3>
                <pre className="bg-black/80 p-4 rounded-lg overflow-x-auto">
                  <code className="text-white">npm install @blockchain-indexer/core</code>
                </pre>
              </div>

              <div className="bg-black/50 border border-purple-500/20 rounded-xl p-8 mb-8">
                <h3 className="text-xl font-semibold mb-4">Basic Usage</h3>
                <pre className="bg-black/80 p-4 rounded-lg overflow-x-auto">
                  <code className="text-white">{`import { BlockchainIndexer } from '@blockchain-indexer/core';

const indexer = new BlockchainIndexer({
  network: 'ethereum',
  startBlock: 'latest'
});

indexer.start();

indexer.on('block', (block) => {
  console.log('New block indexed:', block.number);
});`}</code>
                </pre>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-6">Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                {
                  title: "Real-time Indexing",
                  description: "Index blockchain data with minimal latency and high throughput"
                },
                {
                  title: "Custom Queries",
                  description: "Build and execute custom queries to extract specific blockchain data"
                },
                {
                  title: "Webhook Integration",
                  description: "Set up webhooks for real-time notifications on blockchain events"
                },
                {
                  title: "Data Export",
                  description: "Export indexed data in various formats for further analysis"
                }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-6 bg-black/50 backdrop-blur-sm border border-purple-500/20 rounded-xl"
                >
                  <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-white/60">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* API Reference */}
          <section>
            <h2 className="text-3xl font-bold text-white mb-6">API Reference</h2>
            <div className="bg-black/50 border border-purple-500/20 rounded-xl p-8">
              <h3 className="text-xl font-semibold mb-4">Core Methods</h3>
              <div className="space-y-6">
                {[
                  {
                    name: "start()",
                    description: "Starts the indexing process"
                  },
                  {
                    name: "stop()",
                    description: "Stops the indexing process"
                  },
                  {
                    name: "query(options)",
                    description: "Executes a custom query on indexed data"
                  }
                ].map((method, index) => (
                  <div key={index} className="border-b border-purple-500/10 last:border-0 pb-4 last:pb-0">
                    <h4 className="text-lg font-semibold text-purple-400 mb-2">{method.name}</h4>
                    <p className="text-white/60">{method.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-3xl font-bold text-white mb-6">Data Types Documentation</h2>
            <div className="prose prose-lg max-w-none mb-8">
              <p>
                Our blockchain indexer supports various types of data that can be indexed from the Solana blockchain.
                Each data type is stored in its own table in your PostgreSQL database and is updated in real-time
                through Helius webhooks.
              </p>
            </div>

            <div className="space-y-8">
              {DATA_TYPES.map((type) => (
                <Card key={type.name} className="p-6">
                  <h3 className="text-2xl font-bold mb-4">{type.name}</h3>
                  <p className="text-gray-600 mb-6">{type.description}</p>

                  <div className="mb-6">
                    <h4 className="text-lg font-semibold mb-2">Schema</h4>
                    <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
                      <code>{type.schema}</code>
                    </pre>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold mb-2">Example Data</h4>
                    <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
                      <code>{JSON.stringify(type.example, null, 2)}</code>
                    </pre>
                  </div>
                </Card>
              ))}
            </div>

            <div className="mt-12 prose prose-lg max-w-none">
              <h3>Usage Instructions</h3>
              <ol>
                <li>
                  <strong>Set Up Database Connection</strong>
                  <p>
                    First, add your PostgreSQL database credentials in the Connections page.
                    Make sure your database is accessible and has the necessary permissions.
                  </p>
                </li>
                <li>
                  <strong>Create an Indexing Job</strong>
                  <p>
                    Go to the Jobs page and create a new indexing job. Select which data types
                    you want to index and specify the slot range (use 0 for continuous indexing).
                  </p>
                </li>
                <li>
                  <strong>Monitor Progress</strong>
                  <p>
                    Use the Data Browser to verify that data is being written to your database.
                    You can view recent records and monitor the indexing progress.
                  </p>
                </li>
                <li>
                  <strong>Access Your Data</strong>
                  <p>
                    Connect to your PostgreSQL database directly to query the indexed data
                    using standard SQL queries. All tables follow the schemas shown above.
                  </p>
                </li>
              </ol>

              <h3>Best Practices</h3>
              <ul>
                <li>Start with a small slot range to test the indexing process</li>
                <li>Monitor your database size and implement appropriate retention policies</li>
                <li>Use indexes on frequently queried columns for better performance</li>
                <li>Set up regular backups of your indexed data</li>
              </ul>
            </div>
          </section>
        </motion.div>
      </div>
    </main>
  );
} 