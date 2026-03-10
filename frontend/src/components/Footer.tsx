export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#020617] relative z-10 py-16 px-4 md:px-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-xl">
              eco
            </span>
          </div>
          <span className="text-2xl font-bold text-white">Surplus</span>
        </div>
        <p className="text-slate-500 text-sm">
          © 2023 Surplus Network. Fueling hope, one meal at a time.
        </p>
        <div className="flex gap-8">
          <a
            className="text-slate-400 hover:text-primary transition-colors transform hover:scale-110 cursor-pointer"
            href="#"
          >
            <span className="material-symbols-outlined">mail</span>
          </a>
          <a
            className="text-slate-400 hover:text-primary transition-colors transform hover:scale-110 cursor-pointer"
            href="#"
          >
            Twitter
          </a>
          <a
            className="text-slate-400 hover:text-primary transition-colors transform hover:scale-110 cursor-pointer"
            href="#"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}
