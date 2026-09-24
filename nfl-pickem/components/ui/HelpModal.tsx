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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Cabeçalho do Modal */}
        <div className="flex justify-between items-center p-5 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <HelpCircle size={22} style={{ color: accentColor }} />
            <h2 className="text-lg font-black italic uppercase tracking-wider text-white">How to Play & Rules</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo das Regras (Com scroll interno) */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-300">
          
          {/* Seção 1: Sistema de Pontuação */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2" style={{ color: accentColor }}>
              <Trophy size={16} /> Scoring System (Picks)
            </h3>
            <p className="text-xs leading-relaxed text-gray-400">
              Your goal is to predict the exact scores or outcomes of the NFL games each week. Points are awarded based on accuracy after each game finishes:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col items-center text-center">
                <span className="text-xl font-black text-green-400 mb-1">7 PTS</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white">Exact Score</span>
                <span className="text-[9px] text-gray-500 mt-1">You nailed both home and away scores perfectly.</span>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col items-center text-center">
                <span className="text-xl font-black text-blue-400 mb-1">5 PTS</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white">Correct Margin</span>
                <span className="text-[9px] text-gray-500 mt-1">Winner correct + exact score difference.</span>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col items-center text-center">
                <span className="text-xl font-black text-amber-400 mb-1">3 PTS</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white">Correct Winner</span>
                <span className="text-[9px] text-gray-500 mt-1">You picked the right winner, but wrong scoreline.</span>
              </div>
            </div>
          </div>

          {/* Seção 2: Prazos e Fechamento */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2" style={{ color: accentColor }}>
              <AlertCircle size={16} /> Deadlines & Locking
            </h3>
            <p className="text-xs leading-relaxed text-gray-400">
              Picks lock automatically <strong>15 minutes before</strong> each individual game kicks off. Make sure to save your predictions ahead of time! If a game starts, editing is disabled.
            </p>
          </div>

          {/* Seção 3: Regra do 1 Ponto (Scorigami) */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2" style={{ color: accentColor }}>
              <AlertCircle size={16} /> NFL Scoring Rules
            </h3>
            <p className="text-xs leading-relaxed text-gray-400">
              The app validates NFL scores automatically. In American football, a final score where a team has exactly <strong>1 point</strong> is virtually impossible (due to safety rules). The app will warn you if an invalid score combination is entered.
            </p>
          </div>

        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white transition hover:opacity-90"
            style={{ backgroundColor: accentColor }}
          >
            Got It
          </button>
        </div>

      </div>
    </div>
  );
}