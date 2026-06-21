"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import { createClient } from '../../utils/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';

// 1. Função inteligente para garantir contraste no Dark Mode
function getLegibleColor(hex: string) {
  if (!hex) return '#E31837';
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
  
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  if (luminance < 0.35) {
    const mixWhite = (val: number) => Math.round(val + (255 - val) * 0.45).toString(16).padStart(2, '0');
    return `#${mixWhite(r)}${mixWhite(g)}${mixWhite(b)}`;
  }
  return hex;
}

// 2. Função auxiliar para calcular pontos e cores dos cards de comparação
function getPickResult(game: any, guess: any) {
  if (!game || !guess || game.home_score === null || game.away_score === null) {
    return { points: 0, colorClass: 'bg-transparent', textClass: 'text-gray-500' };
  }

  const realDiff = game.home_score - game.away_score;
  const predDiff = guess.home_guess - guess.away_guess;
  const realWinner = realDiff > 0 ? 'home' : realDiff < 0 ? 'away' : 'tie';
  const predWinner = predDiff > 0 ? 'home' : predDiff < 0 ? 'away' : 'tie';

  if (game.home_score === guess.home_guess && game.away_score === guess.away_guess) {
    return { points: 7, colorClass: 'bg-green-500/20', textClass: 'text-green-400' };
  } else if (realWinner === predWinner && realWinner !== 'tie') {
    if (realDiff === predDiff) {
      return { points: 5, colorClass: 'bg-blue-500/20', textClass: 'text-blue-400' };
    } else {
      return { points: 3, colorClass: 'bg-amber-500/20', textClass: 'text-amber-400' };
    }
  } else {
    return { points: 0, colorClass: 'bg-red-500/10', textClass: 'text-red-500' };
  }
}

export default function RankingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userColor, setUserColor] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem('blitz_accent') || '#E31837';
    }
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

  const displayColor = getLegibleColor(userColor);

  useEffect(() => {
    async function loadRankingData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      setCurrentUserId(session.user.id);

      const { data: profile } = await supabase.from('profiles').select('favorite_team_id').eq('id', session.user.id).single();
      if (profile?.favorite_team_id) {
        const { data: teamInfo } = await supabase.from('teams').select('primary_color').eq('id', profile.favorite_team_id).single();
        if (teamInfo?.primary_color) {
          setUserColor(teamInfo.primary_color);
          localStorage.setItem('blitz_accent', teamInfo.primary_color);
        }
      }

      const { data: teams } = await supabase.from('teams').select('*');
      const tMap: Record<string, any> = {};
      teams?.forEach(t => { tMap[t.id.toString()] = { name: t.name, abbr: t.abbreviation, logo: t.logo_url }; });
      setTeamsMap(tMap);

      const { data: games } = await supabase.from('games').select('*').order('game_time', { ascending: true });
      if (games) {
        const grouped = games.reduce((acc, g) => {
          const w = g.week || '1';
          if (!acc[w]) acc[w] = [];
          acc[w].push(g);
          return acc;
        }, {} as Record<string, any[]>);
        
        setGamesByWeek(grouped);

        const sortedWeeks = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));
        const activeWeek = sortedWeeks.find(week => !grouped[week].every((g: any) => g.status === 'finished')) || sortedWeeks[sortedWeeks.length - 1];
        setExpandedWeek(activeWeek);
      }

      const { data: myGuessesData } = await supabase.from('guesses').select('*').eq('user_id', session.user.id);
      if (myGuessesData) setMyGuesses(myGuessesData);

      const { data: users } = await supabase
        .from('profiles')
        .select('id, nickname, score, favorite_team_id, teams ( logo_url, abbreviation )')
        .order('score', { ascending: false });

      if (users) setLeaderboard(users);
      
      setLoading(false);
    }
    
    loadRankingData();
  }, [router, supabase]);

  const toggleUserPicks = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    
    setExpandedUserId(userId);
    setLoadingPicks(true);
    
    const { data: guesses } = await supabase.from('guesses').select('*').eq('user_id', userId);
    setExpandedUserGuesses(guesses || []);
    setLoadingPicks(false);
  };

  if (loading) return <LoadingScreen />;

  const weeks = Object.keys(gamesByWeek).sort((a, b) => Number(a) - Number(b));

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32">
      <Header />
      
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 mt-4">
        
        <div className="border-b border-white/10 pb-4">
          <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-wider">
            Leader<span style={{ color: userColor, textShadow: `0 0 15px ${userColor}80, 0 1px 2px rgba(255,255,255,0.2)` }}>board</span>
          </h1>
          <p className="text-gray-400 mt-1 font-medium text-xs sm:text-sm">Global rankings. Click a player to compare your picks with theirs.</p>
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
    
    const positionColor = 
      index === 0 ? 'text-yellow-500 drop-shadow-md' : 
      index === 1 ? 'text-gray-300 drop-shadow-md' : 
      index === 2 ? 'text-amber-700 drop-shadow-md' : 
      'text-gray-600';

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
              {isCurrentUser && (
                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border" style={{ backgroundColor: `${userColor}20`, borderColor: `${userColor}50`, color: displayColor }}>
                  You
                </span>
              )}
            </div>
          </td>
          {/* Coluna final com Score e botão de Spy */}
          <td className="px-4 py-4 text-right">
            <div className="flex flex-col items-end gap-1">
              <span className="font-black text-base sm:text-lg text-white">{user.score}</span>
              
              
            </div>
          </td>
          <td className="px-4 py-4">
             {!isCurrentUser && (
                <button 
                  className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded transition-all hover:scale-105"
                  style={{ backgroundColor: `${userColor}20`, color: displayColor }}
                >
                  {isExpanded ? 'Hide' : 'Spy'} {isExpanded ? '▲' : '👁️'}
                </button>
              )}
          </td>
          
          
        </tr>

        {isExpanded && (
          <tr>
            <td colSpan={4} className="p-0 border-b border-white/5 bg-black/80">
              <div className="animate-fadeIn p-2 sm:p-4">
                
                <div className="flex items-center justify-between px-2 py-3">
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest text-white">
                    {user.nickname}'s Season Bracket
                  </h4>
                </div>

                {loadingPicks ? (
                  <div className="text-center py-10 text-gray-500 font-bold uppercase tracking-widest text-xs animate-pulse">
                    Loading data...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {weeks.map(week => {
                      const isWeekOpen = expandedWeek === week;
                      const weekGames = gamesByWeek[week];

                      return (
                        <div key={week} className="bg-neutral-900/40 rounded-xl border border-white/5 overflow-hidden shadow-sm transition-all">
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedWeek(isWeekOpen ? null : week); }}
                            className="w-full flex justify-between items-center p-3 sm:p-4 bg-neutral-900 hover:bg-neutral-800 transition text-left border-b border-white/5"
                          >
                            <span className="font-black text-sm uppercase tracking-widest" style={{ color: isWeekOpen ? displayColor : '#ffffff' }}>Week {week}</span>
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

                                  const theirResult = getPickResult(game, theirGuess);
                                  const myResult = getPickResult(game, myGuess);

                                  return (
                                    <div key={game.id} className="bg-neutral-950 border border-white/10 rounded-lg overflow-hidden flex flex-col">
                                      <div className="p-2 sm:p-3 border-b border-white/5 bg-neutral-900/80 flex justify-between items-center gap-2">
                                        <div className="flex items-center gap-2">
                                          {awayTeam?.logo ? <img src={awayTeam.logo} title={awayTeam?.abbr} className="w-6 h-6 object-contain" alt={awayTeam?.abbr} /> : <span className="text-[10px] font-black uppercase text-white">{awayTeam?.abbr}</span>}
                                          <span className="text-[9px] font-black text-gray-500">@</span>
                                          {homeTeam?.logo ? <img src={homeTeam.logo} title={homeTeam?.abbr} className="w-6 h-6 object-contain" alt={homeTeam?.abbr} /> : <span className="text-[10px] font-black uppercase text-white">{homeTeam?.abbr}</span>}
                                        </div>

                                        <div className="flex flex-col items-end">
                                          {isFinished ? (
                                            <>
                                              <span className="text-[8px] font-black uppercase tracking-widest text-green-500 mb-0.5">Final</span>
                                              <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-black/50 border border-white/10 rounded text-white">{game.away_score} - {game.home_score}</span>
                                            </>
                                          ) : (
                                            <>
                                              <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500 mb-0.5">Upcoming</span>
                                              <span className="text-[9px] font-bold text-gray-500 tracking-widest">{new Date(game.game_time).toLocaleDateString("en-US", { month: 'short', day: 'numeric' })}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 divide-x divide-white/5">
                                        <div className={`p-3 flex flex-col items-center justify-center transition-colors ${isFinished ? theirResult.colorClass : 'bg-transparent'}`}>
                                          <span className="text-[8px] uppercase font-bold text-gray-500 tracking-widest mb-1 truncate w-full text-center">{user.nickname}</span>
                                          <span className={`font-black text-sm ${theirGuess ? 'text-white' : 'text-gray-600'}`}>{theirGuess ? `${theirGuess.away_guess} - ${theirGuess.home_guess}` : 'N/A'}</span>
                                          {isFinished && theirGuess && <span className={`text-[9px] font-black uppercase mt-1 ${theirResult.textClass}`}>{theirResult.points} PTS</span>}
                                        </div>

                                        <div className={`p-3 flex flex-col items-center justify-center transition-colors ${isFinished ? myResult.colorClass : 'bg-transparent'}`}>
                                          <span className="text-[8px] uppercase font-bold text-gray-500 tracking-widest mb-1 truncate w-full text-center">You</span>
                                          <span className={`font-black text-sm ${myGuess ? 'text-white' : 'text-gray-600'}`}>{myGuess ? `${myGuess.away_guess} - ${myGuess.home_guess}` : 'N/A'}</span>
                                          {isFinished && myGuess && <span className={`text-[9px] font-black uppercase mt-1 ${myResult.textClass}`}>{myResult.points} PTS</span>}
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
                    })}
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