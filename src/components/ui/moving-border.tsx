"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const MovingBorder = ({
  children,
  duration = 2000,
  className,
  containerClassName,
  borderClassName,
  as: Component = "div",
}: {
  children: React.ReactNode;
  duration?: number;
  className?: string;
  containerClassName?: string;
  borderClassName?: string;
  as?: any;
}) => {
  return (
    <Component className={cn("relative", containerClassName)}>
      <motion.div
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: duration / 1000, repeat: Infinity, ease: "linear" }}
        className={cn(
          "absolute inset-0 rounded-3xl bg-gradient-to-r from-violet-600 via-pink-500 to-indigo-500",
          borderClassName
        )}
      />
      <motion.div
        className={cn(
          "relative bg-zinc-900 rounded-3xl p-[1px] h-full",
          className
        )}
      >
        {children}
      </motion.div>
    </Component>
  );
}; 