const partners = [
  { icon: "volunteer_activism", name: "FoodBank", color: "text-primary" },
  { icon: "storefront", name: "FreshMarket", color: "text-green-400" },
  { icon: "restaurant", name: "CityBistro", color: "text-orange-400" },
  { icon: "agriculture", name: "GreenGrow", color: "text-green-500" },
  { icon: "local_cafe", name: "DailyBrew", color: "text-amber-400" },
  { icon: "local_shipping", name: "LogiTech", color: "text-blue-400" },
  { icon: "eco", name: "EcoWorld", color: "text-primary" },
  { icon: "public", name: "GlobalAid", color: "text-purple-400" },
];

export default function TrustedByMarquee() {
  return (
    <section className="border-y border-white/5 bg-slate-900/30 backdrop-blur-md relative z-10 overflow-hidden py-10">
      <p className="text-center text-sm font-bold text-slate-500 tracking-[0.2em] uppercase mb-8 reveal">
        Trusted by 500+ Organizations
      </p>
      <div className="marquee-container reveal delay-100">
        <div className="marquee-wrapper">
          <div className="marquee-group">
            {partners.map((partner, index) => (
              <div
                key={`group1-${index}`}
                className="flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity min-w-max"
              >
                <span
                  className={`material-symbols-outlined text-3xl ${partner.color}`}
                >
                  {partner.icon}
                </span>
                <span className="text-xl font-bold text-white">
                  {partner.name}
                </span>
              </div>
            ))}
          </div>
          <div className="marquee-group">
            {partners.map((partner, index) => (
              <div
                key={`group2-${index}`}
                className="flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity min-w-max"
              >
                <span
                  className={`material-symbols-outlined text-3xl ${partner.color}`}
                >
                  {partner.icon}
                </span>
                <span className="text-xl font-bold text-white">
                  {partner.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
