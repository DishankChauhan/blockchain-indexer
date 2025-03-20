"use client";

import React from 'react';
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { RotatingBlockchain } from "@/components/ui/rotating-blockchain";
import { MovingCards } from "@/components/ui/moving-cards";
import { CodePreview } from "@/components/ui/code-preview";
import { AnimatedChart } from "@/components/ui/animated-chart";
import { TestimonialsCarousel } from "@/components/ui/testimonials-carousel";
import { FeatureComparison } from "@/components/ui/feature-comparison";

const stats = [
  { value: "1M+", label: "Blocks Indexed" },
  { value: "500+", label: "Active Users" },
  { value: "10ms", label: "Query Latency" },
  { value: "99.9%", label: "Uptime" }
];

export default function Home() {
  const router = useRouter();

  const handleNavigation = (path: string) => {
    try {
      router.push(path);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto pt-24 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-400 to-white mb-6">
            Blockchain Indexer
          </h1>
          <p className="text-2xl text-white/90 max-w-2xl mx-auto mb-12">
            High-performance blockchain data indexing platform with real-time analytics and custom query capabilities
          </p>
          <div className="flex justify-center gap-6">
            <button 
              type="button"
              onClick={() => handleNavigation('/dashboard')}
              className="px-8 py-4 bg-black text-white border border-purple-500 rounded-xl hover:bg-purple-500/10 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] font-semibold cursor-pointer"
            >
              Get Started
            </button>
            <button 
              type="button"
              onClick={() => handleNavigation('/docs')}
              className="px-8 py-4 bg-black text-white border border-purple-500 rounded-xl hover:bg-purple-500/10 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] font-semibold cursor-pointer"
            >
              View Documentation
            </button>
          </div>
        </motion.div>
      </div>

      {/* 3D Blockchain Visualization - Made Larger */}
      <div className="w-full py-24">
        <RotatingBlockchain />
      </div>

      {/* Moving Cards Section */}
      <div className="max-w-7xl mx-auto py-16 px-4">
        <MovingCards />
      </div>

      {/* Code Preview Section */}
      <div className="max-w-7xl mx-auto py-16 px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white">
            Simple Integration
          </h2>
          <p className="text-white/60 mt-2">Start indexing blockchain data with just a few lines of code</p>
        </div>
        <CodePreview />
      </div>

      {/* Live Chart Section */}
      <div className="max-w-7xl mx-auto py-16 px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white">
            Real-time Block Processing
          </h2>
          <p className="text-white/60 mt-2">Watch our indexer process new blocks in real-time</p>
        </div>
        <AnimatedChart />
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto py-16 px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-6 rounded-xl bg-black/50 backdrop-blur-sm border border-purple-500/20 text-center"
            >
              <div className="text-3xl font-bold text-white">
                {stat.value}
              </div>
              <div className="text-sm text-white/60 mt-2">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Feature Comparison */}
      <div className="max-w-7xl mx-auto py-16 px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white">
            Choose Your Plan
          </h2>
          <p className="text-white/60 mt-2">Compare features and find the perfect plan for your needs</p>
        </div>
        <FeatureComparison />
      </div>

      {/* Testimonials */}
      <div className="max-w-3xl mx-auto py-16 px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white">
            What Our Users Say
          </h2>
          <p className="text-white/60 mt-2">Trusted by developers worldwide</p>
        </div>
        <TestimonialsCarousel />
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto py-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-12 rounded-2xl bg-black/50 backdrop-blur-sm border border-purple-500/20 text-center"
        >
          <h2 className="text-4xl font-bold mb-4 text-white">
            Ready to Get Started?
          </h2>
          <p className="text-white/90 text-xl mb-8 max-w-2xl mx-auto">
            Join hundreds of developers who are already using our platform to build powerful blockchain applications.
          </p>
          <button 
            type="button"
            onClick={() => handleNavigation('/signup')}
            className="px-8 py-4 bg-black text-white border border-purple-500 rounded-xl hover:bg-purple-500/10 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] font-semibold cursor-pointer"
          >
            Sign Up Now
          </button>
        </motion.div>
      </div>
    </main>
  );
} 