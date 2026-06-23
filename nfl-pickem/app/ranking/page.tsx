"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import { createClient } from '../../utils/supabase/client';
import { getThemeColor } from '../../utils/theme';
import LoadingScreen from '@/components/ui/LoadingScreen';

// 1. ATUALIZADA: Agora sabe se o ponto é oficial ou uma projeção ao vivo
function getPickResult(game: any, guess: any) {
  if (!game || !guess || game.home_score === null || game.away_score === null) {
    return { points: 0, isProjected: false, colorClass: 'bg-transparent', textClass: 'text-gray-500' };
  }

  const isLive = game.status === 'in_progress';
  const realDiff = game.home_score - game.away_score;
  const predDiff = guess.home_guess - guess.away_guess;
  const realWinner = realDiff > 0 ? 'home' : realDiff < 0 ? 'away' : 'tie';
  const predWinner = predDiff > 0 ? 'home' : predDiff < 0 ? 'away' : 'tie';

  let points = 0;
  let colorClass = '';
  let textClass = '';

  if (game.home_score === guess.home_guess && game.away_score === guess.away_guess) {
    points = 7;
    colorClass = isLive ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-500/20';
    textClass = 'text-green-400';
  } else if (realWinner === predWinner && realWinner !== 'tie') {
    if (realDiff === predDiff) {
      points = 5;
      colorClass = isLive ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-500/20';
      textClass = 'text-blue-400';
    } else {
      points = 3;
      colorClass = isLive ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-500/20';
      textClass = 'text-amber-400';
    }
  } else {
    points = 0;
    colorClass = isLive ? 'bg-red-500/5 border border-red-500/10' : 'bg-red-500/10';
    textClass = 'text-red-500';
  }

  return { points, isProjected: isLive, colorClass, textClass };
}

export default function RankingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userColor, setUserColor] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem('blitz_accent') || '#E31837';
    return '#E31837';
  });

  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myGuesses, setMyGuesses] = useState<any[]>([]);
  const [teamsMap, setTeamsMap] = useState<Record<string, any>>({});
  const [gamesByWeek, setGamesByWeek] = useState<Record<string, any[]>>({});
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedUserGuesses, setExpandedUserGuesses] = useState<any[]>([]);
  const [loadingPicks, setLoadingPicks] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [spyPhase, setSpyPhase] = useState<'regular' | 'playoffs'>('regular');
  const [hasLiveGames, setHasLiveGames] = useState(false);

  useEffect(() => {
    async function loadRankingData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setCurrentUserId(session.user.id);

      const { data: profile } = await supabase.from('profiles').select('favorite_team_id').eq('id', session.user.id).single();
      if (profile?.favorite_team_id) {
        const { data: teamInfo } = await supabase.from('teams').select('primary_color').eq('id', profile.favorite_team_id).single();
        if (teamInfo?.primary_color) {
          const neonColor = getThemeColor(teamInfo.primary_color);
          setUserColor(neonColor);
        }
      }

      const { data: teams } = await supabase.from('teams').select('*');
      const tMap: Record<string, any> = {};
      teams?.forEach(t => { tMap[t.id.toString()] = { name: t.name, abbr: t.abbreviation, logo: t.logo_url }; });
      setTeamsMap(tMap);

      const { data: games } = await supabase.from('games').select('*').order('game_time', { ascending: true });
      let isAnyGameLive = false;

      if (games) {
        isAnyGameLive = games.some(g => g.status === 'in_progress');
        setHasLiveGames(isAnyGameLive);

        const grouped = games.reduce((acc, g) => {
          let w = g.week || '1';
          if (w === 'AFCC' || w === 'NFCC') w = 'CC';
          if (!acc[w]) acc[w] = [];
          acc[w].push(g);
          return acc;
        }, {} as Record<string, any[]>);
        
        setGamesByWeek(grouped);
        const regularWeeks = Object.keys(grouped).filter(w => !isNaN(Number(w))).sort((a, b) => Number(a) - Number(b));
        const playoffOrder = ['WC', 'DR', 'CC', 'SB'];
        const playoffWeeks = Object.keys(grouped).filter(w => isNaN(Number(w))).sort((a, b) => playoffOrder.indexOf(a) - playoffOrder.indexOf(b));
        const allSortedWeeks = [...regularWeeks, ...playoffWeeks];
        const activeWeek = allSortedWeeks.find(week => !grouped[week].every((g: any) => g.status === 'finished')) || allSortedWeeks[allSortedWeeks.length - 1];
        
        setExpandedWeek(activeWeek);
        if (activeWeek && isNaN(Number(activeWeek))) setSpyPhase('playoffs');
      }

      const { data: myGuessesData } = await supabase.from('guesses').select('*').eq('user_id', session.user.id);
      if (myGuessesData) setMyGuesses(myGuessesData);

      // 2. BUSCANDO OS USUÁRIOS E RECALCULANDO PROJEÇÕES
      const { data: users } = await supabase.from('profiles').select('id, nickname, score, is_test, teams ( logo_url, abbreviation )');
      const { data: allGuesses } = await supabase.from('guesses').select('user_id, game_id, home_guess, away_guess');

      if (users && games && allGuesses) {
        const validUsers = users.filter(u => u.is_test !== true);
        
        // Mapeamos os jogos ao vivo
        const liveGames = games.filter(g => g.status === 'in_progress');

        const liveLeaderboard = validUsers.map(user => {
          let officialScore = user.score || 0;
          let projectedPoints = 0;

          // Se tiver jogo ao vivo, calculamos os pontos extras que ele está ganhando AGORA
          if (liveGames.length > 0) {
            const userLivePicks = allGuesses.filter(g => g.user_id === user.id && liveGames.some(lg => lg.id === g.game_id));
            userLivePicks.forEach(pick => {
              const game = liveGames.find(lg => lg.id === pick.game_id);
              const result = getPickResult(game, pick);
              projectedPoints += result.points;
            });
          }

          return {
            ...user,
            officialScore,
            projectedPoints,
            totalScore: officialScore + projectedPoints // O Total Dita a Posição Real-Time!
          };
        });

        // Ordenamos pelo Total (Oficial + Projetado)
        liveLeaderboard.sort((a, b) => b.totalScore - a.totalScore);
        setLeaderboard(liveLeaderboard);
      }
      
      setLoading(false);
    }
    
    loadRankingData();
  }, [router, supabase]);

  const toggleUserPicks = async (userId: string) => {
    if (expandedUserId === userId) { setExpandedUserId(null); return; }
    setExpandedUserId(userId);
    setLoadingPicks(true);
    const { data: guesses } = await supabase.from('guesses').select('*').eq('user_id', userId);
    setExpandedUserGuesses(guesses || []);
    setLoadingPicks(false);
  };

  if (loading) return <LoadingScreen />;

  const displayWeeks = spyPhase === 'regular' 
    ? Object.keys(gamesByWeek).filter(w => !isNaN(Number(w))).sort((a, b) => Number(a) - Number(b)) 
    : Object.keys(gamesByWeek).filter(w => isNaN(Number(w))).sort((a, b) => ['WC', 'DR', 'CC', 'SB'].indexOf(a) - ['WC', 'DR', 'CC', 'SB'].indexOf(b));

  const playoffNames: Record<string, string> = { 'WC': 'Wild Card Weekend', 'DR': 'Divisional Round', 'CC': 'Conference Championship', 'SB': 'Super Bowl' };

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32">
      <Header />
      
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 mt-4">
        
        <div className="border-b border-white/10 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-wider">
              Leader<span style={{ color: userColor, textShadow: `0 0 15px ${userColor}80` }}>board</span>
            </h1>
            <p className="text-gray-400 mt-1 font-medium text-xs sm:text-sm">Global rankings. Click a player to compare your picks with theirs.</p>
          </div>
          
          {/* SINALIZADOR DE JOGOS AO VIVO */}
          {hasLiveGames && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-full animate-pulse">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Live Projections</span>
            </div>
          )}
        </div>

        <div className="bg-neutral-900/50 rounded-xl border border-white/5 overflow-hidden shadow-lg animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-gray-500 uppercase tracking-widest bg-black/40 border-b border-white/5">
                  <th className="px-4 py-3 font-bold w-12 text-center">Pos</th>
                  <th className="px-4 py-3 font-bold">Player</th>
                  <th className="px-4 py-3 font-bold text-center w-24">Score</th>
                  <th className="px-4 py-3 font-bold text-right w-24">Spy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((user, index) => {
                  const isCurrentUser = user.id === currentUserId;
                  const isExpanded = expandedUserId === user.id;
                  const positionColor = index === 0 ? 'text-yellow-500 drop-shadow-md' : index === 1 ? 'text-gray-300 drop-shadow-md' : index === 2 ? 'text-amber-700 drop-shadow-md' : 'text-gray-600';

                  return (
                    <React.Fragment key={user.id}>
                      <tr 
                        onClick={() => !isCurrentUser && toggleUserPicks(user.id)}
                        className={`transition-colors ${!isCurrentUser ? 'cursor-pointer hover:bg-white/[0.05]' : ''} ${isCurrentUser ? 'bg-white/5' : ''} ${isExpanded ? 'bg-black/40' : ''}`}
                      >
                        <td className="px-4 py-4 text-center"><span className={`text-sm font-black ${positionColor}`}>{index + 1}</span></td>
                        
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex justify-center">
                             {user.teams?.logo_url ? <img src={user.teams.logo_url} alt="" className="w-6 h-6 sm:w-8 sm:h-8 object-contain" /> : <span className="text-xs font-bold text-gray-600">-</span>}
                           </div>
                            <span className={`font-bold text-sm ${isCurrentUser ? 'text-white' : 'text-gray-300'}`}>{user.nickname}</span>
                          </div>
                        </td>
                        
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            {/* SCORE TOTAL (Se tiver jogo ao vivo, vira Verde/Azul com os pontos projetados embutidos) */}
                            <span className={`font-black text-base sm:text-lg ${user.projectedPoints > 0 ? 'text-green-400 animate-pulse' : 'text-white'}`}>
                              {user.totalScore}
                            </span>
                            
                            {/* MOSTRA O QUE É PROJEÇÃO */}
                            {user.projectedPoints > 0 && (
                              <span className="text-[8px] font-black uppercase tracking-widest text-green-500/70">
                                +{user.projectedPoints} Proj
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-4 py-4">
                           <div className="flex justify-end">
                             {!isCurrentUser && (
                                <button className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded transition-all hover:scale-105" style={{ backgroundColor: `${userColor}20`, color: userColor }}>
                                  {isExpanded ? 'Hide' : 'Spy'} {isExpanded ? '▲' : '👁️'}
                                </button>
                              )}
                           </div>
                        </td>
                      </tr>

                      {/* LOCKER ROOM (SPY) - Onde os cards também recebem o visual LIVE */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={4} className="p-0 border-b border-white/5 bg-black/80">
                            <div className="animate-fadeIn p-2 sm:p-4">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-2 py-3 gap-3">
                                <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest text-white">{user.nickname}'s Locker Room</h4>
                                <div className="flex bg-black border border-white/10 rounded-lg p-1 w-full sm:w-auto">
                                  <button onClick={(e) => { e.stopPropagation(); setSpyPhase('regular'); }} className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${spyPhase === 'regular' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`} style={spyPhase === 'regular' ? { color: userColor } : {}}>Regular Season</button>
                                  <button onClick={(e) => { e.stopPropagation(); setSpyPhase('playoffs'); }} className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${spyPhase === 'playoffs' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`} style={spyPhase === 'playoffs' ? { color: userColor } : {}}>Playoffs</button>
                                </div>
                              </div>

                              {loadingPicks ? (
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
                                          <button onClick={(e) => { e.stopPropagation(); setExpandedWeek(isWeekOpen ? null : week); }} className="w-full flex justify-between items-center p-3 sm:p-4 transition text-left border-b border-white/5 bg-neutral-900 hover:bg-neutral-800">
                                            <span className="font-black text-sm uppercase tracking-widest" style={{ color: isWeekOpen ? userColor : '#ffffff' }}>{spyPhase === 'playoffs' ? (playoffNames[week] || week) : `Week ${week}`}</span>
                                            <span className="text-gray-500 text-xs font-bold shrink-0">{isWeekOpen ? '▲' : '▼'}</span>
                                          </button>

                                          {isWeekOpen && (
                                            <div className="p-3 bg-black/20 animate-fadeIn">
                                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                                {weekGames.map(game => {
                                                  const theirGuess = expandedUserGuesses.find(g => g.game_id === game.id);
                                                  const myGuess = myGuesses.find(g => g.game_id === game.id);
                                                  const awayTeam = teamsMap[game.away_team_id];
                                                  const homeTeam = teamsMap[game.home_team_id];
                                                  
                                                  const isFinished = game.status === 'finished';
                                                  const isLive = game.status === 'in_progress';
                                                  const showScore = isFinished || isLive;

                                                  const theirResult = getPickResult(game, theirGuess);
                                                  const myResult = getPickResult(game, myGuess);

                                                  return (
                                                    <div key={game.id} className="border border-white/10 hover:border-white/20 rounded-[12px] bg-neutral-950 overflow-hidden flex flex-col h-full">
                                                      <div className="p-2 sm:p-3 border-b border-white/5 bg-neutral-900/80 flex justify-between items-center gap-2">
                                                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-none truncate">
                                                          {new Date(game.game_time).toLocaleDateString("en-US", { month: 'short', day: 'numeric' })}
                                                        </span>
                                                        <div className="shrink-0 ml-2">
                                                          {isFinished ? (
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-green-500">Final</span>
                                                          ) : isLive ? (
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-red-500 animate-pulse">🔴 Live {game.clock || ''}</span>
                                                          ) : (
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Upcoming</span>
                                                          )}
                                                        </div>
                                                      </div>

                                                      <div className="flex justify-between items-center p-3 bg-black/40 border-b border-white/5">
                                                        <div className="flex items-center gap-2">
                                                          {awayTeam?.logo ? <img src={awayTeam.logo} className="w-5 h-5 object-contain" alt="" /> : <span className="text-[10px] font-black uppercase text-white">{awayTeam?.abbr}</span>}
                                                          <span className="text-[10px] font-black text-gray-500">@</span>
                                                          {homeTeam?.logo ? <img src={homeTeam.logo} className="w-5 h-5 object-contain" alt="" /> : <span className="text-[10px] font-black uppercase text-white">{homeTeam?.abbr}</span>}
                                                        </div>
                                                        <div className="flex flex-col items-end shrink-0 ml-2">
                                                          {showScore ? (
                                                            <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 border rounded text-white ${isLive ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
                                                              {game.away_score} - {game.home_score}
                                                            </span>
                                                          ) : (
                                                            <span className="text-[9px] font-bold text-gray-500 tracking-widest">{new Date(game.game_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                                                          )}
                                                        </div>
                                                      </div>

                                                      <div className="grid grid-cols-2 divide-x divide-white/5 grow">
                                                        <div className={`p-3 flex flex-col items-center justify-center transition-colors ${showScore ? theirResult.colorClass : 'bg-transparent'}`}>
                                                          <span className="text-[8px] uppercase font-bold text-gray-500 tracking-widest mb-1 truncate w-full text-center">{user.nickname}</span>
                                                          <span className={`font-black text-sm ${theirGuess ? 'text-white' : 'text-gray-600'}`}>{theirGuess ? `${theirGuess.away_guess} - ${theirGuess.home_guess}` : 'N/A'}</span>
                                                          {showScore && theirGuess && <span className={`text-[9px] font-black uppercase mt-1 ${theirResult.textClass}`}>{theirResult.points} PTS {isLive && '(Proj)'}</span>}
                                                        </div>

                                                        <div className={`p-3 flex flex-col items-center justify-center transition-colors ${showScore ? myResult.colorClass : 'bg-transparent'}`}>
                                                          <span className="text-[8px] uppercase font-bold text-gray-500 tracking-widest mb-1 truncate w-full text-center">You</span>
                                                          <span className={`font-black text-sm ${myGuess ? 'text-white' : 'text-gray-600'}`}>{myGuess ? `${myGuess.away_guess} - ${myGuess.home_guess}` : 'N/A'}</span>
                                                          {showScore && myGuess && <span className={`text-[9px] font-black uppercase mt-1 ${myResult.textClass}`}>{myResult.points} PTS {isLive && '(Proj)'}</span>}
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
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}