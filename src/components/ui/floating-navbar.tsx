"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SpotlightCard } from "./spotlight-card";

export const FloatingNavbar = () => {
  const [activeTab, setActiveTab] = useState("home");
  const pathname = usePathname();

  const tabs = [
    {
      name: "Home",
      href: "/",
    },
    {
      name: "Dashboard",
      href: "/dashboard",
    },
    {
      name: "Jobs",
      href: "/jobs",
    },
    {
      name: "Connections",
      href: "/connections",
    },
    {
      name: "Analytics",
      href: "/analytics",
    },
  ];

  return (
    <SpotlightCard
      containerClassName="fixed top-10 inset-x-0 max-w-2xl mx-auto z-50"
      className="w-full rounded-full"
    >
      <motion.div
        className="flex items-center justify-center space-x-4 rounded-full bg-black/40 border border-white/[0.2] backdrop-blur-md p-3"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
        }}
      >
        {tabs.map((tab) => (
          <Link
            key={tab.name}
            href={tab.href}
            className={`${
              pathname === tab.href
                ? "text-neutral-200"
                : "text-neutral-400 hover:text-neutral-200"
            } rounded-full px-4 py-2 text-sm font-medium transition-colors`}
          >
            {tab.name}
          </Link>
        ))}
      </motion.div>
    </SpotlightCard>
  );
}; 