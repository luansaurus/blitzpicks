"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import { createClient } from '../../utils/supabase/client';
import { getThemeColor } from '../../utils/theme';
import LoadingScreen from '@/components/ui/LoadingScreen';

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

function LockerRoomDrawer({ targetUserId, targetNickname, userColor, gamesByWeek, teamsMap, myGuesses, playoffNames }: any) {
  const [theirGuesses, setTheirGuesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [spyPhase, setSpyPhase] = useState<'regular' | 'playoffs'>('regular');
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  
  const supabase = createClient();

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
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest text-white">{targetNickname}'s Locker Room</h4>
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
                                      <span className="text-[8px] uppercase font-bold text-gray-500 tracking-widest mb-1 truncate w-full text-center">{targetNickname}</span>
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
  );
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
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVip, setIsVip] = useState(false);

  // ABA ATUAL: global | leagues | hub
  const [activeTab, setActiveTab] = useState<'global' | 'leagues' | 'hub'>('global');
  
  const [allLeagues, setAllLeagues] = useState<any[]>([]);
  const [myLeagues, setMyLeagues] = useState<any[]>([]);
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [leagueMembersMap, setLeagueMembersMap] = useState<Record<string, string[]>>({});
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  
  // Controle de Criação/Join
  const [modalInput, setModalInput] = useState('');
  const [isPrivateLeague, setIsPrivateLeague] = useState(true); // Toggle para criar
  const [targetJoinLeague, setTargetJoinLeague] = useState<any | null>(null); // Liga clicada no HUB
  
  const [modalError, setModalError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const [myGuesses, setMyGuesses] = useState<any[]>([]);
  const [teamsMap, setTeamsMap] = useState<Record<string, any>>({});
  const [gamesByWeek, setGamesByWeek] = useState<Record<string, any[]>>({});
  
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [hasLiveGames, setHasLiveGames] = useState(false);

  const playoffNames: Record<string, string> = { 'WC': 'Wild Card Weekend', 'DR': 'Divisional Round', 'CC': 'Conference Championship', 'SB': 'Super Bowl' };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleEditLeague = async () => {
    if (!activeLeagueId) return;
    setIsProcessing(true);
    const { error } = await supabase.from('leagues')
      .update({ name: modalInput.trim(), is_private: isPrivateLeague })
      .eq('id', activeLeagueId);
    
    if (error) showToast("Error updating league.", "error");
    else { showToast("League updated!", "success"); setShowEditModal(false); loadData(); }
    setIsProcessing(false);
  };
  const handleDeleteLeague = async () => {
    if (!activeLeagueId) return;
    setIsProcessing(true);
    const { error } = await supabase.from('leagues').delete().eq('id', activeLeagueId);
    if (error) showToast("Error deleting league.", "error");
    else { 
      showToast("League deleted.", "success"); 
      setActiveLeagueId(null); 
      setDeleteConfirm(false); 
      setShowEditModal(false); 
      loadData(); 
    }
    setIsProcessing(false);
  };

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    setCurrentUserId(session.user.id);

    const { data: profile } = await supabase.from('profiles').select('favorite_team_id, is_admin, is_vip').eq('id', session.user.id).single();
    if (profile) {
      setIsAdmin(profile.is_admin);
      setIsVip(profile.is_vip);
      if (profile.favorite_team_id) {
        const { data: teamInfo } = await supabase.from('teams').select('primary_color').eq('id', profile.favorite_team_id).single();
        if (teamInfo?.primary_color) setUserColor(getThemeColor(teamInfo.primary_color));
      }
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

    const { data: myGuessesData } = await supabase.from('guesses').select('*').eq('user_id', session.user.id);
    if (myGuessesData) setMyGuesses(myGuessesData);

    // BUSCA TODAS AS LIGAS PARA O LEAGUE HUB
    const { data: allLeaguesData } = await supabase.from('leagues').select('*').order('created_at', { ascending: false });
    setAllLeagues(allLeaguesData || []);

    // BUSCA TODOS OS MEMBROS DE TODAS AS LIGAS (Para contagem global e filtros)
    const { data: allMembersData } = await supabase.from('league_members').select('*');
    const lMap: Record<string, string[]> = {};
    const userLeaguesTemp: any[] = [];
    
    allMembersData?.forEach((m: any) => {
      if (!lMap[m.league_id]) lMap[m.league_id] = [];
      lMap[m.league_id].push(m.user_id);
      
      // Se o usuário logado está nesta liga, salva ela para a aba "My Leagues"
      if (m.user_id === session.user.id && allLeaguesData) {
        const found = allLeaguesData.find(l => l.id === m.league_id);
        if (found) userLeaguesTemp.push(found);
      }
    });

    setLeagueMembersMap(lMap);
    setMyLeagues(userLeaguesTemp);
    if (userLeaguesTemp.length > 0 && !activeLeagueId) setActiveLeagueId(userLeaguesTemp[0].id);

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
  };

  useEffect(() => { loadData(); }, [router, supabase]);

  const handleCreateLeague = async () => {
    if (!modalInput.trim()) { setModalError('League name cannot be empty.'); return; }
    setIsProcessing(true);
    if (!isAdmin) {
      const { count } = await supabase.from('leagues').select('*', { count: 'exact', head: true }).eq('owner_id', currentUserId);
      const limit = isVip ? 10 : 3;
      if (count && count >= limit) { setModalError(`Limit reached! Max ${limit} leagues.`); setIsProcessing(false); return; }
    }
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Insere considerando o is_private
    const { data: newLeague, error } = await supabase
      .from('leagues')
      .insert({ 
        name: modalInput.trim(), 
        owner_id: currentUserId, 
        invite_code: inviteCode,
        is_private: isPrivateLeague 
      }).select().single();

    if (error || !newLeague) { setModalError('Error creating league.'); setIsProcessing(false); return; }
    
    await supabase.from('league_members').insert({ league_id: newLeague.id, user_id: currentUserId });
    setShowCreateModal(false);
    setActiveLeagueId(newLeague.id);
    setActiveTab('leagues');
    showToast("League created successfully!", "success");
    await loadData();
    setIsProcessing(false);
  };

  // --- NOVA LÓGICA DE JOIN ---
  const executeJoin = async (leagueId: string, leagueName: string) => {
    setIsProcessing(true);
    const { error: joinError } = await supabase.from('league_members').insert({ league_id: leagueId, user_id: currentUserId });
    
    if (joinError) {
      showToast("Error joining league.", "error");
    } else {
      setShowJoinModal(false);
      setActiveLeagueId(leagueId);
      setActiveTab('leagues');
      showToast(`Welcome to ${leagueName}!`, "success");
      await loadData();
    }
    setIsProcessing(false);
  };

  // Botão clicado no League Hub
  const onHubJoinClick = (league: any) => {
    const isAlreadyMember = myLeagues.some(l => l.id === league.id);
    if (isAlreadyMember) return showToast("You're already in this league!", "info");
    
    const count = leagueMembersMap[league.id]?.length || 0;
    if (count >= 10) return showToast("This league is full.", "error");

    if (league.is_private) {
      // Abre o Modal pedindo a senha
      setTargetJoinLeague(league);
      setModalInput('');
      setModalError('');
      setShowJoinModal(true);
    } else {
      // Entra direto
      executeJoin(league.id, league.name);
    }
  };

  // Função do botão "Join" dentro do Modal de Senha
  const handleJoinPrivateSubmit = async () => {
    if (!targetJoinLeague) return;
    if (!modalInput.trim()) { setModalError('Enter a code.'); return; }
    
    if (modalInput.trim().toUpperCase() !== targetJoinLeague.invite_code) {
      setModalError('Incorrect Password/Invite Code.');
      return;
    }

    await executeJoin(targetJoinLeague.id, targetJoinLeague.name);
  };

  const handleKickMember = async (targetUserId: string) => {
    if (!activeLeagueId) return;
    const { error } = await supabase.from('league_members').delete().eq('league_id', activeLeagueId).eq('user_id', targetUserId);
    if (!error) {
      showToast("Player removed from league.", "success");
      setExpandedUserId(null);
      await loadData();
    } else {
      showToast("Error processing removal.", "error");
    }
  };

  const selectedLeague = myLeagues.find(l => l.id === activeLeagueId);
  const isCurrentUserLeagueOwner = selectedLeague?.owner_id === currentUserId;

  let displayedLeaderboard = leaderboard;
  if (activeTab === 'leagues') {
    if (activeLeagueId) {
      const validMemberIds = leagueMembersMap[activeLeagueId] || [];
      displayedLeaderboard = leaderboard.filter(u => validMemberIds.includes(u.id));
    } else {
      displayedLeaderboard = [];
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32 relative">
      <Header />
      
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slideDown">
          <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md border ${toast.type === 'success' ? 'bg-[#10b981]/20 border-[#10b981]/50 text-[#10b981]' : toast.type === 'error' ? 'bg-[#ef4444]/20 border-[#ef4444]/50 text-[#ef4444]' : 'bg-white/10 border-white/20 text-white'}`}>
            <span className="text-lg">{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '🔄'}</span>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 mt-4">
        <div className="border-b border-white/10 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-wider">
              Leader<span style={{ color: userColor, textShadow: `0 0 15px ${userColor}80` }}>board</span>
            </h1>
            <p className="text-gray-400 mt-1 font-medium text-xs sm:text-sm">Click a player to compare your picks with theirs.</p>
          </div>
          
          {hasLiveGames && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-full animate-pulse">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="hidden sm:inline-block text-[10px] font-black uppercase tracking-widest text-red-500">Live Projections</span>
              <span className="sm:hidden text-[10px] font-black uppercase tracking-widest text-red-500">Live</span>
            </div>
          )}
        </div>

        {/* TABS: GLOBAL | LEAGUES | HUB */}
        <div className="flex bg-neutral-900 border border-white/10 rounded-xl p-1 w-full max-w-lg">
          <button onClick={() => { setActiveTab('global'); setExpandedUserId(null); }} className={`flex-1 px-2 sm:px-4 py-2 text-[9px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'global' ? 'bg-white/10 text-white' : 'text-gray-500'}`} style={activeTab === 'global' ? { color: userColor } : {}}>🌎 Global</button>
          <button onClick={() => { setActiveTab('leagues'); setExpandedUserId(null); if (!activeLeagueId && myLeagues.length > 0) setActiveLeagueId(myLeagues[0].id); }} className={`flex-1 px-2 sm:px-4 py-2 text-[9px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex justify-center items-center gap-1.5 ${activeTab === 'leagues' ? 'bg-white/10 text-white' : 'text-gray-500'}`} style={activeTab === 'leagues' ? { color: userColor } : {}}>🛡️ My Leagues</button>
          <button onClick={() => { setActiveTab('hub'); setExpandedUserId(null); }} className={`flex-1 px-2 sm:px-4 py-2 text-[9px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex justify-center items-center gap-1.5 ${activeTab === 'hub' ? 'bg-white/10 text-white' : 'text-gray-500'}`} style={activeTab === 'hub' ? { color: userColor } : {}}>🏟️ League Hub</button>
        </div>

        {/* CONTROLES DAS PRIVATE LEAGUES */}
        {activeTab === 'leagues' && (
          <div className="bg-neutral-900/40 border border-white/5 rounded-xl p-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full no-scrollbar">
                {myLeagues.length === 0 ? <span className="text-xs font-bold text-gray-500 uppercase">No leagues yet.</span> : myLeagues.map(league => (
                  <button key={league.id} onClick={() => { setActiveLeagueId(league.id); setExpandedUserId(null); }} className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border ${activeLeagueId === league.id ? 'bg-white/10 text-white' : 'bg-black/40 border-white/5 text-gray-500'}`} style={activeLeagueId === league.id ? { borderColor: userColor } : {}}>{league.name}</button>
                ))}
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button onClick={() => { setShowCreateModal(true); setModalError(''); setModalInput(''); setIsPrivateLeague(true); }} className="flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest text-black shadow-md transition-all hover:scale-105" style={{ backgroundColor: userColor }}>+ Create</button>
              </div>
            </div>
            
            {selectedLeague && (
              <div className="bg-black/40 border border-white/5 rounded-lg p-3 flex justify-between items-center">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{selectedLeague.is_private ? '🔒 Private' : '🔓 Public'}</span>
                    {isCurrentUserLeagueOwner && (
                      <button onClick={() => { setShowEditModal(true); setModalInput(selectedLeague.name); setIsPrivateLeague(selectedLeague.is_private); }} className="text-gray-500 hover:text-white">⚙️</button>
                    )}
                  </div>
                  <span className="text-sm font-black text-white tracking-widest font-mono">{selectedLeague.invite_code}</span>
                </div>
                <p className="text-sm font-black text-white">{(leagueMembersMap[activeLeagueId || ''] || []).length} <span className="text-gray-600">/ 10</span></p>
              </div>
            )}
          </div>
        )}
        
        {/* DIRETÓRIO DE LIGAS (HUB) */}
        {activeTab === 'hub' && (
          <div className="animate-fadeIn space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allLeagues.map(league => {
                const count = leagueMembersMap[league.id]?.length || 0;
                const isFull = count >= 10;
                const isMember = myLeagues.some(l => l.id === league.id);
                const ownerName = leaderboard.find(u => u.id === league.owner_id)?.nickname || 'Unknown';

                return (
                  <div key={league.id} className="bg-neutral-900/50 border border-white/5 rounded-xl p-5 flex flex-col justify-between shadow-lg hover:border-white/10 transition-colors">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-black uppercase tracking-wider text-white truncate pr-2">{league.name}</h3>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border shrink-0 ${league.is_private ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
                          {league.is_private ? '🔒 Private' : '🔓 Public'}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Owner: {ownerName}</p>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                      <span className="text-xs font-black text-gray-400">{count} <span className="text-gray-600">/ 10 Players</span></span>
                      
                      {isMember ? (
                        <button disabled className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded bg-white/5 text-gray-500 cursor-not-allowed border border-white/5">Joined</button>
                      ) : isFull ? (
                        <button disabled className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded bg-red-950 text-red-500 cursor-not-allowed border border-red-900">Full</button>
                      ) : (
                        <button onClick={() => onHubJoinClick(league)} className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded text-black transition-transform hover:scale-105 shadow-md" style={{ backgroundColor: userColor }}>
                          {league.is_private ? 'Unlock' : 'Join'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {allLeagues.length === 0 && (
                <div className="col-span-full p-10 text-center border border-white/5 border-dashed rounded-xl">
                  <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">No leagues have been created yet.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TABELA DE RANKING (Global ou Liga) */}
        {activeTab !== 'hub' && (
          <div className="bg-neutral-900/50 rounded-xl border border-white/5 overflow-hidden shadow-lg animate-fadeIn">
            {displayedLeaderboard.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center gap-4 text-center">
                <span className="text-gray-500 text-xs font-bold uppercase">{activeTab === 'leagues' ? "You are not participating in any leagues." : "Nobody is here yet."}</span>
                {activeTab === 'leagues' && <button onClick={() => setActiveTab('hub')} className="px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-black shadow-lg transition-all hover:scale-105" style={{ backgroundColor: userColor }}>Browse League Hub</button>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] text-gray-500 uppercase tracking-widest bg-black/40 border-b border-white/5">
                      <th className="px-4 py-3 font-bold w-12 text-center">Pos</th>
                      <th className="px-4 py-3 font-bold">Player</th>
                      <th className="px-4 py-3 font-bold text-center w-24">Score</th>
                      <th className="px-4 py-3 font-bold text-right w-36">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {displayedLeaderboard.map((user, index) => {
                      const isCurrentUser = user.id === currentUserId;
                      const isExpanded = expandedUserId === user.id;
                      const isTargetUserLeagueOwner = selectedLeague?.owner_id === user.id;
                      const positionColor = index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-700' : 'text-gray-600';

                      return (
                        <React.Fragment key={user.id}>
                          <tr onClick={() => !isCurrentUser && setExpandedUserId(isExpanded ? null : user.id)} className={`transition-colors ${!isCurrentUser ? 'cursor-pointer hover:bg-white/[0.05]' : ''} ${isCurrentUser ? 'bg-white/5' : ''} ${isExpanded ? 'bg-black/40' : ''}`}>
                            <td className="px-4 py-4 text-center"><span className={`text-sm font-black ${positionColor}`}>{index + 1}</span></td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                {user.teams?.logo_url ? <img src={user.teams.logo_url} alt="" className="w-6 h-6 sm:w-8 sm:h-8 object-contain" /> : <div className="w-6 h-6 sm:w-8 sm:h-8" />}
                                <span className={`font-bold text-sm ${isCurrentUser ? 'text-white' : 'text-gray-300'}`}>{user.nickname}</span>
                                {activeTab === 'leagues' && isTargetUserLeagueOwner && (
                                  <span className="text-[8px] uppercase font-black px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 tracking-widest ml-2">👑 Owner</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex flex-col items-center justify-center">
                                <span className={`font-black text-base ${user.projectedPoints > 0 ? 'text-green-400 animate-pulse' : 'text-white'}`}>{user.totalScore}</span>
                                {user.projectedPoints > 0 && <span className="text-[8px] font-black uppercase text-green-500/70">+{user.projectedPoints} Proj</span>}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                               <div className="flex justify-end gap-2">
                                 {activeTab === 'leagues' && isCurrentUserLeagueOwner && !isTargetUserLeagueOwner && (
                                   <button onClick={(e) => { e.stopPropagation(); handleKickMember(user.id); }} className="px-2 py-1 rounded text-[8px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/30 transition-all shrink-0">
                                     Kick ❌
                                   </button>
                                 )}
                                 {!isCurrentUser && (
                                    <button className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded" style={{ backgroundColor: `${userColor}20`, color: userColor }}>
                                      {isExpanded ? 'Hide' : 'Spy'} {isExpanded ? '▲' : '👁️'}
                                    </button>
                                  )}
                               </div>
                            </td>
                          </tr>
                          
                          {/* GAVETA DO LOCKER ROOM (CHAMANDO O SUB-COMPONENTE) */}
                          {isExpanded && (
                            <LockerRoomDrawer targetUserId={user.id} targetNickname={user.nickname} userColor={userColor} gamesByWeek={gamesByWeek} teamsMap={teamsMap} myGuesses={myGuesses} playoffNames={playoffNames} />
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
      </div>
  {/* MODAL: EDITAR LIGA */}
{showEditModal && (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-neutral-950 border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-fadeIn">
      {!deleteConfirm ? (
        <>
          <h2 className="text-2xl font-black italic uppercase tracking-wider text-white mb-6">Edit League</h2>
          
          <input 
            type="text" 
            maxLength={20}
            value={modalInput} 
            onChange={(e) => setModalInput(e.target.value)} 
            className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white font-bold placeholder-gray-600 focus:outline-none focus:border-white/30 mb-4" 
            placeholder="League Name"
          />
          
          <div className="flex items-center gap-3 mb-6 bg-black/40 border border-white/5 p-3 rounded-lg cursor-pointer transition-all hover:border-white/10" onClick={() => setIsPrivateLeague(!isPrivateLeague)}>
            <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isPrivateLeague ? 'bg-amber-500/20 border-amber-500/50' : 'bg-white/5 border-white/10'}`}>
              {isPrivateLeague && <span className="text-amber-500 text-xs">🔒</span>}
              {!isPrivateLeague && <span className="text-green-500 text-xs">🔓</span>}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-widest text-white">{isPrivateLeague ? 'Private League' : 'Public League'}</span>
              <span className="text-[9px] font-bold text-gray-500 uppercase">{isPrivateLeague ? 'Requires invite code to join' : 'Anyone can join directly'}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setShowEditModal(false)} 
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-black uppercase tracking-widest text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleEditLeague} 
              disabled={isProcessing}
              className="flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest text-black transition-all hover:scale-105" 
              style={{ backgroundColor: userColor }}
            >
              Save Changes
            </button>
          </div>
          
          <button 
            onClick={() => setDeleteConfirm(true)} 
            className="w-full mt-6 text-red-500 text-[10px] font-black uppercase tracking-widest hover:text-red-400 transition-colors"
          >
            Delete League
          </button>
        </>
      ) : (
        <div className="text-center animate-fadeIn">
          <h2 className="text-xl font-black italic uppercase tracking-wider mb-4 text-white">Are you sure?</h2>
          <p className="text-xs font-bold text-gray-400 mb-8 uppercase tracking-widest">
            This will delete the league and remove all members permanently.
          </p>
          <div className="flex gap-3">
            <button 
              onClick={() => setDeleteConfirm(false)} 
              className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg text-xs font-black uppercase tracking-widest text-white transition-all"
            >
              No, Keep It
            </button>
            <button 
              onClick={handleDeleteLeague} 
              disabled={isProcessing}
              className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-black uppercase tracking-widest text-white transition-all"
            >
              Yes, Delete
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
      )}
  

      {/* MODAL: CRIAR LIGA */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-fadeIn">
            <h2 className="text-2xl font-black italic uppercase tracking-wider text-white mb-2">Create League</h2>
            {isAdmin && <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest mb-1">Admin Mode (Unlimited)</p>}
            {isVip && !isAdmin && <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest mb-1">VIP Mode (10 leagues)</p>}
            {!isAdmin && !isVip && <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest mb-1">Create up to 3 leagues of your own</p>}
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6">Max 10 players per league.</p>
            
            <input type="text" maxLength={20} placeholder="League Name" value={modalInput} onChange={(e) => setModalInput(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white font-bold placeholder-gray-600 focus:outline-none focus:border-white/30 mb-4" />
            
            <div className="flex items-center gap-3 mb-6 bg-black/40 border border-white/5 p-3 rounded-lg cursor-pointer" onClick={() => setIsPrivateLeague(!isPrivateLeague)}>
              <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isPrivateLeague ? 'bg-amber-500/20 border-amber-500/50' : 'bg-white/5 border-white/10'}`}>
                {isPrivateLeague && <span className="text-amber-500 text-xs">🔒</span>}
                {!isPrivateLeague && <span className="text-green-500 text-xs">🔓</span>}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-widest text-white">{isPrivateLeague ? 'Private League' : 'Public League'}</span>
                <span className="text-[9px] font-bold text-gray-500 uppercase">{isPrivateLeague ? 'Requires invite code to join' : 'Anyone can join directly'}</span>
              </div>
            </div>

            {modalError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mb-4">{modalError}</p>}
            
            <div className="flex gap-3 mt-2">
              <button disabled={isProcessing} onClick={() => setShowCreateModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-black uppercase text-white">Cancel</button>
              <button disabled={isProcessing} onClick={handleCreateLeague} className="flex-1 py-3 rounded-lg text-xs font-black uppercase text-black" style={{ backgroundColor: userColor }}>{isProcessing ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ENTRAR NA LIGA PRIVADA */}
      {showJoinModal && targetJoinLeague && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-fadeIn">
            <h2 className="text-2xl font-black italic uppercase tracking-wider text-white mb-2">Join League</h2>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">League: <span className="text-white">{targetJoinLeague.name}</span></p>
            <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1">🔒 Private League. Enter password.</p>
            
            <input type="text" maxLength={6} placeholder="Invite Code" value={modalInput} onChange={(e) => setModalInput(e.target.value.toUpperCase())} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white font-black tracking-[0.3em] uppercase text-center placeholder-gray-600 focus:outline-none focus:border-white/30 mb-2" />
            
            {modalError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mb-4">{modalError}</p>}
            
            <div className="flex gap-3 mt-6">
              <button disabled={isProcessing} onClick={() => { setShowJoinModal(false); setTargetJoinLeague(null); }} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-black uppercase text-white">Cancel</button>
              <button disabled={isProcessing} onClick={handleJoinPrivateSubmit} className="flex-1 py-3 rounded-lg text-xs font-black uppercase text-black" style={{ backgroundColor: userColor }}>{isProcessing ? 'Joining...' : 'Join'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}