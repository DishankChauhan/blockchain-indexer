'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function LandingPage() {
  // Gradient animation effect
  useEffect(() => {
    const gradient = document.querySelector('.animate-gradient');
    if (gradient) {
      const colors = ['#4F46E5', '#0EA5E9', '#6366F1'];
      let currentIndex = 0;

      const updateGradient = () => {
        currentIndex = (currentIndex + 1) % colors.length;
        const nextIndex = (currentIndex + 1) % colors.length;
        (gradient as HTMLElement).style.background = `linear-gradient(45deg, ${colors[currentIndex]}, ${colors[nextIndex]})`;
      };

      const interval = setInterval(updateGradient, 3000);
      return () => clearInterval(interval);
    }
  }, []);

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white overflow-hidden">
      {/* Animated background gradient */}
      <div className="fixed inset-0 animate-gradient opacity-10" />
      
      {/* Floating orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-500 rounded-full filter blur-3xl opacity-20 animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full filter blur-3xl opacity-20 animate-float-delayed" />
      </div>

      {/* Hero Section */}
      <div className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <motion.h1 
            className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Blockchain Indexer
          </motion.h1>
          <motion.p 
            className="text-xl md:text-2xl text-zinc-300 max-w-3xl mx-auto mb-10"
            {...fadeInUp}
          >
            Index, analyze, and monitor blockchain data in real-time with our powerful indexing platform
          </motion.p>
          <motion.div 
            className="flex justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Link 
              href="/auth/signin" 
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30"
            >
              Get Started
            </Link>
            <Link 
              href="/docs" 
              className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-all duration-200"
            >
              Documentation
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Features Grid */}
      <motion.div 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid grid-cols-1 md:grid-cols-3 gap-8"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
      >
        <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700/50 hover:border-indigo-500/50 transition-all duration-300">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Real-time Indexing</h3>
          <p className="text-zinc-400">Index blockchain data in real-time with high throughput and low latency</p>
        </div>

        <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700/50 hover:border-indigo-500/50 transition-all duration-300">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Advanced Analytics</h3>
          <p className="text-zinc-400">Powerful analytics and visualization tools for blockchain data</p>
        </div>

        <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700/50 hover:border-indigo-500/50 transition-all duration-300">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Webhook Integration</h3>
          <p className="text-zinc-400">Instant notifications and webhooks for real-time updates</p>
        </div>
      </motion.div>

      {/* Stats Section */}
      <motion.div 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-indigo-500 mb-2">1M+</div>
            <div className="text-zinc-400">Blocks Indexed</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-indigo-500 mb-2">500+</div>
            <div className="text-zinc-400">Active Users</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-indigo-500 mb-2">10K+</div>
            <div className="text-zinc-400">Webhooks/Day</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-indigo-500 mb-2">99.9%</div>
            <div className="text-zinc-400">Uptime</div>
          </div>
        </div>
      </motion.div>

      {/* CTA Section */}
      <motion.div 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-12 rounded-2xl border border-zinc-700/50">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to get started?</h2>
          <p className="text-xl text-zinc-300 mb-8 max-w-2xl mx-auto">
            Join hundreds of developers using our platform to index and analyze blockchain data
          </p>
          <Link 
            href="/auth/signup" 
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30"
          >
            Sign Up Now
          </Link>
        </div>
      </motion.div>
    </div>
  );
} 