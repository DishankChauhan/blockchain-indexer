"use client";
import { useEffect } from "react";
import { motion } from "framer-motion";

export const TextGenerateEffect = ({
  words,
  className = "",
}: {
  words: string;
  className?: string;
}) => {
  const wordsArray = words.split(" ");

  const variants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
      },
    }),
  };

  return (
    <div className={className}>
      {wordsArray.map((word, idx) => (
        <motion.span
          key={word + idx}
          className="dark:text-white text-black opacity-0"
          custom={idx}
          initial="hidden"
          animate="visible"
          variants={variants}
        >
          {word}{" "}
        </motion.span>
      ))}
    </div>
  );
}; 