"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getPickResult } from '@/lib/scoring';
import { Circle, Lock, Scale } from 'lucide-react';

export default function SpyLockerRoom({ targetUserId, targetNickname, userColor, gamesByWeek, teamsMap, myGuesses, rules }: any) {
  const [theirGuesses, setTheirGuesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [spyPhase, setSpyPhase] = useState<'regular' | 'playoffs'>('regular');
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  
  const supabase = createClient();
  const playoffNames: Record<string, string> = { 'WC': 'Wild Card', 'DR': 'Divisional', 'CC': 'Conference', 'SB': 'Super Bowl' };

  useEffect(() => {
    async function fetchPicks() {
      setLoading(true);
      const { data } = await supabase.rpc('get_masked_guesses', { p_user_id: targetUserId });
      setTheirGuesses(data || []);
      const regularWeeks = Object.keys(gamesByWeek).filter(w => !isNaN(Number(w))).sort((a, b) => Number(a) - Number(b));
      const activeWeek = regularWeeks.find(w => !gamesByWeek[w].every((g: any) => g.status === 'finished')) || regularWeeks[regularWeeks.length - 1];
      setExpandedWeek(activeWeek);
      setLoading(false);
    }
    fetchPicks();
  }, [targetUserId, gamesByWeek, supabase]);

  const displayWeeks = spyPhase === 'regular' 
    ? Object.keys(gamesByWeek).filter(w => !isNaN(Number(w))).sort((a, b) => Number(a) - Number(b)) 
    : Object.keys(gamesByWeek).filter(w => isNaN(Number(w))).sort((a, b) => ['WC', 'DR', 'CC', 'SB'].indexOf(a) - ['WC', 'DR', 'CC', 'SB'].indexOf(b));

  return (
    <tr>
      <td colSpan={4} className="p-0 border-b border-white/5 bg-[#050505]/95 backdrop-blur-2xl shadow-inner relative z-0">
        <div className="animate-fadeIn p-4 sm:p-6 border-l-4 border-l-white/10" style={{ borderLeftColor: userColor }}>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-2 pb-5 gap-4 border-b border-white/5 mb-4">
            <div>
              <h4 className="font-jersey text-2xl sm:text-3xl uppercase tracking-widest text-white drop-shadow-md">{targetNickname}'S <span style={{ color: userColor }}>LOCKER</span></h4>
              {rules && <p className="font-sans text-[9px] text-gray-500 font-black uppercase tracking-widest mt-1">Applying Custom League Points</p>}
            </div>
            
            <div className="flex bg-black/60 border border-white/10 rounded-xl p-1.5 w-full sm:w-auto shadow-inner">
              <button 
                onClick={() => setSpyPhase('regular')} 
                className={`flex-1 sm:flex-none px-4 py-2 font-sans text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-sm ${spyPhase === 'regular' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-white hover:bg-white/[0.02]'}`} 
                style={spyPhase === 'regular' ? { color: userColor } : {}}
              >
                Regular Season
              </button>
              <button 
                onClick={() => setSpyPhase('playoffs')} 
                className={`flex-1 sm:flex-none px-4 py-2 font-sans text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-sm ${spyPhase === 'playoffs' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-white hover:bg-white/[0.02]'}`} 
                style={spyPhase === 'playoffs' ? { color: userColor } : {}}
              >
                Playoffs
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
               <div className="w-8 h-8 border-4 border-gray-800 border-t-white rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {displayWeeks.length === 0 ? (
                <div className="text-center py-8 font-sans text-[10px] font-black text-gray-600 uppercase tracking-widest border border-white/5 rounded-2xl border-dashed bg-black/20">
                  No picks recorded for this phase.
                </div>
              ) : (
                displayWeeks.map(week => {
                  const isWeekOpen = expandedWeek === week;
                  const weekGames = gamesByWeek[week];
                  
                  return (
                    <div key={week} className={`rounded-2xl border overflow-hidden transition-all shadow-lg ${isWeekOpen ? 'bg-black/60 border-white/10 backdrop-blur-md' : 'border-white/5 bg-black/40'}`}>
                      <button 
                        onClick={() => setExpandedWeek(isWeekOpen ? null : week)} 
                        className="w-full flex justify-between items-center p-4 sm:p-5 transition-colors text-left border-b border-transparent bg-black/40 hover:bg-white/[0.02]"
                        style={isWeekOpen ? { borderBottomColor: 'rgba(255,255,255,0.05)' } : {}}
                      >
                        <span className="font-jersey text-xl sm:text-2xl uppercase tracking-widest pt-1" style={{ color: isWeekOpen ? userColor : '#ffffff' }}>
                          {spyPhase === 'playoffs' ? (playoffNames[week] || week) : `Week ${week}`}
                        </span>
                        <span className="text-gray-500 font-bold text-lg shrink-0">{isWeekOpen ? '▼' : '▶'}</span>
                      </button>

                      {isWeekOpen && (
                        <div className="p-4 sm:p-5 bg-black/20 animate-fadeIn shadow-inner">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {weekGames.map((game: any) => {
                              const theirGuess = theirGuesses.find(g => g.game_id === game.id);
                              const myGuess = myGuesses.find((g: any) => g.game_id === game.id);
                              
                              const awayTeam = teamsMap[game.away_team_id?.toString()];
                              const homeTeam = teamsMap[game.home_team_id?.toString()];
                              
                              const showScore = game.status === 'finished' || game.status === 'in_progress';
                              const theirResult = getPickResult(game, theirGuess, rules);
                              const myResult = getPickResult(game, myGuess, rules);

                              // Lógica de Ocultação (Spy Lock) - 10 minutos antes do jogo
                              const gameTimeMs = new Date(game.game_time).getTime();
                              const nowMs = new Date().getTime();
                              const isRevealed = (gameTimeMs - nowMs) <= 10 * 60 * 1000;

                              let pickedLogoTheir = null;
                              if (theirGuess) {
                                if (theirGuess.away_guess > theirGuess.home_guess) pickedLogoTheir = awayTeam?.logo;
                                else if (theirGuess.home_guess > theirGuess.away_guess) pickedLogoTheir = homeTeam?.logo;
                              }

                              return (
                                <div key={game.id} className={`rounded-2xl bg-black/60 overflow-hidden flex flex-col h-full shadow-xl transition-all ${game.status === 'finished' ? 'border border-white/10' : 'border border-white/5'}`}>
                                  
                                  <div className="px-4 pt-3 pb-2 border-b border-white/5 bg-black/80 flex items-center justify-between shadow-inner">
                                    <span className="font-sans text-[9px] text-gray-400 font-black uppercase tracking-widest leading-none truncate">
                                      {new Date(game.game_time).toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' })} • {new Date(game.game_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                    {game.status === 'finished' ? (
                                      <span className="font-sans text-[8px] font-black uppercase tracking-widest text-green-500 border border-green-500/20 bg-green-500/10 px-1.5 py-0.5 rounded shadow-sm">Final</span>
                                    ) : game.status === 'in_progress' ? (
                                      <span className="font-sans text-[8px] font-black uppercase tracking-widest text-red-500 border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 rounded shadow-sm animate-pulse flex items-center gap-1"><Circle size={6} fill="currentColor"/> Live</span>
                                    ) : (
                                      <span className="font-sans text-[8px] font-bold uppercase tracking-widest text-gray-500 border border-white/5 bg-white/5 px-1.5 py-0.5 rounded">Pending</span>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between p-4 bg-black/40 border-b border-white/5 gap-2">
                                    <div className="flex items-center gap-3 w-full">
                                      {awayTeam?.logo && <img src={awayTeam.logo} className="w-6 h-6 sm:w-8 sm:h-8 object-contain drop-shadow-md shrink-0" alt="" />}
                                      <div className="flex-1 flex flex-col items-start min-w-0">
                                        <span className="font-sport font-bold text-xs sm:text-sm text-gray-300 uppercase tracking-wider truncate w-full" style={{color: awayTeam?.color}}>{awayTeam?.abbr}</span>
                                        <span className={`font-jersey text-xl sm:text-2xl leading-none pt-1 ${showScore ? 'text-white' : 'text-gray-600'}`}>{showScore ? game.away_score : '-'}</span>
                                      </div>
                                      
                                      <span className="font-sans text-[10px] font-black text-gray-600 px-1 shrink-0">VS</span>
                                      
                                      <div className="flex-1 flex flex-col items-end min-w-0">
                                        <span className="font-sport font-bold text-xs sm:text-sm text-gray-300 uppercase tracking-wider truncate w-full text-right" style={{color: homeTeam?.color}}>{homeTeam?.abbr}</span>
                                        <span className={`font-jersey text-xl sm:text-2xl leading-none pt-1 ${showScore ? 'text-white' : 'text-gray-600'}`}>{showScore ? game.home_score : '-'}</span>
                                      </div>
                                      {homeTeam?.logo && <img src={homeTeam.logo} className="w-6 h-6 sm:w-8 sm:h-8 object-contain drop-shadow-md shrink-0" alt="" />}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 divide-x divide-white/5 grow">
                                    <div className={`p-4 flex flex-col items-center justify-center transition-colors ${showScore ? theirResult.colorClass : 'bg-transparent'}`}>
                                      <span className="font-sans text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5 truncate w-full text-center" title={targetNickname}>{targetNickname}</span>
                                      
                                      {isRevealed ? (
                                        <>
                                          <span className={`font-jersey text-xl sm:text-2xl leading-none pt-1 ${theirGuess ? 'text-white drop-shadow-md' : 'text-gray-600'}`}>{theirGuess ? `${theirGuess.away_guess} - ${theirGuess.home_guess}` : 'N/A'}</span>
                                          {showScore && theirGuess && <span className={`font-sans text-[9px] font-black uppercase tracking-widest mt-2 ${theirResult.textClass}`}>{theirResult.points} PTS {game.status === 'in_progress' && '(Proj)'}</span>}
                                        </>
                                      ) : (
                                        <>
                                          <div className="flex items-center justify-center mt-1 mb-1.5">
                                            {pickedLogoTheir ? <img src={pickedLogoTheir} className="w-6 h-6 object-contain drop-shadow-md" alt="Pick" /> : <Scale size={16} className="text-gray-600" />}
                                          </div>
                                          <span className="font-sans text-[8px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1"><Lock size={10} /> Hidden Score</span>
                                        </>
                                      )}
                                    </div>

                                    <div className={`p-4 flex flex-col items-center justify-center transition-colors ${showScore ? myResult.colorClass : 'bg-transparent'}`}>
                                      <span className="font-sans text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5 truncate w-full text-center">You</span>
                                      <span className={`font-jersey text-xl sm:text-2xl leading-none pt-1 ${myGuess ? 'text-white drop-shadow-md' : 'text-gray-600'}`}>{myGuess ? `${myGuess.away_guess} - ${myGuess.home_guess}` : 'N/A'}</span>
                                      {showScore && myGuess && <span className={`font-sans text-[9px] font-black uppercase tracking-widest mt-2 ${myResult.textClass}`}>{myResult.points} PTS {game.status === 'in_progress' && '(Proj)'}</span>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}