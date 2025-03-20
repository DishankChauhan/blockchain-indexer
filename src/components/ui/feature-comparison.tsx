"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const features = [
  {
    name: "Real-time Indexing",
    free: "✓",
    pro: "✓",
    enterprise: "✓",
    description: "Index blockchain data in real-time",
  },
  {
    name: "Custom Queries",
    free: "Limited",
    pro: "✓",
    enterprise: "✓",
    description: "Build and execute custom data queries",
  },
  {
    name: "API Rate Limits",
    free: "1000/day",
    pro: "50000/day",
    enterprise: "Unlimited",
    description: "Number of API calls allowed per day",
  },
  {
    name: "Historical Data",
    free: "30 days",
    pro: "1 year",
    enterprise: "Full history",
    description: "Access to historical blockchain data",
  },
  {
    name: "Webhook Support",
    free: "✗",
    pro: "✓",
    enterprise: "✓",
    description: "Real-time notifications via webhooks",
  },
  {
    name: "Support SLA",
    free: "Community",
    pro: "24/7 Email",
    enterprise: "24/7 Priority",
    description: "Level of customer support provided",
  },
];

export const FeatureComparison = () => {
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);

  return (
    <div className="w-full overflow-x-auto">
      <motion.div className="min-w-full rounded-xl overflow-hidden bg-black/50 backdrop-blur-sm border border-cyan-500/20">
        <div className="grid grid-cols-4 gap-px bg-cyan-500/20">
          <div className="bg-black/50 p-4">
            <h3 className="text-lg font-semibold text-white">Features</h3>
          </div>
          {["Free", "Pro", "Enterprise"].map((plan) => (
            <div key={plan} className="bg-black/50 p-4">
              <h3 className="text-lg font-semibold text-cyan-400">{plan}</h3>
            </div>
          ))}
        </div>
        <div className="divide-y divide-cyan-500/20">
          {features.map((feature) => (
            <motion.div
              key={feature.name}
              className="grid grid-cols-4 gap-px bg-cyan-500/20"
              onMouseEnter={() => setHoveredFeature(feature.name)}
              onMouseLeave={() => setHoveredFeature(null)}
              animate={{
                backgroundColor: hoveredFeature === feature.name ? "rgba(8, 145, 178, 0.1)" : "transparent",
              }}
            >
              <div className="bg-black/50 p-4">
                <div className="font-medium text-white">{feature.name}</div>
                {hoveredFeature === feature.name && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-gray-400 mt-1"
                  >
                    {feature.description}
                  </motion.div>
                )}
              </div>
              <div className="bg-black/50 p-4 text-center text-emerald-400">{feature.free}</div>
              <div className="bg-black/50 p-4 text-center text-emerald-400">{feature.pro}</div>
              <div className="bg-black/50 p-4 text-center text-emerald-400">{feature.enterprise}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}; 