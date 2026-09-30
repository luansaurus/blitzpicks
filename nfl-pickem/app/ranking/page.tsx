"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import { createClient } from '../../lib/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { getPickResult } from '@/lib/scoring';
import SpyLockerRoom from '../../components/scoreboard/SpyLockerRoom';
import { Calendar, Scale, Trophy, Eye, ChevronUp, Crown, Binoculars, Circle, Lock } from 'lucide-react';
import { getBestColor } from '@/lib/color';
import { PLAYOFF_ORDER, PLAYOFF_NAMES } from '@/lib/constants/playoffs';

export default function RankingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'ranking' | 'spy'>('ranking');
  
  const [userColor, setUserColor] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('blitz_accent') || '#E31837';
    return '#E31837';
  });
  const [ambientPrimary, setAmbientPrimary] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('blitz_header_bg') || '#013369';
    return '#013369';
  });
  const [ambientSecondary, setAmbientSecondary] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('blitz_header_sec') || '#E31837';
    return '#E31837';
  });
  
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [teamsMap, setTeamsMap] = useState<Record<string, any>>({});
  const [gamesByWeek, setGamesByWeek] = useState<Record<string, any[]>>({});
  
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myGuesses, setMyGuesses] = useState<any[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [hasLiveGames, setHasLiveGames] = useState(false);

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
        const { data: teamInfo } = await supabase.from('teams').select('primary_color, secondary_color').eq('id', profile.favorite_team_id).single();
        if (teamInfo) {
          setUserColor(getBestColor(teamInfo.primary_color || '', teamInfo.secondary_color || ''));
          setAmbientPrimary(teamInfo.primary_color || '#013369');
          setAmbientSecondary(teamInfo.secondary_color || '#E31837');
        }
      } else if (typeof window !== "undefined") {
         const savedAccent = localStorage.getItem('blitz_accent');
         if (savedAccent) setUserColor(savedAccent);
      }

      const { data: teams } = await supabase.from('teams').select('*');
      const tMap: Record<string, any> = {};
      teams?.forEach(t => { 
        tMap[t.id.toString()] = { 
          name: t.name, 
          abbr: t.abbreviation, 
          logo: t.logo_url,
          color: getBestColor(t.primary_color || '', t.secondary_color || '') 
        }; 
      });
      setTeamsMap(tMap);

      const { data: users } = await supabase.from('profiles').select('id, nickname, score, global_titles, is_test, teams ( logo_url, abbreviation )');
      const { data: allGuesses } = await supabase.from('guesses').select('*');
      const { data: games } = await supabase.from('games').select('*').order('game_time', { ascending: true });

      if (users && games && allGuesses) {
        const validUsers = users.filter(u => u.is_test !== true);
        
        const uMap: Record<string, any> = {};
        validUsers.forEach(u => { 
          uMap[u.id] = { 
            nickname: u.nickname, 
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

        const myG = allGuesses.filter(g => g.user_id === session.user.id);
        setMyGuesses(myG);

        const liveGames = games.filter(g => g.status === 'in_progress');
        setHasLiveGames(liveGames.length > 0);

        // ==========================================
        // LÓGICA DE PONTUAÇÃO E TIEBREAKER
        // ==========================================
        const liveLeaderboard = validUsers.map((user: any) => {
          let officialScore = 0;
          let projectedPoints = 0;
          let exactHits = 0;
          let diffHits = 0;

          allGuesses.filter(g => g.user_id === user.id).forEach(pick => {
            const game = games.find(g => g.id === pick.game_id);
            if (game && (game.status === 'finished' || game.status === 'in_progress')) {
              const res = getPickResult(game, pick, { exact: 7, diff: 5, winner: 3 });
              
              if (game.status === 'finished') {
                officialScore += res.points;
              } else if (game.status === 'in_progress') {
                projectedPoints += res.points;
              }

              if (res.points === 7) exactHits++;
              else if (res.points === 5) diffHits++;
            }
          });

          return { 
            ...user, 
            officialScore, 
            projectedPoints, 
            totalScore: officialScore + projectedPoints,
            exactHits,
            diffHits
          };
        });

        // ==========================================
        // CASCATA DE DESEMPATE
        // ==========================================
        liveLeaderboard.sort((a, b) => {
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
          if (b.diffHits !== a.diffHits) return b.diffHits - a.diffHits;
          if ((b.global_titles || 0) !== (a.global_titles || 0)) return (b.global_titles || 0) - (a.global_titles || 0);
          return (a.nickname || '').localeCompare(b.nickname || '');
        });

        // Aplicação do Rank com Empate Correto (Se estiverem iguais, têm o mesmo Rank)
        for (let i = 0; i < liveLeaderboard.length; i++) {
          if (i > 0) {
            const prev = liveLeaderboard[i - 1];
            const curr = liveLeaderboard[i];
            if (
              curr.totalScore === prev.totalScore &&
              curr.exactHits === prev.exactHits &&
              curr.diffHits === prev.diffHits &&
              (curr.global_titles || 0) === (prev.global_titles || 0)
            ) {
              curr.displayRank = prev.displayRank;
            } else {
              curr.displayRank = i + 1;
            }
          } else {
            liveLeaderboard[i].displayRank = 1;
          }
        }

        setLeaderboard(liveLeaderboard);
      }
      setLoading(false);
    }
    loadGlobalData();
  }, [router, supabase]);

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
          <div className="bg-black/20 p-4 sm:p-6 space-y-6 animate-fadeIn relative z-0 shadow-inner">
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

              const nowMs = new Date().getTime();
              const isRevealedForEveryone = (gDate.getTime() - nowMs) <= 10 * 60 * 1000;

              return (
                <div key={game.id} className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md overflow-hidden shadow-xl">
                  
                  {/* Game Header */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between p-4 sm:p-5 bg-black/80 border-b border-white/5 gap-4 shadow-inner">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 shrink-0 overflow-hidden">
                      <div className="flex flex-col text-left justify-center min-w-[90px] border-l-2 border-[#E31837] pl-3 sm:border-r sm:border-white/10 sm:pr-5 sm:border-l-0 shrink-0">
                        <span className="font-sans text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">{formattedDate}</span>
                        <span className="font-sans text-[10px] font-bold text-gray-500 tracking-widest leading-none mb-1.5">{formattedTime}</span>
                        {game.status === 'finished' ? (
                          <span className="font-sans text-[9px] font-black text-green-500 tracking-widest leading-none drop-shadow-md">FINAL</span>
                        ) : game.status === 'in_progress' ? (
                          <span className="font-sans text-[9px] font-black text-red-500 tracking-widest animate-pulse leading-none flex items-center gap-1"><Circle size={6} fill="currentColor"/> LIVE</span>
                        ) : (
                          <span className="font-sans text-[9px] font-bold text-neutral-600 tracking-widest leading-none">PENDING</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4 truncate">
                        {awayTeam?.logo && <img src={awayTeam.logo} alt="" className="w-6 h-6 sm:w-8 sm:h-8 object-contain shrink-0 drop-shadow-lg" />}
                        <span className="font-sport font-bold text-sm sm:text-base text-gray-300 uppercase truncate tracking-wider" style={{color: awayTeam?.color}}>{awayTeam?.name?.split(' ').pop() || awayTeam?.abbr}</span>
                        <span className={`ml-1 font-jersey text-xl sm:text-2xl leading-none pt-1 ${hasStarted ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'text-gray-600'}`}>{hasStarted ? game.away_score : '-'}</span>
                        
                        <span className="font-sans font-black text-gray-600 text-[10px] mx-1 sm:mx-2 shrink-0">VS</span>
                        
                        <span className={`mr-1 font-jersey text-xl sm:text-2xl leading-none pt-1 ${hasStarted ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'text-gray-600'}`}>{hasStarted ? game.home_score : '-'}</span>
                        <span className="font-sport font-bold text-sm sm:text-base text-gray-300 uppercase truncate tracking-wider text-right" style={{color: homeTeam?.color}}>{homeTeam?.name?.split(' ').pop() || homeTeam?.abbr}</span>
                        {homeTeam?.logo && <img src={homeTeam.logo} alt="" className="w-6 h-6 sm:w-8 sm:h-8 object-contain shrink-0 drop-shadow-lg" />}
                      </div>
                    </div>

                    <div className="flex items-center justify-start xl:justify-end gap-2 font-sans text-[9px] font-black tracking-widest uppercase mt-2 xl:mt-0 shrink-0">
                       <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/5 shadow-inner">
                         <span className="text-gray-500">{awayTeam?.abbr || 'AWAY'}</span>
                         <span className="text-white text-xs">{picksAway}</span>
                       </div>
                       {picksTie > 0 && (
                         <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/5 shadow-inner">
                           <span className="text-gray-500">TIE</span>
                           <span className="text-white text-xs">{picksTie}</span>
                         </div>
                       )}
                       <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/5 shadow-inner">
                         <span className="text-gray-500">{homeTeam?.abbr || 'HOME'}</span>
                         <span className="text-white text-xs">{picksHome}</span>
                       </div>
                    </div>
                  </div>

                  {/* Users Picks Grid */}
                  <div className="p-4 sm:p-6 bg-[#050505]/50 backdrop-blur-sm">
                    {sortedGuesses.length === 0 ? (
                      <div className="text-center font-sans text-[10px] font-black uppercase tracking-widest text-gray-600 py-4">
                        No predictions yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-x-4 gap-y-6 pt-3 pb-2">
                        {sortedGuesses.map((guess) => {
                          const pts = getPickResult(game, guess).points;
                          const userObj = usersMap[guess.user_id] || { nickname: 'N/A', logoUrl: null };
                          
                          const isRevealed = isRevealedForEveryone || guess.user_id === currentUserId;

                          let pickedLogo = null;
                          if (guess.away_guess > guess.home_guess) { pickedLogo = awayTeam?.logo; }
                          else if (guess.home_guess > guess.away_guess) { pickedLogo = homeTeam?.logo; }

                          let borderColor = "border-white/5";
                          let ptsColor = "text-gray-500";
                          let bgGradient = "bg-[#0a0a0a]";

                          if (hasStarted) {
                            if (pts === 7) { borderColor = "border-[#3b82f6]/80 shadow-[0_0_15px_rgba(59,130,246,0.3)]"; ptsColor = "text-[#3b82f6] drop-shadow-md"; bgGradient = "bg-gradient-to-b from-[#3b82f6]/10 to-[#0a0a0a]"; } 
                            else if (pts >= 3) { borderColor = "border-[#10b981]/80 shadow-[0_0_15px_rgba(16,185,129,0.3)]"; ptsColor = "text-[#10b981] drop-shadow-md"; bgGradient = "bg-gradient-to-b from-[#10b981]/10 to-[#0a0a0a]";  } 
                            else { borderColor = "border-[#ef4444]/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]"; ptsColor = "text-[#ef4444]"; bgGradient = "bg-gradient-to-b from-[#ef4444]/10 to-[#0a0a0a]"; } 
                          }

                          return (
                            <div key={guess.user_id} className="relative pt-3 pr-2 w-full flex justify-center group"> 
                              <div className="absolute top-0 right-0 sm:-right-2 z-20 shadow-xl group-hover:scale-110 transition-transform">
                                {pickedLogo ? (
                                  <div className="bg-[#050505] border border-white/10 rounded-full p-1.5 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shadow-2xl">
                                    <img src={pickedLogo} className="w-full h-full object-contain" alt="Pick" />
                                  </div>
                                ) : (
                                  <div className="bg-[#050505] border border-white/10 rounded-full w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shadow-2xl"><Scale size={14} className="text-gray-500" /></div>
                                )}
                              </div>
                              
                              <div className={`relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all ${borderColor} ${bgGradient} w-full`}>
                                <span className="font-sport font-bold text-[10px] sm:text-xs text-white uppercase tracking-wider truncate w-full text-center z-10 mb-1 drop-shadow-md" title={userObj.nickname}>
                                  {userObj.nickname}
                                </span>
                                
                                {isRevealed ? (
                                  <>
                                    <span className={`font-sans text-[9px] sm:text-[10px] font-black uppercase tracking-widest z-10 leading-none mb-3 ${ptsColor}`}>
                                      {hasStarted ? `+${pts} pts` : 'pending'}
                                    </span>
                                    <div className="flex items-center gap-1.5 sm:gap-2 z-10 leading-none bg-[#050505] px-2 py-1.5 sm:py-2 rounded-xl border border-white/10 shadow-inner w-[95%] justify-center mt-auto">
                                      <span className="font-jersey text-base sm:text-lg text-white pt-1">{guess.away_guess}</span>
                                      <span className="font-sans text-[8px] text-gray-600 font-black">X</span>
                                      <span className="font-jersey text-base sm:text-lg text-white pt-1">{guess.home_guess}</span>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <span className={`font-sans text-[9px] sm:text-[10px] font-black uppercase tracking-widest z-10 leading-none mb-3 ${ptsColor}`}>
                                      Locked
                                    </span>
                                    <div className="flex items-center gap-1.5 z-10 leading-none bg-black/60 px-2 py-1.5 sm:py-2 rounded-xl border border-white/5 shadow-inner w-[95%] justify-center mt-auto">
                                      <Lock size={10} className="text-gray-500" />
                                      <span className="font-sans text-[8px] font-black uppercase tracking-widest text-gray-500 pt-0.5">HIDDEN</span>
                                    </div>
                                  </>
                                )}
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
    <main className="min-h-screen bg-[#050505] text-white font-sans pb-32 relative overflow-hidden">
      
      {/* Refletores Duplos - SPOTLIGHTS */}
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
        <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-6 mt-4">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-6">
            <div>
              <h1 className="font-jersey text-4xl sm:text-5xl tracking-widest text-white uppercase mb-1 drop-shadow-md">
                GLOBAL <span style={{ color: userColor, textShadow: `0 0 15px ${userColor}80` }}>ARENA</span>
              </h1>
              <p className="text-gray-400 font-sans text-xs sm:text-sm font-bold uppercase tracking-widest">Compare your picks and spy on the competition.</p>
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 w-full max-w-sm shrink-0 shadow-xl">
                <button 
                  onClick={() => setActiveTab('ranking')} 
                  className={`flex-1 px-4 py-3 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'ranking' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`} 
                  style={activeTab === 'ranking' ? { color: userColor, boxShadow: `inset 0 -4px 0 ${userColor}` } : {}}
                >
                  <Trophy size={14} /> Leaderboard
                </button>
                <button 
                  onClick={() => setActiveTab('spy')} 
                  className={`flex-1 px-4 py-3 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'spy' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`} 
                  style={activeTab === 'spy' ? { color: userColor, boxShadow: `inset 0 -4px 0 ${userColor}` } : {}}
                >
                  <Binoculars size={14} /> Spy Hub
                </button>
              </div>
            </div>
          </div>

          {/* ================= ABA 1: RANKING GLOBAL ================= */}
          {activeTab === 'ranking' && (
            <div className="bg-black/60 backdrop-blur-2xl rounded-3xl border border-white/10 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-fadeIn max-w-5xl mx-auto">
              {leaderboard.length === 0 ? (
                <div className="p-16 text-center"><span className="text-gray-500 font-sans text-xs font-black uppercase tracking-widest">Nobody is here yet.</span></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead>
                      <tr className="font-sans text-[10px] text-gray-500 uppercase tracking-widest bg-black/80 border-b border-white/10 shadow-sm">
                        <th className="px-6 py-4 font-black w-16 text-center">RK</th>
                        <th className="px-6 py-4 font-black">Player</th>
                        <th className="px-6 py-4 font-black text-center w-36">Score <span className="hidden sm:inline-block text-[8px] text-gray-600 ml-1">(TIEBREAKERS)</span></th>
                        <th className="px-6 py-4 font-black text-right w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {leaderboard.map((user, index) => {
                        const isCurrentUser = user.id === currentUserId;
                        const isExpanded = expandedUserId === user.id;
                        const positionColor = user.displayRank === 1 ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]' : user.displayRank === 2 ? 'text-gray-300 drop-shadow-[0_0_8px_rgba(209,213,219,0.4)]' : user.displayRank === 3 ? 'text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.4)]' : 'text-gray-600';

                        return (
                          <React.Fragment key={user.id}>
                            <tr onClick={() => !isCurrentUser && setExpandedUserId(isExpanded ? null : user.id)} className={`transition-all ${!isCurrentUser ? 'cursor-pointer hover:bg-white/[0.03]' : ''} ${isCurrentUser ? 'bg-white/5' : ''} ${isExpanded ? 'bg-black/60 shadow-inner' : ''}`}>
                              <td className="px-6 py-5 text-center">
                                <span className={`font-jersey text-2xl sm:text-3xl leading-none ${positionColor}`}>{user.displayRank}</span>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-4">
                                  {user.teams && !Array.isArray(user.teams) && user.teams.logo_url ? (
                                    <img src={user.teams.logo_url} className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-lg" alt="" />
                                  ) : (
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/5 border border-white/10 rounded-full shadow-inner" />
                                  )}
                                  <div className="flex flex-col justify-center">
                                    <span className={`font-sport font-bold text-sm sm:text-base uppercase tracking-wider leading-none pb-1 ${isCurrentUser ? 'text-white drop-shadow-md' : 'text-gray-300'}`}>{user.nickname}</span>
                                    {user.global_titles > 0 && (
                                      <span className="font-sans text-[8px] uppercase font-black px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded border border-yellow-500/20 tracking-widest inline-flex items-center gap-1 w-max mt-1"><Crown size={10} /> x{user.global_titles}</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-center">
                                <div className="flex flex-col items-center justify-center">
                                  <div className="flex items-end gap-2">
                                    <span className={`font-jersey text-2xl sm:text-3xl leading-none pt-1 ${user.projectedPoints > 0 ? 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)] animate-pulse' : 'text-white'}`}>
                                      {user.totalScore}
                                    </span>
                                    {user.projectedPoints > 0 && <span className="font-sans text-[8px] font-black uppercase text-green-500 tracking-widest mb-1.5">+{user.projectedPoints} Proj</span>}
                                  </div>
                                  
                                  {/* TIEBREAKERS DISPLAY */}
                                  <div className="flex items-center gap-2 mt-1.5 opacity-80 bg-black/40 px-2 py-1.5 rounded-md border border-white/5 shadow-inner">
                                    <span className="font-sans text-[8px] font-black tracking-widest uppercase text-green-400 drop-shadow-sm" title="Exact Scores (7 pts)">{user.exactHits} EX</span>
                                    <span className="text-gray-600 text-[8px]">|</span>
                                    <span className="font-sans text-[8px] font-black tracking-widest uppercase text-blue-400 drop-shadow-sm" title="Correct Margins (5 pts)">{user.diffHits} MRG</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                 <div className="flex justify-end">
                                   {!isCurrentUser && (
                                      <button className="flex items-center gap-1.5 font-sans text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-all bg-white/[0.02] hover:bg-white/10 border border-white/5 shadow-md hover:scale-105" style={isExpanded ? { backgroundColor: `${userColor}20`, color: userColor, borderColor: `${userColor}50` } : { color: '#9ca3af' }}>
                                        {isExpanded ? 'Hide' : 'Spy'} {isExpanded ? <ChevronUp size={14} /> : <Eye size={14} />}
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
            <div className="space-y-8 animate-fadeIn max-w-[1400px] mx-auto">
              {regularWeeks.length > 0 && (
                <div>
                  <h2 className="font-jersey text-3xl sm:text-4xl uppercase tracking-widest text-gray-500 mb-4 px-2 border-b border-white/5 pb-3">
                    REGULAR <span className="text-white drop-shadow-md">SEASON</span>
                  </h2>
                  <div className="space-y-5">
                    {regularWeeks.map(renderWeekBlock)}
                  </div>
                </div>
              )}

              {playoffWeeks.length > 0 && (
                <div className="pt-6">
                  <h2 className="font-jersey text-3xl sm:text-4xl uppercase tracking-widest text-amber-500 mb-4 px-2 border-b border-amber-500/20 pb-3 drop-shadow-md">
                    PLAYOFFS
                  </h2>
                  <div className="space-y-5">
                    {playoffWeeks.map(renderWeekBlock)}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </main>
  );
}