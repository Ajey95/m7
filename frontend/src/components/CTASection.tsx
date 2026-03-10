import Link from "next/link";

export default function CTASection() {
  return (
    <section className="relative py-24 px-4 md:px-10 z-10 reveal">
      <div className="max-w-5xl mx-auto glass-card rounded-3xl p-10 md:p-20 text-center relative overflow-hidden border-t border-primary/20 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80 shadow-[0_0_10px_rgba(251,146,60,0.5)]"></div>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>
        <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 relative z-10">
          Ready to Make a Difference?
        </h2>
        <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto mb-12 relative z-10 leading-relaxed">
          Whether you have food to give, time to share, or a community to feed,
          there&apos;s a place for you in the Surplus network.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 relative z-10">
          <Link href="/login" className="w-full sm:w-auto">
            <button className="bg-primary hover:bg-orange-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-bold transition-all shadow-[0_0_20px_rgba(251,146,60,0.3)] hover:shadow-[0_0_40px_rgba(251,146,60,0.6)] hover:-translate-y-1 w-full">
              Join as Partner
            </button>
          </Link>
          <Link href="/register?role=volunteer" className="w-full sm:w-auto">
            <button className="glass-card hover:bg-white/10 text-white px-8 py-4 rounded-xl text-lg font-bold transition-all w-full border border-white/20 hover:border-white/40 hover:-translate-y-1">
              Become a Volunteer
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
