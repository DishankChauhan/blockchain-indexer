"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface GlowingButtonProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  onClick?: () => void;
  href?: string;
}

export const GlowingButton = ({
  children,
  className,
  containerClassName,
  onClick,
  href,
}: GlowingButtonProps) => {
  const ButtonWrapper = href ? Link : "button";
  const buttonProps = href ? { href } : { onClick };

  return (
    <div className={cn("relative group", containerClassName)}>
      <ButtonWrapper
        {...buttonProps}
        className={cn(
          "relative px-8 py-4 rounded-xl bg-black/80 backdrop-blur-sm",
          "text-white font-semibold text-lg transition-all duration-300",
          "border border-purple-500/50 hover:border-purple-500",
          "hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]",
          "focus:outline-none focus:ring-2 focus:ring-purple-500/70",
          "active:scale-100",
          className
        )}
      >
        <div className="relative z-10">
          {children}
        </div>
        <div
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600/40 to-purple-400/40 opacity-0 group-hover:opacity-20 transition-opacity duration-300"
          style={{
            filter: "blur(15px)",
          }}
        />
      </ButtonWrapper>
    </div>
  );
}; 