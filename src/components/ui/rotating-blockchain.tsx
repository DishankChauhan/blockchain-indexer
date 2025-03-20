"use client";

import React from 'react';
import { motion, useAnimation } from "framer-motion";
import { useEffect, useState } from "react";

export const RotatingBlockchain = () => {
  const [blocks, setBlocks] = useState<number[]>([]);
  const controls = useAnimation();

  useEffect(() => {
    setBlocks(Array.from({ length: 8 }, (_, i) => i));
    controls.start({
      rotate: 360,
      transition: {
        duration: 20,
        repeat: Infinity,
        ease: "linear",
      },
    });
  }, [controls]);

  return (
    <div className="relative h-[800px] w-full flex items-center justify-center overflow-hidden">
      <motion.div
        animate={controls}
        className="relative w-[800px] h-[800px]"
        style={{ transformStyle: "preserve-3d", perspective: "1200px" }}
      >
        {blocks.map((_, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `rotateY(${(i * 360) / blocks.length}deg) translateZ(300px)`,
            }}
          >
            <div className="w-48 h-48 bg-black rounded-xl flex items-center justify-center shadow-lg backdrop-blur-sm border border-purple-500/50 shadow-purple-500/20">
              <div className="text-white font-mono text-lg">
                Block {Math.floor(Math.random() * 1000000)}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
      
      {/* Glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black pointer-events-none" />
    </div>
  );
}; 