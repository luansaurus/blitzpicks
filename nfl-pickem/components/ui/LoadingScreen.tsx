"use client";

import { useState, useEffect } from 'react';

export default function LoadingScreen() {
  const [mounted, setMounted] = useState(false);
  
  const [accentColor, setAccentColor] = useState('#E31837');
  const [ambientPrimary, setAmbientPrimary] = useState('#013369');

  useEffect(() => {
    // 1. Extração segura das cores no client-side após a montagem do componente.
    if (typeof window !== "undefined") {
      const savedAccent = localStorage.getItem('blitz_accent');
      if (savedAccent) setAccentColor(savedAccent);
      
      const savedAmbient = localStorage.getItem('blitz_header_bg');
      if (savedAmbient) setAmbientPrimary(savedAmbient);
    }
    // 2. Liberta o componente para exibir as cores de forma segura, anulando a colisão de Hydration.
    setMounted(true);
  }, []);

  // O componente permanece "invisível" para o Next.js no lado do Servidor.
  // Assim, o React não se confunde com atributos que o Servidor não conseguiu adivinhar.
  if (!mounted) {
    return (
      <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white overflow-hidden relative">
        <div 
          className="absolute inset-0 z-0 pointer-events-none opacity-20 mix-blend-overlay"
          style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)' }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white overflow-hidden relative">
      
      <div 
        className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full blur-[140px] opacity-25 pointer-events-none z-0 transition-colors duration-1000"
        style={{ backgroundColor: accentColor }}
      />
      <div 
        className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full blur-[140px] opacity-15 pointer-events-none z-0 transition-colors duration-1000"
        style={{ backgroundColor: ambientPrimary }}
      />
      
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-20 mix-blend-overlay"
        style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)' }}
      />

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 0.2; }
          100% { transform: scale(0.8); opacity: 0.8; }
        }
        .animate-pulse-ring {
          animation: pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      <div className="mb-8 relative w-24 h-24 flex items-center justify-center z-10">
        <div className="absolute inset-0 rounded-full border-2 border-white/5 bg-black/40 backdrop-blur-md shadow-2xl"></div>
        <div className="absolute w-24 h-24 rounded-full border-2 animate-pulse-ring shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-colors duration-1000" style={{ borderColor: accentColor }}></div>
        <div className="w-4 h-4 rounded-full shadow-lg animate-ping transition-colors duration-1000" style={{ backgroundColor: accentColor }}></div>
      </div>
      
      <div className="flex flex-col items-center gap-2 z-10">
        <span className="font-jersey text-4xl sm:text-5xl uppercase tracking-widest text-white drop-shadow-md">
          BLITZ<span className="transition-colors duration-1000" style={{ color: accentColor, textShadow: `0 0 15px ${accentColor}80` }}>PICKS</span>
        </span>
        <span className="font-sans text-[10px] font-black text-gray-500 uppercase tracking-widest animate-pulse mt-1">
          Reading the defense...
        </span>
      </div>
      
    </main>
  );
}