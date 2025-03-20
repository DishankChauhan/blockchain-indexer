"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export const AnimatedChart = () => {
  const [data, setData] = useState<number[]>([]);
  const maxDataPoints = 20;

  useEffect(() => {
    const interval = setInterval(() => {
      setData((currentData) => {
        const newValue = Math.random() * 100;
        const newData = [...currentData, newValue];
        if (newData.length > maxDataPoints) {
          newData.shift();
        }
        return newData;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const maxValue = Math.max(...data, 100);
  const minValue = Math.min(...data, 0);

  return (
    <div className="w-full h-64 bg-black/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
      <div className="relative w-full h-full">
        <div className="absolute inset-0 flex items-end justify-between">
          {data.map((value, index) => {
            const height = ((value - minValue) / (maxValue - minValue)) * 100;
            return (
              <motion.div
                key={index}
                className="w-2 bg-gradient-to-t from-violet-500 to-indigo-500 rounded-t-sm"
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.5 }}
              />
            );
          })}
        </div>
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          <div className="h-px bg-white/10" />
          <div className="h-px bg-white/10" />
          <div className="h-px bg-white/10" />
          <div className="h-px bg-white/10" />
        </div>
      </div>
    </div>
  );
}; 