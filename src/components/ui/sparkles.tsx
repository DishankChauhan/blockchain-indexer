"use client";
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const Sparkles = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => {
  const random = () => Math.floor(Math.random() * 10) + 1;
  const sparkles = Array.from({ length: 20 }).map((_, i) => (
    <motion.div
      key={i}
      className="absolute h-1 w-1 bg-indigo-500 rounded-full"
      style={{
        top: `${random() * 100}%`,
        left: `${random() * 100}%`,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: [0, 1, 0],
        opacity: [0, 1, 0],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        delay: random(),
      }}
    />
  ));

  return (
    <div className={cn("relative", className)} {...props}>
      {sparkles}
      {children}
    </div>
  );
}; 