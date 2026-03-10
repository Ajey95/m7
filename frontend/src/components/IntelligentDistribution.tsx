export default function IntelligentDistribution() {
  return (
    <section className="relative py-20 z-10 overflow-hidden bg-slate-900/40 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 md:px-10 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 space-y-8 z-20 reveal">
            <h2 className="text-4xl md:text-6xl font-bold leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-100 drop-shadow-[0_0_15px_rgba(251,146,60,0.3)]">
                Intelligent
              </span>{" "}
              Distribution
            </h2>
            <p className="text-slate-300 text-lg leading-relaxed border-l-2 border-primary/50 pl-6">
              Our AI-driven routing engine visualizes surplus nodes as living
              data points. Real-time rescue paths connect abundance with need in
              a stunning display of efficiency.
            </p>
            <div className="space-y-6 mt-8">
              <div className="glass-card p-5 hover:bg-slate-800/40 transition-all hover:translate-x-2 border-l-4 border-l-green-500 border-t-0 border-r-0 border-b-0 rounded-r-xl">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center shrink-0 border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                    <span className="material-symbols-outlined">hub</span>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">
                      Dynamic Routing
                    </h4>
                    <p className="text-slate-400 text-sm mt-1">
                      Paths curve and adapt based on traffic density and
                      perishability.
                    </p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-5 hover:bg-slate-800/40 transition-all hover:translate-x-2 border-l-4 border-l-primary border-t-0 border-r-0 border-b-0 rounded-r-xl">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-[0_0_15px_rgba(251,146,60,0.1)]">
                    <span className="material-symbols-outlined">analytics</span>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">
                      Predictive Analytics
                    </h4>
                    <p className="text-slate-400 text-sm mt-1">
                      Forecasting supply spikes using historical region data.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full flex items-center justify-center relative min-h-[400px] reveal delay-200">
            <div className="absolute inset-0 bg-primary/5 blur-[100px] rounded-full"></div>
            <div className="relative w-full max-w-md aspect-video glass-card overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(251,146,60,0.2)] animate-float rounded-2xl">
              <div className="glass-highlight"></div>
              <video
                className="w-full h-full object-cover"
                autoPlay
                muted
                loop
                playsInline
              >
                <source src="/demo.mp4" type="video/mp4" />
                <div className="flex items-center justify-center h-full bg-slate-900/80">
                  <p className="text-slate-400 text-sm">Video placeholder</p>
                </div>
              </video>
              <div className="absolute inset-0 bg-primary/5 mix-blend-overlay pointer-events-none"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
