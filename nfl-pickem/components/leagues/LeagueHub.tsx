"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getPickResult } from '@/utils/scoring';
import SpyLockerRoom from '../scoreboard/SpyLockerRoom';
import { Shield, Landmark, Lock, LockOpen, Settings, Crown, Star, X, Eye, ChevronUp, Users, ChevronRight, Copy, Check, AlertTriangle } from 'lucide-react';

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
  const [copiedCode, setCopiedCode] = useState(false);

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // NOVO ESTADO
  
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

  const executeDeleteLeague = async () => {
    if (!activeLeagueId) return;
    setIsProcessing(true);
    const { error } = await supabase.from('leagues').delete().eq('id', activeLeagueId);
    if (error) {
      showToast("Error processing request.", "error");
    } else { 
      showToast("League dropped.", "success"); 
      setActiveLeagueId(null); 
      setShowEditModal(false); 
      setShowDeleteConfirm(false);
      loadData(); 
    }
    setIsProcessing(false);
  };

  const executeLeaveLeague = async () => {
    if (!activeLeagueId) return;
    setIsProcessing(true);
    const { error } = await supabase.from('league_members').delete().match({ league_id: activeLeagueId, user_id: currentUserId });
    if (error) {
      showToast("Error leaving league.", "error");
    } else { 
      showToast("You left the league.", "success"); 
      setActiveLeagueId(null); 
      setShowEditModal(false); 
      setShowDeleteConfirm(false);
      loadData(); 
    }
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
    setIsProcessing(true);
    setModalError('');

    if (targetJoinLeague) {
      if (modalInput.trim().toUpperCase() !== targetJoinLeague.invite_code) { 
        setModalError('Incorrect Password.'); 
        setIsProcessing(false);
        return; 
      }
      await executeJoin(targetJoinLeague.id, targetJoinLeague.name);
    } else {
      const code = modalInput.trim().toUpperCase();

      if (code.length !== 6) {
        setModalError('Code must be 6 characters.');
        setIsProcessing(false);
        return;
      }

      let target = allLeagues.find(l => l.invite_code === code);

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
        target = data;
      }

      if (myLeagues.some(l => l.id === target.id)) { 
        setModalError('Already in this league.'); 
        setIsProcessing(false);
        return; 
      }

      const { count } = await supabase
        .from('league_members')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', target.id);

      if ((count || 0) >= 10) { 
        setModalError('League is full.'); 
        setIsProcessing(false);
        return; 
      }

      await executeJoin(target.id, target.name);
    }
  };

  const handleKickMember = async (targetUserId: string) => {
    if (!activeLeagueId) return;
    const { error } = await supabase.from('league_members').delete().eq('league_id', activeLeagueId).eq('user_id', targetUserId);
    if (!error) { showToast("Player removed.", "success"); setExpandedUserId(null); await loadData(); } 
    else showToast("Error removing player.", "error");
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const selectedLeague = myLeagues.find(l => l.id === activeLeagueId);
  const myGuessesUser = allGuesses.filter(g => g.user_id === currentUserId);

  if (loading) return <div className="py-20 text-center animate-pulse font-sans text-gray-500 uppercase font-black tracking-widest text-xs">Loading Leagues...</div>;

  return (
    <div className="space-y-6 relative font-sans">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-slideDown">
          <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-xl border ${toast.type === 'success' ? 'bg-[#10b981]/20 border-[#10b981]/50 text-[#10b981]' : 'bg-[#ef4444]/20 border-[#ef4444]/50 text-[#ef4444]'}`}>
            <span className="font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}

      {/* TOP TABS & ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 w-full max-w-sm shadow-xl">
          <button 
            onClick={() => { setActiveTab('leagues'); setExpandedUserId(null); if (!activeLeagueId && myLeagues.length > 0) setActiveLeagueId(myLeagues[0].id); }} 
            className={`flex-1 px-4 py-3 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'leagues' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`} 
            style={activeTab === 'leagues' ? { color: userColor, boxShadow: `inset 0 -4px 0 ${userColor}` } : {}}
          >
            <Shield size={16} /> My Leagues
          </button>
          <button 
            onClick={() => { setActiveTab('hub'); setExpandedUserId(null); }} 
            className={`flex-1 px-4 py-3 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'hub' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`} 
            style={activeTab === 'hub' ? { color: userColor, boxShadow: `inset 0 -4px 0 ${userColor}` } : {}}
          >
            <Landmark size={16} /> League Hub
          </button>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          <button 
            onClick={() => { setTargetJoinLeague(null); setModalInput(''); setModalError(''); setShowJoinModal(true); }} 
            className="flex-1 sm:flex-none px-5 py-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl font-sans text-[10px] font-black uppercase text-gray-300 transition-all hover:bg-white/10 shadow-lg"
          >
            Join Code
          </button>
          <button 
            onClick={openCreateModal} 
            className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-sport font-bold text-sm uppercase tracking-wider text-black transition-transform hover:scale-105 shadow-xl" 
            style={{ backgroundColor: userColor, boxShadow: `0 0 20px ${userColor}50` }}
          >
            + Create
          </button>
        </div>
      </div>

      {/* TAB: MY LEAGUES - NOVO DESIGN EM COLUNAS */}
      {activeTab === 'leagues' && (
        <div className="flex flex-col lg:flex-row gap-6 animate-fadeIn items-start">
          
          {/* COLUNA ESQUERDA: LISTA DE LIGAS */}
          <div className="w-full lg:w-1/3 space-y-4">
            {myLeagues.length === 0 ? (
              <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center shadow-xl">
                <span className="font-sans text-xs font-black text-gray-500 uppercase tracking-widest">No leagues yet.</span>
              </div>
            ) : (
              <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-2 shadow-xl flex flex-col gap-1 max-h-[600px] overflow-y-auto custom-scrollbar">
                {myLeagues.map(league => {
                  const membersInLeague = leagueMembersMap[league.id] || [];
                  const rules = { exact: league.pts_exact ?? 7, diff: league.pts_diff ?? 5, winner: league.pts_winner ?? 3 };
                  const usersInLeague = allUsers.filter(u => membersInLeague.includes(u.id));
                  
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
                  const posSuffix = pos === 1 ? 'ST' : pos === 2 ? 'ND' : pos === 3 ? 'RD' : 'TH';
                  const rankDisplay = userIndex !== -1 ? `${pos}${posSuffix}` : '';

                  const isActive = activeLeagueId === league.id;
                  const isThisOwner = league.owner_id === currentUserId;
                  const membersCount = membersInLeague.length;

                  return (
                    <button 
                      key={league.id} 
                      onClick={() => { setActiveLeagueId(league.id); setExpandedUserId(null); setShowCode(false); }} 
                      className={`w-full p-4 rounded-2xl transition-all flex items-center justify-between text-left group border ${isActive ? 'bg-white/10 shadow-md' : 'bg-transparent border-transparent hover:bg-white/[0.04]'}`} 
                      style={isActive ? { borderColor: userColor, boxShadow: `0 0 15px ${userColor}30` } : {}}
                    >
                      <div className="flex flex-col min-w-0 pr-3">
                        <span className={`font-sport font-bold text-sm uppercase tracking-wider truncate mb-1 transition-colors ${isActive ? 'text-white drop-shadow-sm' : 'text-gray-400 group-hover:text-gray-300'}`}>
                          {league.name}
                        </span>
                        <div className="flex items-center gap-3 font-sans text-[9px] font-black uppercase tracking-widest">
                          <span className="text-gray-500 flex items-center gap-1">
                            <Users size={10} /> {membersCount}/10
                          </span>
                          <span className={league.is_private ? 'text-amber-500/80 flex items-center gap-1' : 'text-green-500/80 flex items-center gap-1'}>
                            {league.is_private ? <Lock size={10} /> : <LockOpen size={10} />}
                            {league.is_private ? 'Priv' : 'Pub'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {rankDisplay && (
                          <span className={`font-jersey text-base px-2 py-0.5 rounded-lg leading-none pt-1 transition-colors ${isActive ? 'bg-white/20 text-white' : 'bg-black/40 text-gray-500 border border-white/5 group-hover:text-gray-400'}`}>
                            {rankDisplay}
                          </span>
                        )}
                        {isThisOwner && (
                          <span className="font-sans text-[8px] font-black text-amber-500 tracking-widest uppercase flex items-center gap-1">
                            <Crown size={9} /> Admin
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* COLUNA DIREITA: DASHBOARD DA LIGA SELECIONADA */}
          <div className="w-full lg:w-2/3">
            {selectedLeague ? (
              <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-8 animate-fadeIn shadow-2xl flex flex-col h-full relative overflow-hidden">
                
                {/* Linha Fina Decorativa Topo */}
                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: userColor }} />
                
                {/* Cabeçalho da Liga (Dashboard) */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                  <div className="flex flex-col">
                    <h2 className="font-sport font-bold text-2xl sm:text-3xl text-white uppercase tracking-wider drop-shadow-md leading-none mb-2">{selectedLeague.name}</h2>
                    <div className="flex items-center gap-3 font-sans text-[10px] font-black uppercase tracking-widest">
                       <span className="text-gray-400">Created by {selectedLeague.owner_id === currentUserId ? 'You' : (allUsers.find(u => u.id === selectedLeague.owner_id)?.nickname || 'Unknown')}</span>
                       <span className="text-gray-600">|</span>
                       <span className="text-gray-400">{leagueMembersMap[selectedLeague.id]?.length || 0} Players</span>
                    </div>
                  </div>
                  
                  {/* Mudança: Edit Settings se for dono. Ou "Leave" se não for dono */}
                  <div className="flex items-center gap-2">
                    {selectedLeague.owner_id === currentUserId ? (
                      <button onClick={() => openEditModal(selectedLeague)} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2 shadow-sm">
                        <Settings size={14} /> Settings
                      </button>
                    ) : (
                      <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-2 shadow-sm">
                         Leave League
                      </button>
                    )}
                  </div>
                </div>

                {/* Dashboard Stats / Rules */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                  <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col justify-center shadow-inner">
                    <span className="font-sans text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1">Exact Score Pts</span>
                    <span className="font-jersey text-2xl text-green-400 drop-shadow-sm leading-none">{selectedLeague.pts_exact ?? 7}</span>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col justify-center shadow-inner">
                    <span className="font-sans text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1">Diff / Margin Pts</span>
                    <span className="font-jersey text-2xl text-blue-400 drop-shadow-sm leading-none">{selectedLeague.pts_diff ?? 5}</span>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col justify-center shadow-inner">
                    <span className="font-sans text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1">Correct Winner Pts</span>
                    <span className="font-jersey text-2xl text-amber-400 drop-shadow-sm leading-none">{selectedLeague.pts_winner ?? 3}</span>
                  </div>
                  
                  {selectedLeague.owner_id === currentUserId && selectedLeague.is_private && (
                    <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col justify-center relative group overflow-hidden">
                       <span className="font-sans text-[8px] font-black uppercase tracking-widest text-amber-500 mb-1 flex items-center gap-1"><Lock size={10} /> Invite Code</span>
                       <div className="flex items-center justify-between">
                         <span className="font-jersey text-2xl text-white tracking-widest leading-none drop-shadow-md">
                           {showCode ? selectedLeague.invite_code : '••••••'}
                         </span>
                         <div className="flex items-center gap-1">
                           <button onClick={() => setShowCode(!showCode)} className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors">
                             {showCode ? <EyeOffIcon /> : <EyeIcon />}
                           </button>
                           {showCode && (
                             <button onClick={() => handleCopyCode(selectedLeague.invite_code)} className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors">
                               {copiedCode ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                             </button>
                           )}
                         </div>
                       </div>
                    </div>
                  )}
                  {selectedLeague.owner_id === currentUserId && !selectedLeague.is_private && (
                     <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col justify-center shadow-inner">
                        <span className="font-sans text-[8px] font-black uppercase tracking-widest text-green-500 mb-1 flex items-center gap-1"><LockOpen size={10} /> Privacy Status</span>
                        <span className="font-sport font-bold text-base text-gray-300 uppercase tracking-widest leading-none mt-1">Public Hub</span>
                     </div>
                  )}
                </div>

                {/* LEADERBOARD TABLE */}
                <div className="bg-black/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl flex-1">
                  {displayedLeaderboard.length === 0 ? (
                    <div className="p-12 text-center">
                      <span className="font-sans text-[10px] font-black uppercase tracking-widest text-gray-500">Nobody is here yet.</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left whitespace-nowrap min-w-[550px]">
                        <thead>
                          <tr className="font-sans text-[9px] text-gray-500 uppercase tracking-widest bg-black/90 border-b border-white/10">
                            <th className="px-5 py-4 font-black w-14 text-center">RK</th>
                            <th className="px-5 py-4 font-black">Player</th>
                            <th className="px-5 py-4 font-black text-center w-32">Score</th>
                            <th className="px-5 py-4 font-black text-right w-40">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {displayedLeaderboard.map((user, index) => {
                            const isCurrentUser = user.id === currentUserId;
                            const isExpanded = expandedUserId === user.id;
                            const positionColor = index === 0 ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]' : index === 1 ? 'text-gray-300 drop-shadow-[0_0_8px_rgba(209,213,219,0.4)]' : index === 2 ? 'text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.4)]' : 'text-gray-600';

                            const globalWins = user.global_titles || 0;
                            const leagueWinsCount = championships.filter(c => c.league_id === activeLeagueId && c.winner_id === user.id).length;
                            const isOwnerCurrentLeague = selectedLeague?.owner_id === currentUserId;

                            return (
                              <React.Fragment key={user.id}>
                                <tr onClick={() => !isCurrentUser && setExpandedUserId(isExpanded ? null : user.id)} className={`transition-all ${!isCurrentUser ? 'cursor-pointer hover:bg-white/[0.04]' : ''} ${isCurrentUser ? 'bg-white/5' : ''} ${isExpanded ? 'bg-black/80 shadow-inner' : ''}`}>
                                  <td className="px-5 py-4 text-center">
                                    <span className={`font-jersey text-2xl sm:text-3xl leading-none ${positionColor}`}>{index + 1}</span>
                                  </td>
                                  <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                      {user.teams?.logo_url ? <img src={user.teams.logo_url} className="w-7 h-7 object-contain drop-shadow-md" alt="" /> : <div className="w-7 h-7 bg-white/5 rounded-full" />}
                                      <span className={`font-sport font-bold text-sm sm:text-base uppercase tracking-wider ${isCurrentUser ? 'text-white drop-shadow-md' : 'text-gray-300'}`}>{user.nickname}</span>
                                      
                                      <div className="flex gap-1.5 ml-2 items-center shrink-0">
                                        {globalWins > 0 && <span className="font-sans text-[8px] uppercase font-black px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded border border-yellow-500/20 tracking-widest inline-flex items-center gap-1 shadow-sm"><Crown size={10} /> x{globalWins}</span>}
                                        {leagueWinsCount > 0 && <span className="font-sans text-[8px] uppercase font-black px-1.5 py-0.5 bg-slate-500/10 text-slate-300 rounded border border-slate-400/20 tracking-widest inline-flex items-center gap-1 shadow-sm"><Star size={10} /> x{leagueWinsCount}</span>}
                                      </div>
                                      {selectedLeague?.owner_id === user.id && <span className="text-[8px] uppercase font-black px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20 ml-2 inline-flex items-center"><Crown size={10} /></span>}
                                    </div>
                                  </td>
                                  <td className="px-5 py-4 text-center">
                                    <span className="font-jersey text-2xl sm:text-3xl leading-none pt-1 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">{user.totalScore}</span>
                                  </td>
                                  <td className="px-5 py-4">
                                    <div className="flex justify-end gap-2">
                                      {isOwnerCurrentLeague && !isCurrentUser && (
                                        <button onClick={(e) => { e.stopPropagation(); handleKickMember(user.id); }} className="px-2.5 py-1.5 rounded-lg font-sans text-[8px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 inline-flex items-center gap-1 shadow-sm">
                                          Kick <X size={10} />
                                        </button>
                                      )}
                                      {!isCurrentUser && (
                                        <button className="flex items-center gap-1 font-sans text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-md transition-all border border-white/5" style={{ backgroundColor: `${userColor}20`, color: userColor, borderColor: `${userColor}40` }}>
                                          {isExpanded ? <>Hide <ChevronUp size={12} /></> : <>Spy <Eye size={12} /></>}
                                        </button>
                                      )}
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
            ) : (
              <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-12 text-center h-full flex flex-col justify-center items-center shadow-xl">
                 <Shield size={48} className="text-gray-700 mb-4" />
                 <h2 className="font-sport font-bold text-2xl text-gray-500 uppercase tracking-wider mb-2">Select a League</h2>
                 <p className="font-sans text-xs font-black uppercase tracking-widest text-gray-600">Choose a league from the side menu to view its details and leaderboard.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: LEAGUE HUB */}
      {activeTab === 'hub' && (
        <div className="animate-fadeIn grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {allLeagues.map(league => {
            const count = leagueMembersMap[league.id]?.length || 0;
            const isMember = myLeagues.some(l => l.id === league.id);
            const isHubOwner = league.owner_id === currentUserId;
            const ownerName = allUsers.find(u => u.id === league.owner_id)?.nickname || 'Unknown';
            
            return (
              <div key={league.id} className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-white/20 transition-all">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 overflow-hidden pr-2">
                      <h3 className="font-sport font-bold text-base sm:text-lg uppercase tracking-wider text-white truncate">{league.name}</h3>
                      {isHubOwner && (
                        <button onClick={() => openEditModal(league)} className="text-gray-500 hover:text-white transition-colors shrink-0 p-1"><Settings size={14} /></button>
                      )}
                    </div>
                    <span className={`font-sans text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border shrink-0 shadow-inner ${league.is_private ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                      {league.is_private ? <span className="inline-flex items-center gap-1"><Lock size={10} /> Private</span> : <span className="inline-flex items-center gap-1"><LockOpen size={10} /> Public</span>}
                    </span>
                  </div>
                  <p className="font-sans text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Owner: {ownerName}</p>
                </div>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                  <span className="font-sans text-xs font-black text-gray-400">{count} / 10 Players</span>
                  {isMember ? (
                    <button disabled className="font-sans text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-white/5 text-gray-500 border border-white/5 shadow-inner">Joined</button>
                  ) : count >= 10 ? (
                    <button disabled className="font-sans text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-red-950/50 text-red-500 border border-red-900/50">Full</button>
                  ) : (
                    <button onClick={() => onHubJoinClick(league)} className="font-sport font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl text-black transition-transform hover:scale-105 shadow-xl" style={{ backgroundColor: userColor, boxShadow: `0 0 15px ${userColor}50` }}>
                      {league.is_private ? 'Unlock' : 'Join'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAIS ================= */}

      {/* 1. MODAL DE EDIÇÃO */}
      {showEditModal && selectedLeague && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-black/90 backdrop-blur-2xl border border-white/10 p-6 sm:p-8 rounded-3xl w-full max-w-sm shadow-2xl">
            <h2 className="font-jersey text-3xl uppercase tracking-widest text-white mb-6 drop-shadow-md">EDIT LEAGUE</h2>
            
            <div className="space-y-4">
              <div>
                <label className="font-sans text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">League Name</label>
                <input type="text" value={modalInput} onChange={(e) => setModalInput(e.target.value)} className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white font-sport font-bold focus:outline-none shadow-inner" />
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 rounded-xl border border-white/5 shadow-inner">
                <input type="checkbox" checked={!isPrivateLeague} onChange={() => setIsPrivateLeague(!isPrivateLeague)} className="w-4 h-4 accent-white" />
                <span className="font-sans text-xs font-black uppercase text-white tracking-widest">Public League</span>
              </label>

              <div>
                <label className="font-sans text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Scoring Rules</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Exact', val: ptsExact, set: setPtsExact }, 
                    { label: 'Diff', val: ptsDiff, set: setPtsDiff }, 
                    { label: 'Winner', val: ptsWinner, set: setPtsWinner }
                  ].map((item) => (
                    <div key={item.label} className="bg-black/60 border border-white/5 p-2 rounded-xl flex flex-col items-center shadow-inner">
                      <span className="font-sans text-[8px] font-black text-gray-500 uppercase mb-1">{item.label}</span>
                      <input type="number" value={item.val} onChange={(e) => item.set(e.target.value)} className="w-full bg-transparent text-center font-jersey text-xl text-white focus:outline-none pt-0.5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {modalError && <p className="font-sans text-red-500 text-[10px] font-black uppercase tracking-widest mt-4 text-center">{modalError}</p>}

            <div className="flex gap-3 mt-6">
              <button disabled={isProcessing} onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-white/5 rounded-xl font-sans text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition border border-white/5">Cancel</button>
              <button disabled={isProcessing} onClick={handleEditLeague} className="flex-1 py-3 rounded-xl font-sport font-bold text-sm uppercase tracking-wider text-black transition shadow-xl" style={{ backgroundColor: userColor, boxShadow: `0 0 15px ${userColor}50` }}>{isProcessing ? '...' : 'Save'}</button>
            </div>
            
            <button disabled={isProcessing} onClick={() => setShowDeleteConfirm(true)} className="w-full mt-4 font-sans text-[10px] font-black uppercase tracking-widest text-red-500/70 hover:text-red-400 transition">Drop League</button>
          </div>
        </div>
      )}

      {/* 2. MODAL DE CRIAÇÃO */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-black/90 backdrop-blur-2xl border border-white/10 p-6 sm:p-8 rounded-3xl w-full max-w-sm shadow-2xl">
            <h2 className="font-jersey text-3xl uppercase tracking-widest text-white mb-6 drop-shadow-md">CREATE LEAGUE</h2>
            
            <div className="space-y-4">
              <div>
                <label className="font-sans text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">League Name</label>
                <input type="text" placeholder="e.g. Office Pool" value={modalInput} onChange={(e) => setModalInput(e.target.value)} className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white font-sport font-bold focus:outline-none shadow-inner" />
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 rounded-xl border border-white/5 shadow-inner">
                <input type="checkbox" checked={!isPrivateLeague} onChange={() => setIsPrivateLeague(!isPrivateLeague)} className="w-4 h-4 accent-white" />
                <span className="font-sans text-xs font-black uppercase text-white tracking-widest">Make it Public</span>
              </label>

              <div>
                <label className="font-sans text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Scoring Rules</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Exact', val: ptsExact, set: setPtsExact }, 
                    { label: 'Diff', val: ptsDiff, set: setPtsDiff }, 
                    { label: 'Winner', val: ptsWinner, set: setPtsWinner }
                  ].map((item) => (
                    <div key={item.label} className="bg-black/60 border border-white/5 p-2 rounded-xl flex flex-col items-center shadow-inner">
                      <span className="font-sans text-[8px] font-black text-gray-500 uppercase mb-1">{item.label}</span>
                      <input type="number" value={item.val} onChange={(e) => item.set(e.target.value)} className="w-full bg-transparent text-center font-jersey text-xl text-white focus:outline-none pt-0.5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {modalError && <p className="font-sans text-red-500 text-[10px] font-black uppercase tracking-widest mt-4 text-center">{modalError}</p>}

            <div className="flex gap-3 mt-8">
              <button disabled={isProcessing} onClick={() => setShowCreateModal(false)} className="flex-1 py-3 bg-white/5 rounded-xl font-sans text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition border border-white/5">Cancel</button>
              <button disabled={isProcessing} onClick={handleCreateLeague} className="flex-1 py-3 rounded-xl font-sport font-bold text-sm uppercase tracking-wider text-black transition shadow-xl" style={{ backgroundColor: userColor, boxShadow: `0 0 15px ${userColor}50` }}>{isProcessing ? '...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL DE JOIN */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-black/90 backdrop-blur-2xl border border-white/10 p-6 sm:p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center">
            <h2 className="font-jersey text-3xl uppercase tracking-widest text-white mb-2 drop-shadow-md">JOIN LEAGUE</h2>
            
            {targetJoinLeague ? (
              <>
                <p className="font-sans text-xs font-black uppercase tracking-widest text-gray-400 mb-4">League: <span className="text-white">{targetJoinLeague.name}</span></p>
                <p className="font-sans text-amber-400 text-[10px] font-black uppercase tracking-widest mb-4 flex items-center justify-center gap-1.5"><Lock size={12} /> Private League. Enter password.</p>
              </>
            ) : (
              <p className="font-sans text-gray-400 text-[10px] font-black uppercase tracking-widest mb-6">Enter the 6-character Invite Code.</p>
            )}

            <input 
              type="text" 
              maxLength={6} 
              placeholder="CODE" 
              value={modalInput} 
              onChange={(e) => setModalInput(e.target.value.toUpperCase())} 
              className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-4 text-white font-jersey tracking-[0.4em] uppercase text-center focus:outline-none focus:border-white/30 transition-colors mb-2 text-3xl shadow-inner" 
            />
            
            {modalError && <p className="font-sans text-red-500 text-[10px] font-black uppercase tracking-widest mt-2">{modalError}</p>}
            
            <div className="flex gap-3 mt-6">
              <button disabled={isProcessing} onClick={() => { setShowJoinModal(false); setTargetJoinLeague(null); }} className="flex-1 py-3 bg-white/5 rounded-xl font-sans text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition border border-white/5">Cancel</button>
              <button disabled={isProcessing} onClick={handleJoinSubmit} className="flex-1 py-3 rounded-xl font-sport font-bold text-sm uppercase tracking-wider text-black transition shadow-xl" style={{ backgroundColor: userColor, boxShadow: `0 0 15px ${userColor}50` }}>{isProcessing ? '...' : 'Join'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL DE CONFIRMAÇÃO DE SAÍDA / EXCLUSÃO (NOVO) */}
      {showDeleteConfirm && selectedLeague && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-black/90 backdrop-blur-2xl border border-white/10 p-6 sm:p-8 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5 shadow-inner">
              <AlertTriangle size={28} className="text-red-500 drop-shadow-md" />
            </div>
            <h3 className="font-jersey text-3xl uppercase tracking-widest text-white mb-3 drop-shadow-md">
              {selectedLeague.owner_id === currentUserId ? 'DELETE LEAGUE?' : 'LEAVE LEAGUE?'}
            </h3>
            <p className="font-sans text-[10px] sm:text-xs text-gray-400 mb-8 font-black uppercase tracking-widest leading-relaxed">
              {selectedLeague.owner_id === currentUserId 
                ? 'Are you sure you want to drop this league? This will permanently remove it for all players.' 
                : 'Are you sure you want to leave this league? You will lose your current rank and points associated with it.'}
            </p>
            
            <div className="flex items-center gap-3 w-full">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3.5 rounded-xl font-sans font-black uppercase tracking-widest text-[10px] sm:text-xs transition-colors border border-white/10 text-gray-400 hover:bg-white/[0.02] hover:text-white"
              >
                Cancel
              </button>
              <button 
                onClick={selectedLeague.owner_id === currentUserId ? executeDeleteLeague : executeLeaveLeague}
                disabled={isProcessing}
                className="flex-1 py-3.5 rounded-xl font-sans font-black uppercase tracking-widest text-[10px] sm:text-xs transition-colors bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30 shadow-inner disabled:opacity-50"
              >
                {isProcessing ? 'Wait...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}