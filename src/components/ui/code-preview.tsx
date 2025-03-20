"use client";

import { motion } from "framer-motion";

const codeSnippet = `// Example blockchain indexing code
async function indexBlock(blockNumber: number) {
  const block = await provider.getBlock(blockNumber);
  
  // Process transactions
  for (const tx of block.transactions) {
    await processTransaction(tx);
  }
  
  // Index smart contract events
  const events = await queryEvents(blockNumber);
  await indexEvents(events);
  
  // Update statistics
  await updateBlockStats(block);
}`;

export const CodePreview = () => {
  return (
    <div className="w-full rounded-xl overflow-hidden bg-black/50 backdrop-blur-sm border border-emerald-500/20">
      <div className="flex items-center justify-between px-4 py-2 bg-emerald-500/10">
        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div className="text-emerald-400 text-sm">indexer.ts</div>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="p-4 font-mono text-sm"
      >
        {codeSnippet.split('\n').map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex"
          >
            <span className="text-zinc-500 w-8 text-right mr-4">{i + 1}</span>
            <span className="text-emerald-300">{line}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}; 