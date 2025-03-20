"use client";

import React from 'react';
import { motion } from "framer-motion";

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
        </motion.div>
      </div>
    </main>
  );
} 