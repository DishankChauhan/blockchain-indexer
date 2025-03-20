'use client';

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      setScrolled(currentScrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { name: "Home", href: "/" },
    { name: "Dashboard", href: "/dashboard" },
    { name: "Jobs", href: "/jobs" },
    { name: "Connections", href: "/connections" },
    { name: "Analytics", href: "/analytics" },
  ];

  const opacity = Math.min(scrollY / 100, 0.8); // Reduced max opacity

  return (
    <motion.div
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out ${
        scrolled 
          ? "bg-white/[0.02] backdrop-blur-sm border-b border-white/[0.05] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]"
          : "bg-transparent"
      }`}
      style={{
        backdropFilter: `blur(${Math.min(scrollY / 10, 8)}px)`,
        backgroundColor: `rgba(0, 0, 0, ${opacity * 0.3})`
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-8">
            <Link 
              href="/"
              className="relative group"
            >
              <span className="text-lg font-medium bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
                IndexChain
              </span>
              <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-white/20 transition-all duration-300 ease-out group-hover:w-full"></span>
            </Link>

            {session && (
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="relative px-3 py-1.5 group rounded-md transition-all duration-300 ease-out hover:bg-white/[0.02]"
                  >
                    <span className={`relative z-10 text-sm font-normal transition-colors duration-300 ${
                      pathname === item.href ? "text-white/90" : "text-white/50 group-hover:text-white/80"
                    }`}>
                      {item.name}
                    </span>
                    {pathname === item.href && (
                      <motion.div
                        layoutId="navbar-indicator"
                        className="absolute inset-0 bg-white/[0.02] rounded-md"
                        style={{ 
                          boxShadow: '0 0 20px rgba(255, 255, 255, 0.03)'
                        }}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <>
                <div className="text-sm text-white/50">
                  {session.user?.email}
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="relative px-3 py-1.5 text-sm font-normal overflow-hidden group rounded-md transition-all duration-300 ease-out"
                >
                  <div className="absolute inset-0 w-full h-full transition-all duration-300 ease-out group-hover:bg-white/[0.02]"></div>
                  <div className="relative text-white/80 group-hover:text-white/90">
                    Sign Out
                  </div>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="relative px-3 py-1.5 text-sm font-normal text-white/50 hover:text-white/90 transition-all duration-300 ease-out group rounded-md hover:bg-white/[0.02]"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="relative px-3 py-1.5 text-sm font-normal overflow-hidden group rounded-md bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-300 ease-out"
                >
                  <span className="text-white/90">Sign Up</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
} 