"use client";

export default function LoadingScreen() {
  return (
    <main className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white overflow-hidden">
      
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.85); opacity: 0.9; }
          50% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(0.85); opacity: 0.9; }
        }
        .animate-pulse-ring {
          animation: pulse-ring 1.2s ease-in-out infinite;
        }
      `}</style>

      <div className="mb-8 relative w-20 h-20 flex items-center justify-center">
        <div className="absolute w-20 h-20 rounded-full border-2 animate-pulse-ring" style={{ borderColor: 'var(--team-accent, #f59e0b)' }}></div>
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--team-accent, #f59e0b)' }}></div>
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