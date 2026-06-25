"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getPickResult } from '@/utils/scoring';

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
      const { data } = await supabase.from('guesses').select('*').eq('user_id', targetUserId);
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
      <td colSpan={4} className="p-0 border-b border-white/5 bg-black/80">
        <div className="animate-fadeIn p-2 sm:p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-2 py-3 gap-3">
            <div>
              <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest text-white">{targetNickname}'s Locker Room</h4>
              {rules && <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">Applying Custom League Points</p>}
            </div>
            <div className="flex bg-black border border-white/10 rounded-lg p-1 w-full sm:w-auto">
              <button onClick={() => setSpyPhase('regular')} className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${spyPhase === 'regular' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`} style={spyPhase === 'regular' ? { color: userColor } : {}}>Regular Season</button>
              <button onClick={() => setSpyPhase('playoffs')} className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${spyPhase === 'playoffs' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`} style={spyPhase === 'playoffs' ? { color: userColor } : {}}>Playoffs</button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-500 font-bold uppercase tracking-widest text-xs animate-pulse">Loading data...</div>
          ) : (
            <div className="space-y-3">
              {displayWeeks.length === 0 ? (
                <div className="text-center py-6 text-gray-600 font-bold uppercase tracking-widest text-xs border border-white/5 rounded-xl border-dashed">No picks recorded for this phase.</div>
              ) : (
                displayWeeks.map(week => {
                  const isWeekOpen = expandedWeek === week;
                  const weekGames = gamesByWeek[week];
                  return (
                    <div key={week} className={`rounded-xl border overflow-hidden transition-all ${isWeekOpen ? 'bg-neutral-900/40 border-white/5 shadow-sm' : 'border-white/5 bg-transparent'}`}>
                      <button onClick={() => setExpandedWeek(isWeekOpen ? null : week)} className="w-full flex justify-between items-center p-3 sm:p-4 transition text-left border-b border-white/5 bg-neutral-900 hover:bg-neutral-800">
                        <span className="font-black text-sm uppercase tracking-widest" style={{ color: isWeekOpen ? userColor : '#ffffff' }}>{spyPhase === 'playoffs' ? (playoffNames[week] || week) : `Week ${week}`}</span>
                        <span className="text-gray-500 text-xs font-bold shrink-0">{isWeekOpen ? '▲' : '▼'}</span>
                      </button>

                      {isWeekOpen && (
                        <div className="p-3 bg-black/20 animate-fadeIn">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {weekGames.map((game: any) => {
                              const theirGuess = theirGuesses.find(g => g.game_id === game.id);
                              const myGuess = myGuesses.find((g: any) => g.game_id === game.id);
                              
                              // CORREÇÃO DOS LOGOS: Garantindo a leitura em texto (toString)
                              const awayTeam = teamsMap[game.away_team_id?.toString()];
                              const homeTeam = teamsMap[game.home_team_id?.toString()];
                              
                              const showScore = game.status === 'finished' || game.status === 'in_progress';

                              const theirResult = getPickResult(game, theirGuess, rules);
                              const myResult = getPickResult(game, myGuess, rules);

                              return (
                                <div key={game.id} className={`border border-white/10 rounded-[12px] bg-neutral-950 overflow-hidden flex flex-col h-full shadow-lg ${game.status === 'finished' ? 'border-2 border-white/20' : ''}`}>
                                  
                                  {/* INFO DE DATA */}
                                  <div className="px-3 pt-2 pb-1.5 border-b border-white/5 bg-neutral-900/80">
                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-none truncate">
                                      {new Date(game.game_time).toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' })} • {new Date(game.game_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>

                                  {/* NOVO CABEÇALHO DO JOGO: LOGOS + PLACARES + STATUS */}
                                  <div className="flex items-center justify-between p-3 bg-black/40 border-b border-white/5 gap-2">
                                    <div className="flex items-center gap-2">
                                      {awayTeam?.logo ? <img src={awayTeam.logo} className="w-6 h-6 object-contain" alt="" /> : <span className="text-[10px] font-black uppercase text-white">{awayTeam?.abbr}</span>}
                                      {showScore && <span className="text-sm font-black text-white">{game.away_score}</span>}
                                      
                                      <span className="text-[10px] font-black text-gray-500 mx-1">@</span>
                                      
                                      {showScore && <span className="text-sm font-black text-white">{game.home_score}</span>}
                                      {homeTeam?.logo ? <img src={homeTeam.logo} className="w-6 h-6 object-contain" alt="" /> : <span className="text-[10px] font-black uppercase text-white">{homeTeam?.abbr}</span>}
                                    </div>

                                    <div className="shrink-0 ml-2">
                                      {game.status === 'finished' ? (
                                        <span className="text-[8px] font-black uppercase text-green-500 border border-green-500/20 bg-green-500/10 px-1.5 py-0.5 rounded tracking-widest">Final</span>
                                      ) : game.status === 'in_progress' ? (
                                        <span className="text-[8px] font-black uppercase text-red-500 border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 rounded tracking-widest animate-pulse">Live</span>
                                      ) : (
                                        <span className="text-[8px] font-black uppercase text-gray-400 border border-gray-500/20 bg-gray-500/10 px-1.5 py-0.5 rounded tracking-widest">Pending</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 divide-x divide-white/5 grow">
                                    <div className={`p-3 flex flex-col items-center justify-center transition-colors ${showScore ? theirResult.colorClass : 'bg-transparent'}`}>
                                      <span className="text-[8px] uppercase font-bold text-gray-500 tracking-widest mb-1 truncate w-full text-center">{targetNickname}</span>
                                      <span className={`font-black text-sm ${theirGuess ? 'text-white' : 'text-gray-600'}`}>{theirGuess ? `${theirGuess.away_guess} - ${theirGuess.home_guess}` : 'N/A'}</span>
                                      {showScore && theirGuess && <span className={`text-[9px] font-black uppercase mt-1 ${theirResult.textClass}`}>{theirResult.points} PTS {game.status === 'in_progress' && '(Proj)'}</span>}
                                    </div>

                                    <div className={`p-3 flex flex-col items-center justify-center transition-colors ${showScore ? myResult.colorClass : 'bg-transparent'}`}>
                                      <span className="text-[8px] uppercase font-bold text-gray-500 tracking-widest mb-1 truncate w-full text-center">You</span>
                                      <span className={`font-black text-sm ${myGuess ? 'text-white' : 'text-gray-600'}`}>{myGuess ? `${myGuess.away_guess} - ${myGuess.home_guess}` : 'N/A'}</span>
                                      {showScore && myGuess && <span className={`text-[9px] font-black uppercase mt-1 ${myResult.textClass}`}>{myResult.points} PTS {game.status === 'in_progress' && '(Proj)'}</span>}
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