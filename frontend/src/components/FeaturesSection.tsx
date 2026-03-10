export default function FeaturesSection() {
  return (
    <section id="features" className="relative py-32 px-4 md:px-10 max-w-7xl mx-auto z-10">
      <div className="text-center mb-16 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[100px] bg-primary/10 blur-[60px] rounded-full pointer-events-none"></div>
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 reveal">
          Compassionate Tech
        </h2>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg reveal delay-100">
          We use advanced algorithms to match surplus food with nearby
          non-profits instantly, ensuring freshness and reducing carbon
          footprint.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="glass-card p-8 group hover:bg-white/5 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] reveal delay-100">
          <div className="glass-highlight"></div>
          <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-primary/20 shadow-[0_0_15px_rgba(251,146,60,0.2)]">
            <span className="material-symbols-outlined text-primary text-3xl">
              notifications_active
            </span>
          </div>
          <h3 className="text-xl font-bold text-white mb-3">
            Real-Time Alerts
          </h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Donors post surplus food in seconds. Nearby agencies get instant
            notifications to claim it.
          </p>
        </div>
        <div className="glass-card p-8 group hover:bg-white/5 transition-all duration-500 hover:-translate-y-4 z-10 border-primary/40 shadow-[0_0_40px_rgba(251,146,60,0.15)] reveal delay-200">
          <div className="glass-highlight"></div>
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 blur-[40px] rounded-full group-hover:bg-primary/30 transition-colors"></div>
          <div className="w-14 h-14 bg-gradient-to-br from-primary to-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary/40 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-white text-3xl">
              route
            </span>
          </div>
          <h3 className="text-xl font-bold text-white mb-3">Smart Logistics</h3>
          <p className="text-slate-200 text-sm leading-relaxed">
            Our routing engine optimizes pick-up paths for volunteers, saving
            fuel and time.
          </p>
        </div>
        <div className="glass-card p-8 group hover:bg-white/5 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] reveal delay-300">
          <div className="glass-highlight"></div>
          <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-primary/20 shadow-[0_0_15px_rgba(251,146,60,0.2)]">
            <span className="material-symbols-outlined text-primary text-3xl">
              bar_chart
            </span>
          </div>
          <h3 className="text-xl font-bold text-white mb-3">Impact Tracking</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Transparent dashboards show meals saved, CO2 prevented, and lives
            impacted.
          </p>
        </div>
      </div>
    </section>
  );
}
