"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

export default function HeroSection() {
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const animateValue = (
      obj: HTMLElement,
      start: number,
      end: number,
      duration: number
    ) => {
      let startTimestamp: number | null = null;
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);

        const isFloat = end.toString().includes(".");
        const val = progress * (end - start) + start;

        obj.innerHTML = isFloat ? val.toFixed(1) : Math.floor(val).toString();

        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          obj.innerHTML = end.toString();
        }
      };
      window.requestAnimationFrame(step);
    };

    const countUpObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const counter = entry.target as HTMLElement;
            counter.innerText = "0";
            const target = parseFloat(
              counter.getAttribute("data-target") || "0"
            );
            animateValue(counter, 0, target, 3500);
            observer.unobserve(counter);
          }
        });
      },
      { threshold: 0.1 }
    );

    const counters = document.querySelectorAll(".count-up");
    counters.forEach((counter) => countUpObserver.observe(counter));

    return () => {
      counters.forEach((counter) => countUpObserver.unobserve(counter));
    };
  }, []);

  return (
    <main className="relative pt-32 pb-20 px-4 md:px-10 max-w-7xl mx-auto z-10 flex flex-col lg:flex-row items-center gap-16 min-h-screen">
      <div className="flex-1 flex flex-col gap-8 z-10 relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 w-fit backdrop-blur-md shadow-[0_0_15px_rgba(74,222,128,0.2)] reveal">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          <span className="text-xs font-medium text-slate-300 tracking-wide uppercase">
            Live Galactic Logistics
          </span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-slate-400 drop-shadow-lg reveal delay-100">
          RESCUE FOOD,
          <br />
          <span className="text-primary drop-shadow-[0_0_35px_rgba(251,146,60,0.6)]">
            FUEL HOPE
          </span>
        </h1>
        <p className="text-lg md:text-xl text-slate-300 max-w-xl leading-relaxed reveal delay-200">
          A seamless logistics network connecting surplus with need. Powered by
          data, driven by compassion. Join the galaxy of change-makers.
        </p>
        <div className="flex flex-wrap gap-4 mt-2 relative z-30 reveal delay-300">
          <Link href="/register">
            <button className="flex items-center justify-center gap-2 bg-primary hover:bg-orange-400 text-slate-900 h-14 px-8 rounded-xl text-base font-bold transition-all shadow-[0_0_20px_rgba(251,146,60,0.3)] hover:scale-105 hover:shadow-[0_0_40px_rgba(251,146,60,0.6)] cursor-pointer">
              <span>Start Rescuing</span>
              <span className="material-symbols-outlined text-xl">
                arrow_forward
              </span>
            </button>
          </Link>
          <Link href="#ecosystem">
            <button className="flex items-center justify-center gap-2 glass-card hover:bg-white/10 text-white h-14 px-8 rounded-xl text-base font-bold transition-all hover:scale-105 group border-white/10 cursor-pointer">
              <span className="material-symbols-outlined text-primary group-hover:text-white transition-colors">
                play_circle
              </span>
              <span>See The Network</span>
            </button>
          </Link>
        </div>

        <div
          ref={statsRef}
          className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-white/10"
        >
          <div className="reveal delay-200">
            <p className="text-3xl font-bold text-white drop-shadow-lg">
              <span className="count-up" data-target="500">
                0
              </span>
              kg+
            </p>
            <p className="text-sm text-slate-400">Saved Today</p>
          </div>
          <div className="reveal delay-300">
            <p className="text-3xl font-bold text-white drop-shadow-lg">
              <span className="count-up" data-target="120">
                0
              </span>
              +
            </p>
            <p className="text-sm text-slate-400">Nodes Active</p>
          </div>
          <div className="reveal delay-400">
            <p className="text-3xl font-bold text-white drop-shadow-lg">
              <span className="count-up" data-target="2.5">
                0
              </span>
              T
            </p>
            <p className="text-sm text-slate-400">CO2 Prevented</p>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full relative h-[600px] flex items-center justify-center perspective-1000">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent rounded-full blur-[100px] opacity-40 transform translate-x-10 translate-y-10 animate-pulse-slow"></div>
        <div className="relative w-full h-full max-h-[700px] aspect-square animate-float z-10 flex items-center justify-center">
          <Image
            alt="Futuristic Food Rescue"
            className="w-[140%] h-[140%] object-contain drop-shadow-[0_40px_80px_rgba(0,0,0,0.7)] hover:scale-105 transition-transform duration-700 ease-out"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA4zr2Sp-nlLpJjKeMeSNG_AiKrQtpXNsOXryVp_u60XNQz8dVsVsI5LF38FC8XdxHL_V5hi3Twn5aWfijc7MH8dcawu550Qfx77LZ3Y8AUEot2oIwq9uzHtfGzvqCicD8E-k3yg15VHgnfJGGm5I47JFJbyuJePk-JUYAwtPk3ACSzXxDHq6EvdFe6uNLmy1GBqkmrXK8Cjjv3drWg4TL-NmVHS70TDsxHzXrGcKkKKSZZcZz5c0SpIRg2OJJOf2U3hfsBWEHYXp8"
            width={1000}
            height={1000}
            priority
          />
        </div>
        <div className="absolute top-20 -right-4 glass-card p-4 animate-float-delayed z-20 hover:translate-z-10 transition-transform backdrop-blur-2xl">
          <div className="glass-highlight"></div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.3)]">
              <span className="material-symbols-outlined text-green-400 text-sm">
                rocket_launch
              </span>
            </div>
            <div>
              <p className="text-xs font-bold text-white">Express Route</p>
              <p className="text-[10px] text-slate-400">In Transit • 2m</p>
            </div>
          </div>
        </div>
        <div className="absolute bottom-24 -left-12 glass-card p-4 animate-float z-20 hover:scale-105 transition-transform duration-300 backdrop-blur-2xl">
          <div className="glass-highlight"></div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Image
                alt="Fresh Produce"
                className="w-12 h-12 rounded-lg object-cover border border-white/20 shadow-lg"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBiT09rMI9tWWjhUqCJcBbTPCuQH2XoOWjaWYykJYd35o4ZmJqk346q1YaMWSpY1EFiprcBQsp4W2k4-ygUwXzSnmMsoAzjez_E4ETrymnzwCvXDMzmjGCkC-1HaHZtrVBuwyMG035e_tOk2ZjjxUWbpksTXTNGPEEusDFU5sETgDuzI8VnqliYEzHEU22XVycwpC1YXZ1Lj1L2TV3OlrctafLxNYG8ahowbvEeJFseuyBDYFeeJK4cqTpClRa6F11k7T58u4e4doA"
                width={48}
                height={48}
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border border-slate-900 shadow-[0_0_10px_rgba(251,146,60,0.5)]">
                <span className="material-symbols-outlined text-xs text-white">
                  check
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Fresh Cargo</p>
              <p className="text-xs text-primary font-medium">
                Verified Quality
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
