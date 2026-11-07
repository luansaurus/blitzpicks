"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/header';
import GameCard from '@/components/scoreboard/GameCard';
import { createClient } from '@/lib/supabase/client';
import { Calendar, Save, CheckCircle2, XCircle } from 'lucide-react';
import { PLAYOFF_NAMES, PLAYOFF_ORDER } from '@/lib/constants/playoffs';

interface PicksClientProps {
  currentUserId: string;
  initialColor: string;
  initialBg: string;
  initialSec: string;
  teamsMap: Record<string, any>;
  gamesByWeek: Record<string, any[]>;
  myGuesses: any[];
  regularWeeks: string[];
  playoffWeeks: string[];
  currentActiveWeek: string | null;
}

export default function PicksClient({
  currentUserId, initialColor, initialBg, initialSec, teamsMap,
  gamesByWeek, myGuesses, regularWeeks, playoffWeeks, currentActiveWeek
}: PicksClientProps) {
  
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'regular' | 'playoffs'>(
    currentActiveWeek && PLAYOFF_ORDER.includes(currentActiveWeek) ? 'playoffs' : 'regular'
  );
  
  const [expandedWeek, setExpandedWeek] = useState<string | null>(currentActiveWeek);
  
  // Estado para os palpites não salvos (rascunhos)
  const [draftGuesses, setDraftGuesses] = useState<Record<string, { home_guess: number | null, away_guess: number | null }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const [userColor, setUserColor] = useState(initialColor);
  const [ambientPrimary, setAmbientPrimary] = useState(initialBg);
  const [ambientSecondary, setAmbientSecondary] = useState(initialSec);

  useEffect(() => {
    const savedAccent = localStorage.getItem('blitz_accent');
    const savedBg = localStorage.getItem('blitz_header_bg');
    const savedSec = localStorage.getItem('blitz_header_sec');
    
    if (savedAccent && savedAccent !== initialColor) setUserColor(savedAccent);
    if (savedBg && savedBg !== initialBg) setAmbientPrimary(savedBg);
    if (savedSec && savedSec !== initialSec) setAmbientSecondary(savedSec);
  }, [initialColor, initialBg, initialSec]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleScoreChange = (gameId: string, home: number | null, away: number | null) => {
    const existingGuess = myGuesses.find(g => g.game_id.toString() === gameId);
    
    // Se o valor digitado for igual ao que já está no banco, remove do rascunho
    if (existingGuess && existingGuess.home_guess === home && existingGuess.away_guess === away) {
      setDraftGuesses(prev => {
        const next = { ...prev };
        delete next[gameId];
        return next;
      });
      return;
    }

    setDraftGuesses(prev => ({
      ...prev,
      [gameId]: { home_guess: home, away_guess: away }
    }));
  };

  const handleSavePicks = async () => {
    setIsSaving(true);
    
    const upserts = Object.entries(draftGuesses).map(([gameId, scores]) => {
      // Pega o ID existente se for uma atualização
      const existingId = myGuesses.find(g => g.game_id.toString() === gameId)?.id;
      
      const payload: any = {
        user_id: currentUserId,
        game_id: parseInt(gameId),
        home_guess: scores.home_guess,
        away_guess: scores.away_guess,
        updated_at: new Date().toISOString()
      };

      if (existingId) payload.id = existingId;
      return payload;
    });

    try {
      const { error } = await supabase.from('guesses').upsert(upserts);
      if (error) throw error;
      
      setDraftGuesses({});
      showToast("Picks saved successfully!", "success");
      router.refresh(); // Atualiza os dados do Server Component
    } catch (error) {
      showToast("Sync Failed. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const renderWeekBlock = (week: string) => {
    const isOpen = expandedWeek === week;
    const weekGames = gamesByWeek[week] || [];
    const isCurrentWeek = week === currentActiveWeek;
    const isFinished = weekGames.length > 0 && weekGames.every(g => g.status === 'finished');
    const isPlayoffWeek = PLAYOFF_ORDER.includes(week);
    const weekTitle = isPlayoffWeek ? PLAYOFF_NAMES[week] : `Week ${week}`;

    return (
      <div key={week} className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl transition-all">
        <button 
          onClick={() => setExpandedWeek(isOpen ? null : week)} 
          className="w-full flex justify-between items-center p-4 sm:p-5 hover:bg-white/[0.03] transition-colors text-left border-b border-transparent relative z-10"
          style={isOpen ? { borderBottomColor: 'rgba(255,255,255,0.05)' } : {}}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <Calendar size={20} className={isPlayoffWeek ? 'text-amber-500' : 'text-gray-400'} />
            <span className={`font-jersey text-2xl sm:text-3xl uppercase tracking-widest leading-none pt-1 ${isPlayoffWeek ? 'text-amber-500 drop-shadow-md' : 'text-white'}`}>
              {weekTitle}
            </span>
            
            {isCurrentWeek ? (
              <span className="hidden sm:inline-flex items-center text-[9px] uppercase font-black px-2 py-0.5 bg-red-500/10 text-red-500 rounded border border-red-500/30 tracking-widest animate-pulse ml-2 shadow-inner">Current Week</span>
            ) : isFinished ? (
              <span className="hidden sm:inline-flex items-center text-[9px] uppercase font-black px-2 py-0.5 bg-white/5 text-gray-500 rounded border border-white/5 tracking-widest ml-2">Finished</span>
            ) : (
              <span className="hidden sm:inline-flex items-center text-[9px] uppercase font-black px-2 py-0.5 bg-white/5 text-gray-400 rounded border border-white/5 tracking-widest ml-2">Upcoming</span>
            )}
          </div>
          <span className="text-gray-500 font-bold text-lg">{isOpen ? '▼' : '▶'}</span>
        </button>

        {isOpen && (
          <div className="bg-black/20 p-4 sm:p-6 shadow-inner animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {weekGames.map(game => {
                const homeTeam = teamsMap[game.home_team_id];
                const awayTeam = teamsMap[game.away_team_id];
                
                // Pega o palpite salvo do servidor ou o palpite temporário do draft
                const savedGuess = myGuesses.find(g => g.game_id === game.id);
                const draft = draftGuesses[game.id.toString()];
                
                const displayGuess = draft || savedGuess || null;

                return (
                  <div key={game.id} className="relative group transition-transform hover:scale-[1.02]">
                    <GameCard 
                      game={game}
                      userTeamColor={userColor}
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                      existingPick={displayGuess as any}
                      onPickChange={(gId, hStr, aStr) => {
                        const parsedHome = hStr === "" ? null : parseInt(hStr);
                        const parsedAway = aStr === "" ? null : parseInt(aStr);
                        handleScoreChange(gId.toString(), parsedHome, parsedAway);
                      }}
                      isUnsaved={!!draft}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const draftCount = Object.keys(draftGuesses).length;

  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans pb-32 sm:pb-48 relative overflow-hidden">
      
      <div 
        className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[150px] opacity-30 pointer-events-none z-0 transition-colors duration-1000"
        style={{ backgroundColor: ambientPrimary }}
      />
      <div 
        className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full blur-[150px] opacity-20 pointer-events-none z-0 transition-colors duration-1000"
        style={{ backgroundColor: ambientSecondary }}
      />
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-20 mix-blend-overlay"
        style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)' }}
      />

      <div className="relative z-10">
        <Header />
        
        {toast && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[99999] animate-slideDown">
            <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-xl border ${
              toast.type === 'success' ? 'bg-[#10b981]/20 border-[#10b981]/50 text-[#10b981]' : 
              'bg-[#ef4444]/20 border-[#ef4444]/50 text-[#ef4444]'
            }`}>
              <span className="text-lg">
                {toast.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              </span>
              <span className="font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest">
                {toast.message}
              </span>
            </div>
          </div>
        )}

        <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-6 mt-4">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-6">
            <div>
              <h1 className="font-jersey text-4xl sm:text-5xl tracking-widest text-white uppercase mb-1 drop-shadow-md">
                MAKE YOUR <span style={{ color: ambientSecondary, textShadow: `0 0 15px ${ambientSecondary}80` }} className="transition-colors duration-500">PICKS</span>
              </h1>
              <p className="text-gray-400 font-sans text-xs sm:text-sm font-bold uppercase tracking-widest">Predict the exact score of every game.</p>
            </div>
            
            <div className="flex bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 w-full md:w-auto min-w-[280px] shadow-xl">
              <button 
                onClick={() => { setActiveTab('regular'); setExpandedWeek(regularWeeks[regularWeeks.length - 1]); }} 
                className={`flex-1 px-4 py-3 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'regular' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`} 
                style={activeTab === 'regular' ? { color: ambientSecondary, boxShadow: `inset 0 -4px 0 ${ambientSecondary}` } : {}}
              >
                Regular Season
              </button>
              <button 
                onClick={() => { setActiveTab('playoffs'); setExpandedWeek(playoffWeeks.length > 0 ? playoffWeeks[0] : null); }} 
                className={`flex-1 px-4 py-3 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'playoffs' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`} 
                style={activeTab === 'playoffs' ? { color: ambientSecondary, boxShadow: `inset 0 -4px 0 ${ambientSecondary}` } : {}}
              >
                Playoffs
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {activeTab === 'regular' 
              ? regularWeeks.map(renderWeekBlock)
              : playoffWeeks.map(renderWeekBlock)
            }
          </div>
        </div>
      </div>

      {draftCount > 0 && (
        <div 
          className="fixed bottom-20 sm:bottom-12 left-1/2 -translate-x-1/2 w-[90%] max-w-md animate-slideUp"
          style={{ zIndex: 90 }}
        >
          <div 
            className="bg-black/95 backdrop-blur-3xl border-t-4 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-all duration-300 shadow-[0_25px_60px_rgba(0,0,0,0.9)]" 
            style={{ borderTopColor: userColor }}
          >
            <div className="flex flex-col gap-1 pl-2">
              <span className="font-sans text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white/50">
                Unsaved Changes
              </span>
              <span className="font-sport font-bold text-base sm:text-lg text-white uppercase tracking-wider drop-shadow-md">
                {draftCount} pending {draftCount === 1 ? 'pick' : 'picks'}
              </span>
            </div>
            <button 
              onClick={handleSavePicks} 
              disabled={isSaving} 
              className="px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl font-sport font-bold text-base sm:text-lg uppercase tracking-wider transition-all shadow-xl hover:scale-105 disabled:opacity-50 text-black flex items-center justify-center min-w-[110px]" 
              style={{ backgroundColor: userColor, boxShadow: `0 0 20px ${userColor}50` }}
            >
              <Save size={16} className="mr-2" />
              {isSaving ? 'SAVING...' : 'SAVE PICKS'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}