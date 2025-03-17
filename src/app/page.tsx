import React from 'react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">Blockchain Indexing Platform</h1>
        <p className="text-xl mb-4">
          Index Solana blockchain data into your PostgreSQL database using Helius webhooks
        </p>
      </div>
    </main>
  );
} 