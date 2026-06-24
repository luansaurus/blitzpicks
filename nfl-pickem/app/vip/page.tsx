"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import { createClient } from '../../utils/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';

function calculatePoints(homeScore: number | null, awayScore: number | null, homeGuess: number, awayGuess: number) {
  if (homeScore === null || awayScore === null) return 0;
  const realDiff = homeScore - awayScore;
  const predDiff = homeGuess - awayGuess;
  const realWinner = realDiff > 0 ? 'home' : realDiff < 0 ? 'away' : 'tie';
  const predWinner = predDiff > 0 ? 'home' : predDiff < 0 ? 'away' : 'tie';

  if (homeScore === homeGuess && awayScore === awayGuess) return 7;
  if (realWinner === predWinner && realWinner !== 'tie') {
    if (realDiff === predDiff) return 5;
    return 3;
  }
  return 0;
}

export default function VipArea() {
  const [gamesByWeek, setGamesByWeek] = useState<Record<string, any[]>>({});
  const [teamsMap, setTeamsMap] = useState<Record<string, any>>({});
  const [usersMap, setUsersMap] = useState<Record<string, { nickname: string, logoUrl: string | null }>>({});
  const [guessesByGame, setGuessesByGame] = useState<Record<string, any[]>>({});
  
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [currentActiveWeek, setCurrentActiveWeek] = useState<string | null>(null); // NOVO ESTADO
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadVipData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: profile } = await supabase.from('profiles').select('is_admin, is_vip').eq('id', session.user.id).single();
      if (!profile?.is_admin && !profile?.is_vip) { 
        router.push('/dashboard'); 
        return; 
      }

      const { data: teams } = await supabase.from('teams').select('id, name, abbreviation, logo_url');
      const tMap: Record<string, any> = {};
      teams?.forEach(t => { tMap[t.id] = t; });
      setTeamsMap(tMap);

      const { data: profiles } = await supabase.from('profiles').select('id, nickname, favorite_team_id');
      const uMap: Record<string, { nickname: string, logoUrl: string | null }> = {};
      profiles?.forEach(p => { 
        uMap[p.id] = { 
          nickname: p.nickname, 
          logoUrl: tMap[p.favorite_team_id]?.logo_url || null
        }; 
      });
      setUsersMap(uMap);

      const { data: games } = await supabase.from('games').select('*').order('game_time', { ascending: true });
      const { data: guesses } = await supabase.from('guesses').select('*');

      if (games) {
        const groupedGames = games.reduce((acc, game) => {
          const week = game.week || '1';
          if (!acc[week]) acc[week] = [];
          acc[week].push(game);
          return acc;
        }, {} as Record<string, any[]>);
        
        setGamesByWeek(groupedGames);

        const sortedWeeks = Object.keys(groupedGames).sort((a, b) => {
           const numA = parseInt(a);
           const numB = parseInt(b);
           if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
           return a.localeCompare(b);
        });
        
        const activeWeek = sortedWeeks.find(week => !groupedGames[week].every((g: any) => g.status === 'finished')) || sortedWeeks[sortedWeeks.length - 1];
        
        setCurrentActiveWeek(activeWeek); // Marca a semana ativa real
        setExpandedWeek(activeWeek); // Abre ela de primeira
      }

      if (guesses) {
        const groupedGuesses = guesses.reduce((acc, guess) => {
          if (!acc[guess.game_id]) acc[guess.game_id] = [];
          acc[guess.game_id].push(guess);
          return acc;
        }, {} as Record<string, any[]>);
        setGuessesByGame(groupedGuesses);
      }

      setLoading(false);
    }
    loadVipData();
  }, [router, supabase]);

  if (loading) return <LoadingScreen />;

  const playoffOrder = ['WC', 'DR', 'CC', 'SB'];
  const weeks = Object.keys(gamesByWeek).sort((a, b) => {
    const isNumA = !isNaN(Number(a));
    const isNumB = !isNaN(Number(b));
    if (isNumA && isNumB) return Number(a) - Number(b);
    if (isNumA) return -1;
    if (isNumB) return 1;
    return playoffOrder.indexOf(a) - playoffOrder.indexOf(b);
  });

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32">
      <Header />
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-6 mt-4">
        
        <div className="border-b border-white/10 pb-4">
          <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-wider text-[#E31837] drop-shadow-[0_0_15px_rgba(227,24,55,0.3)]">
            VIP Overview
          </h1>
          <p className="text-gray-400 mt-1 font-medium text-xs sm:text-sm">
            Monitor the predictions of all players in real-time.
          </p>
        </div>

        <div className="space-y-4">
          {weeks.map(week => {
            const isOpen = expandedWeek === week;
            const weekGames = gamesByWeek[week];
            
            const isCurrentWeek = week === currentActiveWeek;
            const isFinished = weekGames.length > 0 && weekGames.every(g => g.status === 'finished');

            return (
              <div key={week} className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden shadow-lg">
                <button 
                  onClick={() => setExpandedWeek(isOpen ? null : week)} 
                  className="w-full flex justify-between items-center p-4 bg-neutral-900 hover:bg-neutral-800 transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📅</span>
                    <span className="font-black text-lg uppercase tracking-widest text-white">
                      {playoffOrder.includes(week) ? week : `Week ${week}`}
                    </span>
                    
                    {/* BADGES DA SEMANA */}
                    {isCurrentWeek ? (
                      <span className="hidden sm:inline-block text-[8px] sm:text-[9px] uppercase font-black px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded border border-red-500/30 tracking-widest animate-pulse ml-2">
                        Current Week
                      </span>
                    ) : isFinished ? (
                      <span className="hidden sm:inline-block text-[8px] sm:text-[9px] uppercase font-black px-1.5 py-0.5 bg-white/10 text-gray-400 rounded tracking-widest ml-2">
                        Finished
                      </span>
                    ) : (
                      <span className="hidden sm:inline-block text-[8px] sm:text-[9px] uppercase font-black px-1.5 py-0.5 bg-white/5 text-gray-500 rounded tracking-widest ml-2">
                        Upcoming
                      </span>
                    )}
                  </div>
                  <span className="text-gray-500 font-bold text-lg">{isOpen ? '▼' : '▶'}</span>
                </button>

                {isOpen && (
                  <div className="bg-neutral-950 p-3 sm:p-4 space-y-6 border-t border-white/5 animate-fadeIn">
                    {weekGames.map(game => {
                      const awayTeam = teamsMap[game.away_team_id];
                      const homeTeam = teamsMap[game.home_team_id];
                      const hasStarted = game.status !== 'pending';
                      
                      const gameGuesses = guessesByGame[game.id] || [];
                      
                      let picksAway = 0;
                      let picksHome = 0;
                      let picksTie = 0;
                      gameGuesses.forEach(g => {
                        if (g.away_guess > g.home_guess) picksAway++;
                        else if (g.home_guess > g.away_guess) picksHome++;
                        else picksTie++;
                      });

                      const sortedGuesses = [...gameGuesses].sort((a, b) => {
                         const ptsA = calculatePoints(game.home_score, game.away_score, a.home_guess, a.away_guess);
                         const ptsB = calculatePoints(game.home_score, game.away_score, b.home_guess, b.away_guess);
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
                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-0.5">
                                  {formattedDate}
                                </span>
                                <span className="text-[10px] font-bold text-gray-500 tracking-widest leading-none mb-1">
                                  {formattedTime}
                                </span>
                                {game.status === 'finished' ? (
                                  <span className="text-[9px] font-black text-gray-500 tracking-widest leading-none">FINAL</span>
                                ) : game.status === 'in_progress' ? (
                                  <span className="text-[9px] font-black text-red-500 tracking-widest animate-pulse leading-none">LIVE</span>
                                ) : (
                                  <span className="text-[9px] font-bold text-gray-600 tracking-widest leading-none">PENDING</span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 sm:gap-3 font-black uppercase text-sm sm:text-base truncate">
                                {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0" />}
                                <span className="text-gray-300 truncate">{awayTeam?.name?.split(' ').pop() || awayTeam?.abbreviation}</span>
                                
                                <span className={`ml-1 ${hasStarted ? 'text-white text-lg' : 'text-gray-600 text-lg'}`}>{hasStarted ? game.away_score : '-'}</span>
                                
                                <span className="text-gray-600 text-[10px] mx-1 shrink-0">@</span>
                                
                                <span className={`mr-1 ${hasStarted ? 'text-white text-lg' : 'text-gray-600 text-lg'}`}>{hasStarted ? game.home_score : '-'}</span>
                                <span className="text-gray-300 truncate">{homeTeam?.name?.split(' ').pop() || homeTeam?.abbreviation}</span>
                                {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0" />}
                              </div>

                            </div>

                            <div className="flex items-center justify-start xl:justify-end gap-2 text-[9px] font-black tracking-widest uppercase mt-2 xl:mt-0 shrink-0">
                               <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded border border-white/5 shadow-inner">
                                 <span className="text-gray-500">{awayTeam?.abbreviation || 'AWAY'}</span>
                                 <span className="text-white text-xs">{picksAway}</span>
                               </div>
                               {picksTie > 0 && (
                                 <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded border border-white/5 shadow-inner">
                                   <span className="text-gray-500">TIE</span>
                                   <span className="text-white text-xs">{picksTie}</span>
                                 </div>
                               )}
                               <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded border border-white/5 shadow-inner">
                                 <span className="text-gray-500">{homeTeam?.abbreviation || 'HOME'}</span>
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
                                  const pts = calculatePoints(game.home_score, game.away_score, guess.home_guess, guess.away_guess);
                                  const userObj = usersMap[guess.user_id] || { nickname: 'N/A', logoUrl: null };
                                  
                                  let pickedLogo = null;
                                  if (guess.away_guess > guess.home_guess) { pickedLogo = awayTeam?.logo_url; }
                                  else if (guess.home_guess > guess.away_guess) { pickedLogo = homeTeam?.logo_url; }

                                  let borderColor = "border-neutral-800";
                                  let ptsColor = "text-gray-500";
                                  let bgGradient = "bg-[#111111]";

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
                                          <div className="bg-[#050505] border border-neutral-700 rounded-full w-8 h-8 flex items-center justify-center text-[10px] shadow-xl">
                                            ⚖️
                                          </div>
                                        )}
                                      </div>

                                      <div className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${borderColor} ${bgGradient} overflow-hidden w-full shadow-lg`}>
                                        
                                        <span className="text-[11px] sm:text-xs font-black text-white truncate w-full text-center z-10 mb-1 drop-shadow-md">
                                          {userObj.nickname}
                                        </span>

                                        <span className={`text-[12px] font-black z-10 leading-none mb-2 ${ptsColor}`}>
                                          {hasStarted ? `+${pts} pts` : '- pts'}
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
          })}
        </div>
      </div>
    </main>
  );
}