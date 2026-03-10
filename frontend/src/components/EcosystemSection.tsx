export default function EcosystemSection() {
  return (
    <section id="ecosystem" className="relative py-32 px-4 md:px-10 max-w-7xl mx-auto z-10">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 reveal">
          The Ecosystem
        </h2>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg reveal delay-100">
          A seamless loop connecting those who have with those who need, powered
          by community.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Donors */}
        <div className="glass-card p-8 group hover:-translate-y-2 transition-transform duration-300 hover:shadow-[0_10px_30px_rgba(74,222,128,0.1)] reveal delay-100">
          <div className="glass-highlight"></div>
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-6 group-hover:bg-green-900/40 transition-colors border border-slate-700 group-hover:border-green-500/50 shadow-inner">
            <span className="material-symbols-outlined text-green-400 text-3xl">store</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Donors</h3>
          <p className="text-slate-400 text-sm">Restaurants, supermarkets, and farms upload surplus inventory instantly.</p>
        </div>

        {/* Transport */}
        <div className="glass-card p-8 group hover:-translate-y-2 transition-transform duration-300 hover:shadow-[0_10px_30px_rgba(59,130,246,0.1)] reveal delay-200">
          <div className="glass-highlight"></div>
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-900/40 transition-colors border border-slate-700 group-hover:border-blue-500/50 shadow-inner">
            <span className="material-symbols-outlined text-blue-400 text-3xl">local_shipping</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Transport</h3>
          <p className="text-slate-400 text-sm">Volunteer drivers and partner fleets execute optimized pickup runs.</p>
        </div>

        {/* Recipients */}
        <div className="glass-card p-8 group hover:-translate-y-2 transition-transform duration-300 hover:shadow-[0_10px_30px_rgba(251,146,60,0.1)] reveal delay-300">
          <div className="glass-highlight"></div>
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors border border-slate-700 group-hover:border-primary/50 shadow-inner">
            <span className="material-symbols-outlined text-primary text-3xl">volunteer_activism</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Recipients</h3>
          <p className="text-slate-400 text-sm">Shelters, food banks, and community centers receive fresh deliveries.</p>
        </div>

        {/* Planet */}
        <div className="glass-card p-8 group hover:-translate-y-2 transition-transform duration-300 hover:shadow-[0_10px_30px_rgba(168,85,247,0.1)] reveal delay-400">
          <div className="glass-highlight"></div>
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-6 group-hover:bg-purple-900/40 transition-colors border border-slate-700 group-hover:border-purple-500/50 shadow-inner">
            <span className="material-symbols-outlined text-purple-400 text-3xl">public</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Planet</h3>
          <p className="text-slate-400 text-sm">Less methane in landfills, reduced carbon footprint, a healthier earth.</p>
        </div>
      </div>
    </section>
  );
}
