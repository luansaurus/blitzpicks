"use client";

import { X, Trophy, AlertCircle, HelpCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
}

export default function HelpModal({ isOpen, onClose, accentColor }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#050505]/95 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9)] flex flex-col max-h-[85vh] relative">
        
        {/* Fundo com textura e Spotlight */}
        <div 
          className="absolute inset-0 z-0 pointer-events-none opacity-20 mix-blend-overlay"
          style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)' }}
        />

        {/* Cabeçalho do Modal */}
        <div className="flex justify-between items-center p-5 sm:p-6 border-b border-white/10 bg-black/60 relative z-10 shadow-inner">
          <div className="flex items-center gap-3">
            <HelpCircle size={24} style={{ color: accentColor }} />
            <h2 className="font-jersey text-2xl sm:text-3xl uppercase tracking-widest text-white drop-shadow-md">HOW TO PLAY & RULES</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo das Regras (Com scroll interno) */}
        <div className="p-6 overflow-y-auto space-y-6 text-gray-300 relative z-10 custom-scrollbar">
          
          {/* Seção 1: Sistema de Pontuação */}
          <div className="space-y-3">
            <h3 className="font-sport font-bold text-xs sm:text-sm uppercase tracking-wider text-white flex items-center gap-2" style={{ color: accentColor }}>
              <Trophy size={16} /> Scoring System (Picks)
            </h3>
            <p className="font-sans text-xs leading-relaxed text-gray-400 font-medium">
              Your goal is to predict the exact scores or outcomes of the NFL games each week. Points are awarded based on accuracy after each game finishes:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col items-center text-center shadow-inner">
                <span className="font-jersey text-3xl sm:text-4xl text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)] mb-1">7 PTS</span>
                <span className="font-sport font-bold text-xs uppercase tracking-wider text-white mb-1">Exact Score</span>
                <span className="font-sans text-[9px] text-gray-500 font-medium">You nailed both home and away scores perfectly.</span>
              </div>

              <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col items-center text-center shadow-inner">
                <span className="font-jersey text-3xl sm:text-4xl text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)] mb-1">5 PTS</span>
                <span className="font-sport font-bold text-xs uppercase tracking-wider text-white mb-1">Correct Margin</span>
                <span className="font-sans text-[9px] text-gray-500 font-medium">Winner correct + exact score difference.</span>
              </div>

              <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col items-center text-center shadow-inner">
                <span className="font-jersey text-3xl sm:text-4xl text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] mb-1">3 PTS</span>
                <span className="font-sport font-bold text-xs uppercase tracking-wider text-white mb-1">Correct Winner</span>
                <span className="font-sans text-[9px] text-gray-500 font-medium">You picked the right winner, but wrong scoreline.</span>
              </div>
            </div>
          </div>

          {/* Seção 2: Prazos e Fechamento */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <h3 className="font-sport font-bold text-xs sm:text-sm uppercase tracking-wider text-white flex items-center gap-2" style={{ color: accentColor }}>
              <AlertCircle size={16} /> Deadlines & Locking
            </h3>
            <p className="font-sans text-xs leading-relaxed text-gray-400 font-medium">
              Picks lock automatically <strong>15 minutes before</strong> each individual game kicks off. Make sure to save your predictions ahead of time! If a game starts, editing is disabled.
            </p>
          </div>

          {/* Seção 3: Regra do 1 Ponto */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <h3 className="font-sport font-bold text-xs sm:text-sm uppercase tracking-wider text-white flex items-center gap-2" style={{ color: accentColor }}>
              <AlertCircle size={16} /> NFL Scoring Rules
            </h3>
            <p className="font-sans text-xs leading-relaxed text-gray-400 font-medium">
              The app validates NFL scores automatically. In American football, a final score where a team has exactly <strong>1 point</strong> is virtually impossible (due to safety rules). The app will warn you if an invalid score combination is entered.
            </p>
          </div>

        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-black/60 flex justify-end relative z-10 shadow-inner">
          <button 
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-sport font-bold text-sm uppercase tracking-wider text-black transition-all shadow-xl hover:scale-105"
            style={{ backgroundColor: accentColor, boxShadow: `0 0 15px ${accentColor}60` }}
          >
            Got It
          </button>
        </div>

      </div>
    </div>
  );
}