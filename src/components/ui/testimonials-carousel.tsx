"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const testimonials = [
  {
    name: "Alex Thompson",
    role: "Blockchain Developer",
    company: "CryptoTech",
    text: "The real-time indexing capabilities have transformed our dApp's performance. Response times went from seconds to milliseconds.",
  },
  {
    name: "Sarah Chen",
    role: "Lead Engineer",
    company: "DeFi Protocol",
    text: "The analytics tools provided deep insights into our smart contract usage patterns that we couldn't get anywhere else.",
  },
  {
    name: "Michael Rodriguez",
    role: "CTO",
    company: "NFT Platform",
    text: "Setting up webhook notifications was a breeze. Now our users get instant updates about their transactions.",
  },
];

export const TestimonialsCarousel = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full overflow-hidden bg-black/50 backdrop-blur-sm rounded-2xl border border-teal-500/20 p-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-teal-400 via-emerald-400 to-cyan-400 flex items-center justify-center text-2xl font-bold text-white">
              {testimonials[current].name[0]}
            </div>
          </div>
          <p className="text-lg text-gray-300 italic mb-6">"{testimonials[current].text}"</p>
          <h3 className="text-xl font-semibold text-white mb-1">{testimonials[current].name}</h3>
          <p className="text-teal-400">{testimonials[current].role}</p>
          <p className="text-gray-400 text-sm">{testimonials[current].company}</p>
        </motion.div>
      </AnimatePresence>
      <div className="flex justify-center mt-8 space-x-2">
        {testimonials.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              idx === current ? "bg-teal-400 w-8" : "bg-gray-600"
            }`}
          />
        ))}
      </div>
    </div>
  );
}; 