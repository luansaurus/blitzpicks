"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import { createClient } from '../../utils/supabase/client';
import { getThemeColor } from '../../utils/theme';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { getPickResult } from '@/utils/scoring';
import SpyLockerRoom from '../../components/scoreboard/SpyLockerRoom';
import { Calendar, Scale, Trophy, Eye, ChevronUp, Crown, Binoculars } from 'lucide-react';

// Constantes para os Playoffs no Spy Hub
const PLAYOFF_ORDER = ['WC', 'DR', 'CC', 'SB'];
const PLAYOFF_NAMES: Record<string, string> = {
  'WC': 'Wild Card',
  'DR': 'Divisional Round',
  'CC': 'Conference Championship',
  'SB': 'Super Bowl'
};

export default function RankingPage() {
  const router = useRouter();
  const supabase = createClient();

  // Estados Globais
  const [activeTab, setActiveTab] = useState<'ranking' | 'spy'>('ranking');
  const [userColor, setUserColor] = useState('#E31837');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [teamsMap, setTeamsMap] = useState<Record<string, any>>({});
  const [gamesByWeek, setGamesByWeek] = useState<Record<string, any[]>>({});
  
  // Estados do Ranking
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myGuesses, setMyGuesses] = useState<any[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [hasLiveGames, setHasLiveGames] = useState(false);

  // Estados do Spy Hub
  const [usersMap, setUsersMap] = useState<Record<string, { nickname: string, logoUrl: string | null }>>({});
  const [guessesByGame, setGuessesByGame] = useState<Record<string, any[]>>({});
  const [regularWeeks, setRegularWeeks] = useState<string[]>([]);
  const [playoffWeeks, setPlayoffWeeks] = useState<string[]>([]);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [currentActiveWeek, setCurrentActiveWeek] = useState<string | null>(null);

  useEffect(() => {
    async function loadGlobalData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setCurrentUserId(session.user.id);

      const { data: profile } = await supabase.from('profiles').select('favorite_team_id').eq('id', session.user.id).single();
      if (profile?.favorite_team_id) {
        const { data: teamInfo } = await supabase.from('teams').select('primary_color').eq('id', profile.favorite_team_id).single();
        if (teamInfo?.primary_color) setUserColor(getThemeColor(teamInfo.primary_color));
      } else if (typeof window !== "undefined") {
         const savedAccent = localStorage.getItem('blitz_accent');
         if (savedAccent) setUserColor(savedAccent);
      }

      const { data: teams } = await supabase.from('teams').select('*');
      const tMap: Record<string, any> = {};
      teams?.forEach(t => { tMap[t.id.toString()] = { name: t.name, abbr: t.abbreviation, logo: t.logo_url }; });
      setTeamsMap(tMap);

      const { data: users } = await supabase.from('profiles').select('id, nickname, score, global_titles, is_test, teams ( logo_url, abbreviation )');
      const { data: allGuesses } = await supabase.from('guesses').select('*');
      const { data: games } = await supabase.from('games').select('*').order('game_time', { ascending: true });

      if (users && games && allGuesses) {
        const validUsers = users.filter(u => u.is_test !== true);
        
        // --- 1. PREPARANDO DADOS DO SPY HUB ---
        const uMap: Record<string, any> = {};
        validUsers.forEach(u => { 
          uMap[u.id] = { 
  nickname: u.nickname, 
  // Acessamos o [0] pois o Supabase está retornando a lista de times favoritos
  logoUrl: Array.isArray(u.teams) ? u.teams[0]?.logo_url : (u.teams as any)?.logo_url || null 
};
        });
        setUsersMap(uMap);

        const gMap: Record<string, any[]> = {};
        allGuesses.forEach(g => {
          if (!gMap[g.game_id]) gMap[g.game_id] = [];
          gMap[g.game_id].push(g);
        });
        setGuessesByGame(gMap);

        const groupedGames = games.reduce((acc, g) => {
          let w = g.week || '1';
          if (w === 'AFCC' || w === 'NFCC') w = 'CC';
          if (!acc[w]) acc[w] = [];
          acc[w].push(g);
          return acc;
        }, {} as Record<string, any[]>);
        setGamesByWeek(groupedGames);

        const allWeeks = Object.keys(groupedGames);
        const regs = allWeeks.filter(w => !isNaN(Number(w))).sort((a, b) => Number(a) - Number(b));
        const plays = allWeeks.filter(w => isNaN(Number(w))).sort((a, b) => PLAYOFF_ORDER.indexOf(a) - PLAYOFF_ORDER.indexOf(b));
        
        setRegularWeeks(regs);
        setPlayoffWeeks(plays);

        const sortedWeeks = [...regs, ...plays];
        const activeWk = sortedWeeks.find(week => !groupedGames[week].every((g: any) => g.status === 'finished')) || sortedWeeks[sortedWeeks.length - 1];
        setCurrentActiveWeek(activeWk);
        setExpandedWeek(activeWk);

        // --- 2. PREPARANDO DADOS DO RANKING ---
        const myG = allGuesses.filter(g => g.user_id === session.user.id);
        setMyGuesses(myG);

        const liveGames = games.filter(g => g.status === 'in_progress');
        setHasLiveGames(liveGames.length > 0);

        const liveLeaderboard = validUsers.map((user: any) => {
          let officialScore = user.score || 0;
          let projectedPoints = 0;
          if (liveGames.length > 0) {
            allGuesses.filter(g => g.user_id === user.id && liveGames.some(lg => lg.id === g.game_id)).forEach(pick => {
              const game = liveGames.find(lg => lg.id === pick.game_id);
              projectedPoints += getPickResult(game, pick).points;
            });
          }
          return { ...user, officialScore, projectedPoints, totalScore: officialScore + projectedPoints };
        });
        liveLeaderboard.sort((a, b) => b.totalScore - a.totalScore);
        setLeaderboard(liveLeaderboard);
      }
      setLoading(false);
    }
    loadGlobalData();
  }, [router, supabase]);

  // Renderizador das Semanas do Spy Hub
  const renderWeekBlock = (week: string) => {
    const isOpen = expandedWeek === week;
    const weekGames = gamesByWeek[week] || [];
    const isCurrentWeek = week === currentActiveWeek;
    const isFinished = weekGames.length > 0 && weekGames.every(g => g.status === 'finished');
    const isPlayoffWeek = PLAYOFF_ORDER.includes(week);
    const weekTitle = isPlayoffWeek ? PLAYOFF_NAMES[week] : `Week ${week}`;

    return (
      <div key={week} className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden shadow-lg">
        <button 
          onClick={() => setExpandedWeek(isOpen ? null : week)} 
          className="w-full flex justify-between items-center p-4 bg-neutral-900 hover:bg-neutral-800 transition text-left border-b border-transparent"
          style={isOpen ? { borderBottomColor: 'rgba(255,255,255,0.05)' } : {}}
        >
          <div className="flex items-center gap-3">
            <Calendar size={20} />
            <span className={`font-black text-lg uppercase tracking-widest ${isPlayoffWeek ? 'text-amber-500' : 'text-white'}`}>
              {weekTitle}
            </span>
            
            {isCurrentWeek ? (
              <span className="hidden sm:inline-block text-[8px] sm:text-[9px] uppercase font-black px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded border border-red-500/30 tracking-widest animate-pulse ml-2">Current Week</span>
            ) : isFinished ? (
              <span className="hidden sm:inline-block text-[8px] sm:text-[9px] uppercase font-black px-1.5 py-0.5 bg-white/10 text-gray-400 rounded tracking-widest ml-2">Finished</span>
            ) : (
              <span className="hidden sm:inline-block text-[8px] sm:text-[9px] uppercase font-black px-1.5 py-0.5 bg-white/5 text-gray-500 rounded tracking-widest ml-2">Upcoming</span>
            )}
          </div>
          <span className="text-gray-500 font-bold text-lg">{isOpen ? '▼' : '▶'}</span>
        </button>

        {isOpen && (
          <div className="bg-neutral-950 p-3 sm:p-4 space-y-6 animate-fadeIn">
            {weekGames.map(game => {
              const awayTeam = teamsMap[game.away_team_id?.toString()];
              const homeTeam = teamsMap[game.home_team_id?.toString()];
              const hasStarted = game.status !== 'pending';
              
              const gameGuesses = guessesByGame[game.id] || [];
              
              let picksAway = 0; let picksHome = 0; let picksTie = 0;
              gameGuesses.forEach(g => {
                if (g.away_guess > g.home_guess) picksAway++;
                else if (g.home_guess > g.away_guess) picksHome++;
                else picksTie++;
              });

              // Usa o getPickResult padrão para garantir pontuação idêntica ao resto do site
              const sortedGuesses = [...gameGuesses].sort((a, b) => {
                 const ptsA = getPickResult(game, a).points;
                 const ptsB = getPickResult(game, b).points;
                 if (ptsA !== ptsB) return ptsB - ptsA;
                 const nameA = usersMap[a.user_id]?.nickname || '';
                 const nameB = usersMap[b.user_id]?.nickname || '';
                 return nameA.localeCompare(nameB);
              });

              const gDate = new Date(game.game_time);
              const formattedDate = gDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              const formattedTime = gDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

              return (
                <div key={game.id} className="rounded-lg border border-white/10 bg-neutral-900 overflow-visible shadow-md">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between p-3 bg-black/50 border-b border-white/5 gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 shrink-0 overflow-hidden">
                      <div className="flex flex-col text-left justify-center min-w-[90px] border-l-2 border-[#E31837] pl-2 sm:border-r sm:border-white/10 sm:pr-4 sm:border-l-0 shrink-0">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-0.5">{formattedDate}</span>
                        <span className="text-[10px] font-bold text-gray-500 tracking-widest leading-none mb-1">{formattedTime}</span>
                        {game.status === 'finished' ? (
                          <span className="text-[9px] font-black text-gray-500 tracking-widest leading-none">FINAL</span>
                        ) : game.status === 'in_progress' ? (
                          <span className="text-[9px] font-black text-red-500 tracking-widest animate-pulse leading-none">LIVE</span>
                        ) : (
                          <span className="text-[9px] font-bold text-gray-600 tracking-widest leading-none">PENDING</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 font-black uppercase text-sm sm:text-base truncate">
                        {awayTeam?.logo && <img src={awayTeam.logo} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0" />}
                        <span className="text-gray-300 truncate">{awayTeam?.name?.split(' ').pop() || awayTeam?.abbr}</span>
                        <span className={`ml-1 ${hasStarted ? 'text-white text-lg' : 'text-gray-600 text-lg'}`}>{hasStarted ? game.away_score : '-'}</span>
                        <span className="text-gray-600 text-[10px] mx-1 shrink-0">@</span>
                        <span className={`mr-1 ${hasStarted ? 'text-white text-lg' : 'text-gray-600 text-lg'}`}>{hasStarted ? game.home_score : '-'}</span>
                        <span className="text-gray-300 truncate">{homeTeam?.name?.split(' ').pop() || homeTeam?.abbr}</span>
                        {homeTeam?.logo && <img src={homeTeam.logo} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0" />}
                      </div>
                    </div>

                    <div className="flex items-center justify-start xl:justify-end gap-2 text-[9px] font-black tracking-widest uppercase mt-2 xl:mt-0 shrink-0">
                       <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded border border-white/5 shadow-inner">
                         <span className="text-gray-500">{awayTeam?.abbr || 'AWAY'}</span>
                         <span className="text-white text-xs">{picksAway}</span>
                       </div>
                       {picksTie > 0 && (
                         <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded border border-white/5 shadow-inner">
                           <span className="text-gray-500">TIE</span>
                           <span className="text-white text-xs">{picksTie}</span>
                         </div>
                       )}
                       <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded border border-white/5 shadow-inner">
                         <span className="text-gray-500">{homeTeam?.abbr || 'HOME'}</span>
                         <span className="text-white text-xs">{picksHome}</span>
                       </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 bg-[#050505]">
                    {sortedGuesses.length === 0 ? (
                      <div className="text-center text-[9px] font-black uppercase tracking-widest text-gray-600 py-2">
                        No predictions yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-x-4 gap-y-6 pt-3 pb-2">
                        {sortedGuesses.map((guess) => {
                          const pts = getPickResult(game, guess).points;
                          const userObj = usersMap[guess.user_id] || { nickname: 'N/A', logoUrl: null };
                          
                          let pickedLogo = null;
                          if (guess.away_guess > guess.home_guess) { pickedLogo = awayTeam?.logo; }
                          else if (guess.home_guess > guess.away_guess) { pickedLogo = homeTeam?.logo; }

                          let borderColor = "border-neutral-800";
                          let ptsColor = "text-gray-500";
                          let bgGradient = "bg-[#111111]";

                          // A pontuação só é calculada se o jogo já começou (hasStarted)
                          if (hasStarted) {
                            if (pts === 7) { borderColor = "border-[#3b82f6]/80"; ptsColor = "text-[#3b82f6]"; bgGradient = "bg-gradient-to-b from-[#3b82f6]/10 to-[#111111]"; } 
                            else if (pts >= 3) { borderColor = "border-[#10b981]/80"; ptsColor = "text-[#10b981]"; bgGradient = "bg-gradient-to-b from-[#10b981]/10 to-[#111111]";  } 
                            else { borderColor = "border-[#ef4444]/50"; ptsColor = "text-[#ef4444]"; bgGradient = "bg-gradient-to-b from-[#ef4444]/10 to-[#111111]"; } 
                          }

                          return (
                            <div key={guess.user_id} className="relative pt-3 pr-2 w-full flex justify-center"> 
                              <div className="absolute top-0 right-0 sm:-right-2 z-20 shadow-lg">
                                {pickedLogo ? (
                                  <div className="bg-[#050505] border border-neutral-700 rounded-full p-1 w-8 h-8 flex items-center justify-center shadow-xl">
                                    <img src={pickedLogo} className="w-full h-full object-contain" alt="Pick" />
                                  </div>
                                ) : (
                                  <div className="bg-[#050505] border border-neutral-700 rounded-full w-8 h-8 flex items-center justify-center shadow-xl"><Scale size={14} /></div>
                                )}
                              </div>
                              <div className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${borderColor} ${bgGradient} overflow-hidden w-full shadow-lg`}>
                                <span className="text-[11px] sm:text-xs font-black text-white truncate w-full text-center z-10 mb-1 drop-shadow-md">
                                  {userObj.nickname}
                                </span>
                                <span className={`text-[12px] font-black z-10 leading-none mb-2 ${ptsColor}`}>
                                  {hasStarted ? `+${pts} pts` : 'pending'}
                                </span>
                                <div className="flex items-center gap-2 z-10 leading-none bg-[#0a0a0a] px-3 py-2 rounded-lg border border-white/5 shadow-inner w-[90%] justify-center">
                                  <span className="text-sm font-black text-white">{guess.away_guess}</span>
                                  <span className="text-[9px] text-gray-500 font-black mt-0.5">x</span>
                                  <span className="text-sm font-black text-white">{guess.home_guess}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <LoadingScreen />;

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32">
      <Header />
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-6 mt-4">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-wider">
              Global <span style={{ color: userColor, textShadow: `0 0 15px ${userColor}80` }}>Arena</span>
            </h1>
            <p className="text-gray-400 mt-1 font-medium text-xs sm:text-sm">Compare your picks and spy on the competition.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-neutral-900 border border-white/10 rounded-xl p-1 w-full max-w-sm shrink-0">
              <button onClick={() => setActiveTab('ranking')} className={`flex-1 px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'ranking' ? 'bg-white/10 text-white' : 'text-gray-500'}`} style={activeTab === 'ranking' ? { color: userColor } : {}}><Trophy size={14} /> Leaderboard</button>
              <button onClick={() => setActiveTab('spy')} className={`flex-1 px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'spy' ? 'bg-white/10 text-white' : 'text-gray-500'}`} style={activeTab === 'spy' ? { color: userColor } : {}}><Binoculars size={14} /> Spy Hub</button>
            </div>
            
          </div>
        </div>

        {/* ================= ABA 1: RANKING GLOBAL ================= */}
        {activeTab === 'ranking' && (
          <div className="bg-neutral-900/50 rounded-xl border border-white/5 overflow-hidden shadow-lg animate-fadeIn max-w-5xl mx-auto">
            {leaderboard.length === 0 ? (
              <div className="p-10 text-center"><span className="text-gray-500 text-xs font-bold uppercase">Nobody is here yet.</span></div>
            ) : (
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
                      const positionColor = index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-700' : 'text-gray-600';

                      return (
                        <React.Fragment key={user.id}>
                          <tr onClick={() => !isCurrentUser && setExpandedUserId(isExpanded ? null : user.id)} className={`transition-colors ${!isCurrentUser ? 'cursor-pointer hover:bg-white/[0.05]' : ''} ${isCurrentUser ? 'bg-white/5' : ''} ${isExpanded ? 'bg-black/40' : ''}`}>
                            <td className="px-4 py-4 text-center"><span className={`text-sm font-black ${positionColor}`}>{index + 1}</span></td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                {user.teams && !Array.isArray(user.teams) && user.teams.logo_url ? (
  <img src={user.teams.logo_url} className="w-6 h-6 object-contain" alt="" />
) : (
  <div className="w-6 h-6 bg-white/5 rounded-full" />
)}
                                <span className={`font-bold text-sm ${isCurrentUser ? 'text-white' : 'text-gray-300'}`}>{user.nickname}</span>
                                {user.global_titles > 0 && (
                                  <span className="text-[8px] uppercase font-black px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30 tracking-widest ml-1 shrink-0 inline-flex items-center gap-1"><Crown size={9} /> x{user.global_titles}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex flex-col items-center">
                                <span className={`font-black text-base ${user.projectedPoints > 0 ? 'text-green-400 animate-pulse' : 'text-white'}`}>{user.totalScore}</span>
                                {user.projectedPoints > 0 && <span className="text-[8px] font-black uppercase text-green-500/70">+{user.projectedPoints} Proj</span>}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                               <div className="flex justify-end">
                                 {!isCurrentUser && (
                                    <button className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded transition-all" style={{ backgroundColor: `${userColor}20`, color: userColor }}>
                                      {isExpanded ? 'Hide' : 'Spy'} {isExpanded ? <ChevronUp size={12} /> : <Eye size={12} />}
                                    </button>
                                  )}
                               </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <SpyLockerRoom 
                              targetUserId={user.id} targetNickname={user.nickname} userColor={userColor} 
                              gamesByWeek={gamesByWeek} teamsMap={teamsMap} myGuesses={myGuesses} 
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= ABA 2: SPY HUB (VISÃO DE RODADAS) ================= */}
        {activeTab === 'spy' && (
          <div className="space-y-8 animate-fadeIn">
            {regularWeeks.length > 0 && (
              <div>
                <h2 className="text-lg sm:text-xl font-black italic uppercase tracking-widest text-gray-500 mb-4 px-2 border-b border-white/5 pb-2">
                  Regular Season
                </h2>
                <div className="space-y-4">
                  {regularWeeks.map(renderWeekBlock)}
                </div>
              </div>
            )}

            {playoffWeeks.length > 0 && (
              <div className="pt-4">
                <h2 className="text-lg sm:text-xl font-black italic uppercase tracking-widest text-amber-500 mb-4 px-2 border-b border-amber-500/20 pb-2 drop-shadow-md">
                  Playoffs
                </h2>
                <div className="space-y-4">
                  {playoffWeeks.map(renderWeekBlock)}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}