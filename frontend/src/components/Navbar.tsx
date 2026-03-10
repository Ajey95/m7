"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className="fixed top-0 w-full z-50 px-4 py-4 md:px-10">
      <div
        className={`glass-card px-6 py-4 flex items-center justify-between max-w-7xl mx-auto relative group transition-all duration-300 ${scrolled ? "backdrop-blur-xl bg-slate-900/40" : ""
          }`}
      >
        <div className="glass-highlight"></div>
        <Link href="/" className="flex items-center gap-3 z-10">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-orange-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(251,146,60,0.4)]">
            <span className="material-symbols-outlined text-white">eco</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Surplus</h1>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a
            className="hover:text-white transition-colors relative group/link"
            href="#features"
          >
            Mission
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover/link:w-full"></span>
          </a>
          <a
            className="hover:text-white transition-colors relative group/link"
            href="#features"
          >
            How it Works
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover/link:w-full"></span>
          </a>
          <a
            className="hover:text-white transition-colors relative group/link"
            href="#ecosystem"
          >
            Partners
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover/link:w-full"></span>
          </a>
        </div>
        <div className="flex items-center gap-4 z-10">
          <Link
            className="hidden md:block text-sm font-bold text-white hover:text-primary transition-colors cursor-pointer"
            href="/login"
          >
            Log In
          </Link>
          <Link href="/register">
            <button className="bg-primary hover:bg-orange-400 text-slate-900 px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-[0_0_20px_rgba(251,146,60,0.3)] hover:shadow-[0_0_30px_rgba(251,146,60,0.5)] hover:-translate-y-0.5 cursor-pointer">
              Join Movement
            </button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
