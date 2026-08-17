"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getPickResult } from '@/utils/scoring';
import SpyLockerRoom from '../scoreboard/SpyLockerRoom';
import { Shield, Landmark, Lock, LockOpen, Settings, Crown, Star, X, Eye, ChevronUp } from 'lucide-react';

// Ícones SVG minimalistas para substituir os emojis
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
    <line x1="2" x2="22" y1="2" y2="22"/>
  </svg>
);

export default function LeagueHub({ userColor, currentUserId, isAdmin, isVip }: any) {
  const supabase = createClient();
  const [showCode, setShowCode] = useState(false);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leagues' | 'hub'>('leagues');
  
  const [allLeagues, setAllLeagues] = useState<any[]>([]);
  const [myLeagues, setMyLeagues] = useState<any[]>([]);
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allGuesses, setAllGuesses] = useState<any[]>([]);
  const [gamesMap, setGamesMap] = useState<Record<string, any>>({});
  const [gamesByWeek, setGamesByWeek] = useState<Record<string, any[]>>({});
  const [teamsMap, setTeamsMap] = useState<Record<string, any>>({});
  const [leagueMembersMap, setLeagueMembersMap] = useState<Record<string, string[]>>({});
  
  const [championships, setChampionships] = useState<any[]>([]);

  const [displayedLeaderboard, setDisplayedLeaderboard] = useState<any[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [modalInput, setModalInput] = useState('');
  const [isPrivateLeague, setIsPrivateLeague] = useState(true);
  
  const [useExact, setUseExact] = useState(true);
  const [ptsExact, setPtsExact] = useState<string | number>('7');
  const [useDiff, setUseDiff] = useState(true);
  const [ptsDiff, setPtsDiff] = useState<string | number>('5');
  const [useWinner, setUseWinner] = useState(true);
  const [ptsWinner, setPtsWinner] = useState<string | number>('3');
  
  const [targetJoinLeague, setTargetJoinLeague] = useState<any | null>(null);
  const [modalError, setModalError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);

    const [{ data: teams }, { data: games }] = await Promise.all([
      supabase.from('teams').select('*'),
      supabase.from('games').select('*').order('game_time', { ascending: true })
    ]);

    const tMap: Record<string, any> = {};
    teams?.forEach(t => { tMap[t.id.toString()] = { name: t.name, abbr: t.abbreviation, logo: t.logo_url }; });
    setTeamsMap(tMap);

    const gMap: Record<string, any> = {};
    const groupedGames: Record<string, any[]> = {};
    games?.forEach(g => {
      gMap[g.id.toString()] = g;
      let w = g.week || '1';
      if (!groupedGames[w]) groupedGames[w] = [];
      groupedGames[w].push(g);
    });
    setGamesMap(gMap);
    setGamesByWeek(groupedGames);

    const [{ data: leagues }, { data: members }, { data: users }, { data: guesses }, { data: champs }] = await Promise.all([
      supabase.from('leagues').select('*').order('created_at', { ascending: false }),
      supabase.from('league_members').select('*'),
      supabase.from('profiles').select('id, nickname, score, global_titles, is_test, teams ( logo_url, abbreviation )'),
      supabase.from('guesses').select('*'),
      supabase.from('championships').select('*')
    ]);

    setAllLeagues(leagues || []);
    setAllUsers((users || []).filter(u => !u.is_test));
    setAllGuesses(guesses || []);
    setChampionships(champs || []);

    const lMap: Record<string, string[]> = {};
    const myTempLeagues: any[] = [];
    
    members?.forEach((m: any) => {
      if (!lMap[m.league_id]) lMap[m.league_id] = [];
      lMap[m.league_id].push(m.user_id);
      
      if (m.user_id === currentUserId && leagues) {
        const found = leagues.find(l => l.id === m.league_id);
        if (found) myTempLeagues.push(found);
      }
    });

    setLeagueMembersMap(lMap);
    setMyLeagues(myTempLeagues);
    if (myTempLeagues.length > 0 && !activeLeagueId) setActiveLeagueId(myTempLeagues[0].id);

    setLoading(false);
  };

  useEffect(() => { loadData(); }, [currentUserId]);

  useEffect(() => {
    if (activeTab === 'hub' || !activeLeagueId) {
      setDisplayedLeaderboard([]);
      return;
    }

    const selectedLeague = myLeagues.find(l => l.id === activeLeagueId);
    const rules = {
      exact: selectedLeague?.pts_exact ?? 7,
      diff: selectedLeague?.pts_diff ?? 5,
      winner: selectedLeague?.pts_winner ?? 3
    };

    const validMemberIds = leagueMembersMap[activeLeagueId] || [];
    const membersData = allUsers.filter(u => validMemberIds.includes(u.id));
    
    const recalculatedLeaderboard = membersData.map((user) => {
      let officialScore = 0;
      let projectedPoints = 0;

      const userGuesses = allGuesses.filter(g => g.user_id === user.id);
      userGuesses.forEach(guess => {
        const game = gamesMap[guess.game_id];
        const res = getPickResult(game, guess, rules);
        if (game?.status === 'finished') officialScore += res.points;
        else if (game?.status === 'in_progress') projectedPoints += res.points;
      });

      return { ...user, officialScore, projectedPoints, totalScore: officialScore + projectedPoints };
    });

    recalculatedLeaderboard.sort((a, b) => b.totalScore - a.totalScore);
    setDisplayedLeaderboard(recalculatedLeaderboard);
  }, [activeLeagueId, activeTab, myLeagues, leagueMembersMap, allUsers, allGuesses, gamesMap]);

  const openCreateModal = () => {
    setModalInput(''); 
    setUseExact(true); setPtsExact('7'); 
    setUseDiff(true); setPtsDiff('5'); 
    setUseWinner(true); setPtsWinner('3'); 
    setIsPrivateLeague(true);
    setModalError(''); 
    setShowCreateModal(true);
  };

  const openEditModal = (league: any) => {
    setActiveLeagueId(league.id);
    setModalInput(league.name);
    setUseExact(league.pts_exact !== null); setPtsExact(league.pts_exact ?? '7');
    setUseDiff(league.pts_diff !== null); setPtsDiff(league.pts_diff ?? '5');
    setUseWinner(league.pts_winner !== null); setPtsWinner(league.pts_winner ?? '3');
    setIsPrivateLeague(league.is_private);
    setModalError('');
    setShowEditModal(true);
  };

  const handleCreateLeague = async () => {
    if (!modalInput.trim()) { setModalError('League name cannot be empty.'); return; }
    const exactVal = useExact ? (parseInt(String(ptsExact)) || 0) : null;
    const diffVal = useDiff ? (parseInt(String(ptsDiff)) || 0) : null;
    const winnerVal = useWinner ? (parseInt(String(ptsWinner)) || 0) : null;
    
    setIsProcessing(true);
    if (!isAdmin) {
      const { count } = await supabase.from('leagues').select('*', { count: 'exact', head: true }).eq('owner_id', currentUserId);
      const limit = isVip ? 10 : 3;
      if (count && count >= limit) { setModalError(`Limit reached! Max ${limit} leagues.`); setIsProcessing(false); return; }
    }
    
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: newLeague, error } = await supabase.from('leagues').insert([{ 
      name: modalInput.trim(), owner_id: currentUserId, invite_code: inviteCode, is_private: isPrivateLeague,
      pts_exact: exactVal, pts_diff: diffVal, pts_winner: winnerVal
    }]).select().single();
    
    if (error) { setModalError('Error creating league.'); setIsProcessing(false); return; }
    
    await supabase.from('league_members').insert({ league_id: newLeague.id, user_id: currentUserId });
    setShowCreateModal(false); 
    setActiveLeagueId(newLeague.id); 
    setActiveTab('leagues'); 
    showToast("League created!", "success");
    await loadData(); 
    setIsProcessing(false);
  };

  const handleEditLeague = async () => {
    if (!activeLeagueId) return;
    setIsProcessing(true);
    const exactVal = useExact ? (parseInt(String(ptsExact)) || 0) : null;
    const diffVal = useDiff ? (parseInt(String(ptsDiff)) || 0) : null;
    const winnerVal = useWinner ? (parseInt(String(ptsWinner)) || 0) : null;
    
    const { error } = await supabase.from('leagues').update({ 
      name: modalInput.trim(), is_private: isPrivateLeague, pts_exact: exactVal, pts_diff: diffVal, pts_winner: winnerVal 
    }).eq('id', activeLeagueId);
    
    if (error) showToast("Error updating league.", "error");
    else { showToast("League rules updated!", "success"); setShowEditModal(false); loadData(); }
    setIsProcessing(false);
  };

  const handleDeleteLeague = async () => {
    if (!activeLeagueId) return;
    setIsProcessing(true);
    const { error } = await supabase.from('leagues').delete().eq('id', activeLeagueId);
    if (error) showToast("Error deleting league.", "error");
    else { showToast("League deleted.", "success"); setActiveLeagueId(null); setShowEditModal(false); loadData(); }
    setIsProcessing(false);
  };

  const executeJoin = async (leagueId: string, leagueName: string) => {
    setIsProcessing(true);
    const { error } = await supabase.from('league_members').insert({ league_id: leagueId, user_id: currentUserId });
    if (error) showToast("Error joining league.", "error");
    else { setShowJoinModal(false); setActiveLeagueId(leagueId); setActiveTab('leagues'); showToast(`Joined ${leagueName}!`, "success"); await loadData(); }
    setIsProcessing(false);
  };

  const onHubJoinClick = (league: any) => {
    if (myLeagues.some(l => l.id === league.id)) return showToast("Already in this league!", "error");
    if ((leagueMembersMap[league.id]?.length || 0) >= 10) return showToast("League is full.", "error");
    if (league.is_private) { 
      setTargetJoinLeague(league); 
      setModalInput(''); 
      setModalError(''); 
      setShowJoinModal(true); 
    } else {
      executeJoin(league.id, league.name);
    }
  };

  const handleJoinSubmit = async () => {
    setIsProcessing(true); // Bloqueia os botões para evitar duplo clique
    setModalError('');

    if (targetJoinLeague) {
      // Cenário 1: Clicou em uma liga privada pelo Hub
      if (modalInput.trim().toUpperCase() !== targetJoinLeague.invite_code) { 
        setModalError('Incorrect Password.'); 
        setIsProcessing(false);
        return; 
      }
      await executeJoin(targetJoinLeague.id, targetJoinLeague.name);
    } else {
      // Cenário 2: Digitou o código manualmente no botão "Join Code"
      const code = modalInput.trim().toUpperCase();

      if (code.length !== 6) {
        setModalError('Code must be 6 characters.');
        setIsProcessing(false);
        return;
      }

      // 1. Tenta achar na memória primeiro (mais rápido)
      let target = allLeagues.find(l => l.invite_code === code);

      // 2. Se não achar na memória, busca direto no Banco de Dados (À prova de falhas)
      if (!target) {
        const { data, error } = await supabase
          .from('leagues')
          .select('*')
          .eq('invite_code', code)
          .single();

        if (error || !data) { 
          setModalError('Invalid invite code.'); 
          setIsProcessing(false);
          return; 
        }
        target = data; // Atualiza o alvo com o dado real do banco
      }

      // Verifica se o usuário já não está dentro da liga
      if (myLeagues.some(l => l.id === target.id)) { 
        setModalError('Already in this league.'); 
        setIsProcessing(false);
        return; 
      }

      // Faz uma contagem precisa no banco para garantir que a liga não lotou no último segundo
      const { count } = await supabase
        .from('league_members')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', target.id);

      if ((count || 0) >= 10) { 
        setModalError('League is full.'); 
        setIsProcessing(false);
        return; 
      }

      // Tudo certo? Executa a entrada!
      await executeJoin(target.id, target.name);
    }
  };

  const handleKickMember = async (targetUserId: string) => {
    if (!activeLeagueId) return;
    const { error } = await supabase.from('league_members').delete().eq('league_id', activeLeagueId).eq('user_id', targetUserId);
    if (!error) { showToast("Player removed.", "success"); setExpandedUserId(null); await loadData(); } 
    else showToast("Error removing player.", "error");
  };

  const selectedLeague = myLeagues.find(l => l.id === activeLeagueId);
  const myGuessesUser = allGuesses.filter(g => g.user_id === currentUserId);

  if (loading) return <div className="py-20 text-center animate-pulse text-gray-500 uppercase font-black tracking-widest text-xs">Loading Leagues...</div>;

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-slideDown">
          <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md border ${toast.type === 'success' ? 'bg-[#10b981]/20 border-[#10b981]/50 text-[#10b981]' : 'bg-[#ef4444]/20 border-[#ef4444]/50 text-[#ef4444]'}`}>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}

      {/* TOP TABS & ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex bg-neutral-900 border border-white/10 rounded-xl p-1 w-full max-w-sm">
          <button onClick={() => { setActiveTab('leagues'); setExpandedUserId(null); if (!activeLeagueId && myLeagues.length > 0) setActiveLeagueId(myLeagues[0].id); }} className={`flex-1 px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'leagues' ? 'bg-white/10 text-white' : 'text-gray-500'}`} style={activeTab === 'leagues' ? { color: userColor } : {}}><Shield size={14} /> My Leagues</button>
          <button onClick={() => { setActiveTab('hub'); setExpandedUserId(null); }} className={`flex-1 px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'hub' ? 'bg-white/10 text-white' : 'text-gray-500'}`} style={activeTab === 'hub' ? { color: userColor } : {}}><Landmark size={14} /> League Hub</button>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button onClick={() => { setTargetJoinLeague(null); setModalInput(''); setModalError(''); setShowJoinModal(true); }} className="flex-1 sm:flex-none px-4 py-2 bg-black/60 border border-white/10 rounded-xl text-[10px] font-black uppercase text-gray-300 transition-colors hover:bg-white/5">Join Code</button>
          <button onClick={openCreateModal} className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase text-black transition-transform hover:scale-105" style={{ backgroundColor: userColor }}>+ Create</button>
        </div>
      </div>

      {/* TAB: MY LEAGUES */}
      {activeTab === 'leagues' && selectedLeague && (
        <div className="bg-neutral-900/40 border border-white/5 rounded-xl p-4 animate-fadeIn">
          
          {/* LEAGUE CARDS */}
          <div className="flex items-stretch gap-3 overflow-x-auto pb-4 w-full no-scrollbar border-b border-white/5 mb-4">
            {myLeagues.length === 0 ? (
              <span className="text-xs font-bold text-gray-500 uppercase">No leagues yet.</span>
            ) : (
              myLeagues.map(league => {
                const membersInLeague = leagueMembersMap[league.id] || [];
                const usersInLeague = allUsers.filter(u => membersInLeague.includes(u.id));
                const rules = { exact: league.pts_exact ?? 7, diff: league.pts_diff ?? 5, winner: league.pts_winner ?? 3 };
                
                const sorted = usersInLeague.map(u => {
                  let score = 0;
                  allGuesses.filter(g => g.user_id === u.id).forEach(guess => {
                    const game = gamesMap[guess.game_id];
                    if (game) score += getPickResult(game, guess, rules).points;
                  });
                  return { id: u.id, score };
                }).sort((a, b) => b.score - a.score);

                const userIndex = sorted.findIndex(u => u.id === currentUserId);
                const pos = userIndex + 1;
                const posSuffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
                const rankDisplay = userIndex !== -1 ? `${pos}${posSuffix}` : '';

                const isActive = activeLeagueId === league.id;
                const isThisOwner = league.owner_id === currentUserId;
                const membersCount = membersInLeague.length;

                return (
                  <div 
                    key={league.id} 
                    onClick={() => { setActiveLeagueId(league.id); setExpandedUserId(null); setShowCode(false); }} 
                    className={`shrink-0 w-56 p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${isActive ? 'bg-white/10 shadow-lg' : 'bg-black/40 border-white/5 hover:bg-white/5'}`} 
                    style={isActive ? { borderColor: userColor } : {}}
                  >
                    <div>
                      {/* TOP ROW: NAME + RANK */}
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <span className={`font-black uppercase text-sm truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>
                          {league.name}
                        </span>
                        {rankDisplay && (
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-500'} shrink-0`}>
                            {rankDisplay}
                          </span>
                        )}
                      </div>
                      
                      {/* BOTTOM ROW: PRIVACY, PLAYERS, EDIT */}
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                        <div className="flex items-center gap-1.5">
                          <span className={league.is_private ? 'text-amber-500/80' : 'text-green-500/80'}>
                            {league.is_private ? <Lock size={12} /> : <LockOpen size={12} />}
                          </span>
                          <span className={isActive ? 'text-gray-300' : 'text-gray-600'}>
                            {membersCount}/10
                          </span>
                        </div>
                        
                        {isThisOwner && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); openEditModal(league); }} 
                            className="text-gray-500 hover:text-white transition-colors"
                            title="Edit League"
                          >
                            <Settings size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ACTIVE OWNER: INVITE CODE EXPANSION - SEMPRE DO MESMO TAMANHO */}
                    {isActive && isThisOwner && (
                      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between animate-fadeIn min-h-[44px]">
                        {league.is_private ? (
                          <>
                            <div className="flex flex-col">
                              <span className="text-[8px] text-gray-500 uppercase tracking-widest leading-none mb-1">Invite Code</span>
                              <span className="text-sm font-black text-white tracking-widest font-mono leading-none mt-0.5">
                                {showCode ? league.invite_code : '••••••'}
                              </span>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setShowCode(!showCode); }} 
                              className="text-gray-400 hover:text-white transition-all bg-black/40 p-1.5 rounded-md flex items-center justify-center shrink-0"
                              title={showCode ? "Hide Code" : "Show Code"}
                            >
                              {showCode ? <EyeIcon /> : <EyeOffIcon />}
                            </button>
                          </>
                        ) : (
                          <div className="flex flex-col w-full justify-center">
                            <span className="text-[8px] text-gray-500 uppercase tracking-widest leading-none mb-1">Invite Code</span>
                            <span className="text-[10px] font-bold text-green-500/80 uppercase tracking-widest italic leading-none mt-0.5">
                              Open (No Password)
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* LEADERBOARD TABLE */}
          <div className="bg-neutral-900/50 rounded-xl border border-white/5 overflow-hidden shadow-lg">
            {displayedLeaderboard.length === 0 ? (
              <div className="p-10 text-center">
                <span className="text-gray-500 text-xs font-bold uppercase">Nobody is here yet.</span>
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
                      const posColor = index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-700' : 'text-gray-600';

                      const globalWins = user.global_titles || 0;
                      const leagueWinsCount = championships.filter(c => c.league_id === activeLeagueId && c.winner_id === user.id).length;
                      
                      const isOwnerCurrentLeague = selectedLeague?.owner_id === currentUserId;

                      return (
                        <React.Fragment key={user.id}>
                          <tr onClick={() => !isCurrentUser && setExpandedUserId(isExpanded ? null : user.id)} className={`transition-colors ${!isCurrentUser ? 'cursor-pointer hover:bg-white/[0.05]' : ''} ${isCurrentUser ? 'bg-white/5' : ''}`}>
                            <td className="px-4 py-4 text-center"><span className={`text-sm font-black ${posColor}`}>{index + 1}</span></td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                {user.teams?.logo_url ? <img src={user.teams.logo_url} className="w-6 h-6 object-contain" alt="" /> : <div className="w-6 h-6" />}
                                <span className={`font-bold text-sm ${isCurrentUser ? 'text-white' : 'text-gray-300'}`}>{user.nickname}</span>
                                
                                <div className="flex gap-1 ml-1 items-center shrink-0">
                                  {globalWins > 0 && <span className="text-[8px] uppercase font-black px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30 tracking-widest inline-flex items-center gap-1"><Crown size={9} /> x{globalWins}</span>}
                                  {leagueWinsCount > 0 && <span className="text-[8px] uppercase font-black px-1.5 py-0.5 bg-slate-500/20 text-slate-300 rounded border border-slate-400/30 tracking-widest inline-flex items-center gap-1"><Star size={9} /> x{leagueWinsCount}</span>}
                                </div>
                                {selectedLeague?.owner_id === user.id && <span className="text-[8px] uppercase font-black px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 ml-2 inline-flex items-center"><Crown size={10} /></span>}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="font-black text-base text-white">{user.totalScore}</span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex justify-end gap-2">
                                {isOwnerCurrentLeague && !isCurrentUser && <button onClick={(e) => { e.stopPropagation(); handleKickMember(user.id); }} className="px-2 py-1 rounded text-[8px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 inline-flex items-center gap-1">Kick <X size={10} /></button>}
                                {!isCurrentUser && <button className="flex items-center gap-1 text-[8px] font-black uppercase px-2 py-1 rounded" style={{ backgroundColor: `${userColor}20`, color: userColor }}>{isExpanded ? <>Hide <ChevronUp size={10} /></> : <>Spy <Eye size={10} /></>}</button>}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <SpyLockerRoom 
                              targetUserId={user.id} targetNickname={user.nickname} userColor={userColor} 
                              gamesByWeek={gamesByWeek} teamsMap={teamsMap} myGuesses={myGuessesUser} 
                              rules={{ exact: selectedLeague?.pts_exact ?? null, diff: selectedLeague?.pts_diff ?? null, winner: selectedLeague?.pts_winner ?? null }} 
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
      )}

      {/* TAB: LEAGUE HUB */}
      {activeTab === 'hub' && (
        <div className="animate-fadeIn grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allLeagues.map(league => {
            const count = leagueMembersMap[league.id]?.length || 0;
            const isMember = myLeagues.some(l => l.id === league.id);
            const isHubOwner = league.owner_id === currentUserId;
            const ownerName = allUsers.find(u => u.id === league.owner_id)?.nickname || 'Unknown';
            
            return (
              <div key={league.id} className="bg-neutral-900/50 border border-white/5 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 overflow-hidden pr-2">
                      <h3 className="text-lg font-black uppercase tracking-wider text-white truncate">{league.name}</h3>
                      {isHubOwner && (
                        <button onClick={() => openEditModal(league)} className="text-gray-500 hover:text-white transition-colors shrink-0"><Settings size={14} /></button>
                      )}
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border shrink-0 ${league.is_private ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
                      {league.is_private ? <span className="inline-flex items-center gap-1"><Lock size={10} /> Private</span> : <span className="inline-flex items-center gap-1"><LockOpen size={10} /> Public</span>}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Owner: {ownerName}</p>
                </div>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                  <span className="text-xs font-black text-gray-400">{count} / 10 Players</span>
                  {isMember ? (
                    <button disabled className="text-[10px] font-black uppercase px-4 py-2 rounded-xl bg-white/5 text-gray-500 border border-white/5">Joined</button>
                  ) : count >= 10 ? (
                    <button disabled className="text-[10px] font-black uppercase px-4 py-2 rounded-xl bg-red-950 text-red-500 border border-red-900">Full</button>
                  ) : (
                    <button onClick={() => onHubJoinClick(league)} className="text-[10px] font-black uppercase px-4 py-2 rounded-xl text-black transition-transform hover:scale-105" style={{ backgroundColor: userColor }}>
                      {league.is_private ? 'Unlock' : 'Join'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAIS (RENDERIZADOS NO FINAL PARA EVITAR BUGS DE Z-INDEX) ================= */}

      {/* 1. MODAL DE EDIÇÃO */}
      {showEditModal && selectedLeague && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-neutral-950 border border-white/10 p-6 rounded-3xl w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-black italic uppercase tracking-widest text-white mb-6">Edit {selectedLeague.name}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">League Name</label>
                <input type="text" value={modalInput} onChange={(e) => setModalInput(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none" />
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 rounded-xl border border-white/5">
                <input type="checkbox" checked={!isPrivateLeague} onChange={() => setIsPrivateLeague(!isPrivateLeague)} className="w-4 h-4 accent-white" />
                <span className="text-xs font-black uppercase text-white tracking-widest">Public League</span>
              </label>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Scoring Rules</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Exact', val: ptsExact, set: setPtsExact }, 
                    { label: 'Diff', val: ptsDiff, set: setPtsDiff }, 
                    { label: 'Winner', val: ptsWinner, set: setPtsWinner }
                  ].map((item) => (
                    <div key={item.label} className="bg-black border border-white/5 p-2 rounded-xl flex flex-col items-center">
                      <span className="text-[8px] font-black text-gray-500 uppercase mb-1">{item.label}</span>
                      <input type="number" value={item.val} onChange={(e) => item.set(e.target.value)} className="w-full bg-transparent text-center font-black text-sm text-white focus:outline-none" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {modalError && <p className="text-red-500 text-[10px] font-black uppercase mt-4 text-center">{modalError}</p>}

            <div className="flex gap-3 mt-6">
              <button disabled={isProcessing} onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-white/5 rounded-xl text-xs font-black uppercase text-white hover:bg-white/10 transition">Cancel</button>
              <button disabled={isProcessing} onClick={handleEditLeague} className="flex-1 py-3 rounded-xl text-xs font-black uppercase text-black transition" style={{ backgroundColor: userColor }}>{isProcessing ? '...' : 'Save'}</button>
            </div>
            
            <button disabled={isProcessing} onClick={handleDeleteLeague} className="w-full mt-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-500/70 hover:text-red-400 transition">Drop League</button>
          </div>
        </div>
      )}

      {/* 2. MODAL DE CRIAÇÃO */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-neutral-950 border border-white/10 p-6 rounded-3xl w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-black italic uppercase tracking-widest text-white mb-6">Create League</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">League Name</label>
                <input type="text" placeholder="e.g. Office Pool" value={modalInput} onChange={(e) => setModalInput(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none" />
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 rounded-xl border border-white/5">
                <input type="checkbox" checked={!isPrivateLeague} onChange={() => setIsPrivateLeague(!isPrivateLeague)} className="w-4 h-4 accent-white" />
                <span className="text-xs font-black uppercase text-white tracking-widest">Make it Public</span>
              </label>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Scoring Rules</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Exact', val: ptsExact, set: setPtsExact }, 
                    { label: 'Diff', val: ptsDiff, set: setPtsDiff }, 
                    { label: 'Winner', val: ptsWinner, set: setPtsWinner }
                  ].map((item) => (
                    <div key={item.label} className="bg-black border border-white/5 p-2 rounded-xl flex flex-col items-center">
                      <span className="text-[8px] font-black text-gray-500 uppercase mb-1">{item.label}</span>
                      <input type="number" value={item.val} onChange={(e) => item.set(e.target.value)} className="w-full bg-transparent text-center font-black text-sm text-white focus:outline-none" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {modalError && <p className="text-red-500 text-[10px] font-black uppercase mt-4 text-center">{modalError}</p>}

            <div className="flex gap-3 mt-8">
              <button disabled={isProcessing} onClick={() => setShowCreateModal(false)} className="flex-1 py-3 bg-white/5 rounded-xl text-xs font-black uppercase text-white hover:bg-white/10 transition">Cancel</button>
              <button disabled={isProcessing} onClick={handleCreateLeague} className="flex-1 py-3 rounded-xl text-xs font-black uppercase text-black transition" style={{ backgroundColor: userColor }}>{isProcessing ? '...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL DE JOIN (GENÉRICO OU ESPECÍFICO) */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-neutral-950 border border-white/10 p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center">
            <h2 className="text-2xl font-black italic uppercase tracking-wider text-white mb-2">Join League</h2>
            
            {targetJoinLeague ? (
              <>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">League: <span className="text-white">{targetJoinLeague.name}</span></p>
                <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest mb-4 flex items-center justify-center gap-2"><Lock size={12} /> Private League. Enter password.</p>
              </>
            ) : (
              <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-6">Enter the 6-character Invite Code.</p>
            )}

            <input 
              type="text" 
              maxLength={6} 
              placeholder="CODE" 
              value={modalInput} 
              onChange={(e) => setModalInput(e.target.value.toUpperCase())} 
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-white font-black tracking-[0.5em] uppercase text-center focus:outline-none focus:border-white/30 transition-colors mb-2 text-xl" 
            />
            
            {modalError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mt-2">{modalError}</p>}
            
            <div className="flex gap-3 mt-6">
              <button disabled={isProcessing} onClick={() => { setShowJoinModal(false); setTargetJoinLeague(null); }} className="flex-1 py-3 bg-white/5 rounded-xl text-xs font-black uppercase text-white hover:bg-white/10 transition">Cancel</button>
              <button disabled={isProcessing} onClick={handleJoinSubmit} className="flex-1 py-3 rounded-xl text-xs font-black uppercase text-black transition" style={{ backgroundColor: userColor }}>{isProcessing ? '...' : 'Join'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}