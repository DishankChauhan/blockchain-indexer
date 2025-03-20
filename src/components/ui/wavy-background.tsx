"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const WavyBackground = ({
  children,
  className,
  containerClassName,
  colors = ["#1a1a1a", "#221f1f", "#2a2727"],
  blur = 10,
}: {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  colors?: string[];
  blur?: number;
}) => {
  const backgroundRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!backgroundRef.current) return;
      const rect = backgroundRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setOffset({
        x: (e.clientX - centerX) * 0.1,
        y: (e.clientY - centerY) * 0.1,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      className={cn("relative overflow-hidden", containerClassName)}
      ref={backgroundRef}
    >
      {colors.map((color, idx) => (
        <motion.div
          key={idx}
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(circle at ${50 + offset.x}% ${
              50 + offset.y
            }%, ${color} 0%, transparent 70%)`,
            filter: `blur(${blur * (idx + 1)}px)`,
            transform: `translate(${offset.x * (idx + 1)}px, ${
              offset.y * (idx + 1)
            }px)`,
          }}
        />
      ))}
      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
}; 