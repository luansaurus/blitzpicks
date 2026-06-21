"use client";

export default function LoadingScreen() {
  return (
    <main className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white overflow-hidden">
      
      <style>{`
        @keyframes fly-ball {
          0% { transform: translateX(-50px) rotate(-45deg) scale(0.9); }
          50% { transform: translateX(50px) rotate(45deg) scale(1.1); }
          100% { transform: translateX(-50px) rotate(-45deg) scale(0.9); }
        }
        .animate-fly-ball {
          animation: fly-ball 1.2s ease-in-out infinite;
        }
      `}</style>

      <div className="mb-8 relative w-40 h-20 flex items-center justify-center">
        <div className="absolute w-24 h-1 bg-white/10 rounded-full blur-sm"></div>
        <div className="animate-fly-ball text-5xl drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] relative z-10">
          🏈
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-2">
        <span className="text-2xl font-black italic tracking-tighter uppercase text-white">
          Blitz<span style={{ color: 'var(--team-accent)' }}>Picks</span>
        </span>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest animate-pulse">
          Reading the defense...
        </span>
      </div>
      
    </main>
  );
}