"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import { createClient } from '../../utils/supabase/client';
import { getThemeColor } from '../../utils/theme';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { getPickResult } from '@/utils/scoring';
import SpyLockerRoom from '../../components/scoreboard/SpyLockerRoom'; // Importando o Componente Limpo!

export default function RankingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userColor, setUserColor] = useState('#E31837');
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [myGuesses, setMyGuesses] = useState<any[]>([]);
  const [teamsMap, setTeamsMap] = useState<Record<string, any>>({});
  const [gamesByWeek, setGamesByWeek] = useState<Record<string, any[]>>({});
  
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [hasLiveGames, setHasLiveGames] = useState(false);

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
         setUserColor(localStorage.getItem('blitz_accent') || '#E31837');
      }

      const { data: teams } = await supabase.from('teams').select('*');
      const tMap: Record<string, any> = {};
      teams?.forEach(t => { tMap[t.id.toString()] = { name: t.name, abbr: t.abbreviation, logo: t.logo_url }; });
      setTeamsMap(tMap);

      const { data: games } = await supabase.from('games').select('*').order('game_time', { ascending: true });
      if (games) {
        setHasLiveGames(games.some(g => g.status === 'in_progress'));
        const grouped = games.reduce((acc, g) => {
          let w = g.week || '1';
          if (w === 'AFCC' || w === 'NFCC') w = 'CC';
          if (!acc[w]) acc[w] = [];
          acc[w].push(g);
          return acc;
        }, {} as Record<string, any[]>);
        setGamesByWeek(grouped);
      }

      const { data: guessesData } = await supabase.from('guesses').select('*').eq('user_id', session.user.id);
      if (guessesData) setMyGuesses(guessesData);

      const { data: users } = await supabase.from('profiles').select('id, nickname, score, is_test, teams ( logo_url, abbreviation )');
      const { data: allGuesses } = await supabase.from('guesses').select('user_id, game_id, home_guess, away_guess');

      if (users && games && allGuesses) {
        const validUsers = users.filter(u => u.is_test !== true);
        const liveGames = games.filter(g => g.status === 'in_progress');

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

  if (loading) return <LoadingScreen />;

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32">
      <Header />
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 mt-4">
        
        <div className="border-b border-white/10 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-wider">
              Global <span style={{ color: userColor, textShadow: `0 0 15px ${userColor}80` }}>Rank</span>
            </h1>
            <p className="text-gray-400 mt-1 font-medium text-xs sm:text-sm">Compare your picks with the world.</p>
          </div>
          {hasLiveGames && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-full animate-pulse">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="hidden sm:inline-block text-[10px] font-black uppercase tracking-widest text-red-500">Live Projections</span>
            </div>
          )}
        </div>

        <div className="bg-neutral-900/50 rounded-xl border border-white/5 overflow-hidden shadow-lg animate-fadeIn">
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
                        <tr onClick={() => !isCurrentUser && setExpandedUserId(isExpanded ? null : user.id)} className={`transition-colors ${!isCurrentUser ? 'cursor-pointer hover:bg-white/[0.05]' : ''} ${isCurrentUser ? 'bg-white/5' : ''}`}>
                          <td className="px-4 py-4 text-center"><span className={`text-sm font-black ${positionColor}`}>{index + 1}</span></td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {user.teams?.logo_url ? <img src={user.teams.logo_url} className="w-6 h-6 object-contain" alt="" /> : <div className="w-6 h-6" />}
                              <span className={`font-bold text-sm ${isCurrentUser ? 'text-white' : 'text-gray-300'}`}>{user.nickname}</span>
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
                                    {isExpanded ? 'Hide' : 'Spy'} {isExpanded ? '▲' : '👁️'}
                                  </button>
                                )}
                             </div>
                          </td>
                        </tr>
                        
                        {/* A CHAMADA DO COMPONENTE LIMPO SEM PASSAR RULES (usa o global automático) */}
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
      </div>
    </main>
  );
}