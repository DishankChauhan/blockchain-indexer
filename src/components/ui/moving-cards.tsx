"use client";

import { motion } from "framer-motion";
import { useState } from "react";

export const MovingCards = () => {
  let [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const cards = [
    {
      title: "Real-time Block Indexing",
      description: "Index new blocks as they are added to the chain with sub-second latency",
      image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop",
    },
    {
      title: "Smart Contract Analytics",
      description: "Deep insights into contract interactions and token movements",
      image: "https://images.unsplash.com/photo-1639762681057-408e52192e55?q=80&w=2832&auto=format&fit=crop",
    },
    {
      title: "Custom Data Queries",
      description: "Build and execute custom queries on indexed blockchain data",
      image: "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?q=80&w=2832&auto=format&fit=crop",
    },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-4 px-4 md:px-8">
      {cards.map((card, idx) => (
        <motion.div
          key={idx}
          className="relative h-96 w-full md:w-1/3 rounded-2xl overflow-hidden cursor-pointer group"
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.2 }}
        >
          <div
            className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent to-black/90 group-hover:via-black/50 transition-all duration-500"
          />
          <motion.img
            src={card.image}
            alt={card.title}
            className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 z-20 flex flex-col justify-end p-6">
            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.3 }}
              className="text-2xl font-bold text-white mb-2"
            >
              {card.title}
            </motion.h3>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: hoveredIndex === idx ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              className="text-zinc-300 text-sm"
            >
              {card.description}
            </motion.p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}; 