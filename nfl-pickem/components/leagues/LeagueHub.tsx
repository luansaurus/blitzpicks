"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getPickResult } from '@/utils/scoring';
import SpyLockerRoom from '../scoreboard/SpyLockerRoom'; // Importando o Componente Limpo!

export default function LeagueHub({ userColor, currentUserId, isAdmin, isVip }: any) {
  const supabase = createClient();

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
  
  const [displayedLeaderboard, setDisplayedLeaderboard] = useState<any[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  
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

    const [{ data: leagues }, { data: members }, { data: users }, { data: guesses }] = await Promise.all([
      supabase.from('leagues').select('*').order('created_at', { ascending: false }),
      supabase.from('league_members').select('*'),
      supabase.from('profiles').select('id, nickname, is_test, teams ( logo_url, abbreviation )'),
      supabase.from('guesses').select('*')
    ]);

    setAllLeagues(leagues || []);
    setAllUsers((users || []).filter(u => !u.is_test));
    setAllGuesses(guesses || []);

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
    setModalError(''); setShowCreateModal(true);
  };

  const openEditModal = (league: any) => {
    setModalInput(league.name);
    setUseExact(league.pts_exact !== null); setPtsExact(league.pts_exact ?? '7');
    setUseDiff(league.pts_diff !== null); setPtsDiff(league.pts_diff ?? '5');
    setUseWinner(league.pts_winner !== null); setPtsWinner(league.pts_winner ?? '3');
    setIsPrivateLeague(league.is_private);
    setModalError(''); setShowEditModal(true);
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

    if (error) { 
      console.error("🔥 SUPABASE ERROR CREATE LEAGUE:", error);
      setModalError('Error creating league. Check browser console.'); 
      setIsProcessing(false); 
      return; 
    }
    
    await supabase.from('league_members').insert({ league_id: newLeague.id, user_id: currentUserId });
    setShowCreateModal(false); setActiveLeagueId(newLeague.id); setActiveTab('leagues'); showToast("League created!", "success");
    await loadData(); setIsProcessing(false);
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
    
    if (error) {
      console.error("🔥 SUPABASE ERROR EDIT LEAGUE:", error);
      showToast("Error updating league.", "error");
    } else { showToast("League rules updated!", "success"); setShowEditModal(false); loadData(); }
    setIsProcessing(false);
  };

  const handleDeleteLeague = async () => {
    if (!activeLeagueId) return;
    setIsProcessing(true);
    const { error } = await supabase.from('leagues').delete().eq('id', activeLeagueId);
    if (error) showToast("Error deleting league.", "error");
    else { showToast("League deleted.", "success"); setActiveLeagueId(null); setDeleteConfirm(false); setShowEditModal(false); loadData(); }
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
    if (league.is_private) { setTargetJoinLeague(league); setModalInput(''); setModalError(''); setShowJoinModal(true); } 
    else executeJoin(league.id, league.name);
  };

  const handleJoinPrivateSubmit = async () => {
    if (!targetJoinLeague) return;
    if (modalInput.trim().toUpperCase() !== targetJoinLeague.invite_code) { setModalError('Incorrect Password.'); return; }
    await executeJoin(targetJoinLeague.id, targetJoinLeague.name);
  };

  const handleKickMember = async (targetUserId: string) => {
    if (!activeLeagueId) return;
    const { error } = await supabase.from('league_members').delete().eq('league_id', activeLeagueId).eq('user_id', targetUserId);
    if (!error) { showToast("Player removed.", "success"); setExpandedUserId(null); await loadData(); } 
    else showToast("Error removing player.", "error");
  };

  const handleNumberChange = (setter: any, value: string) => {
    setter(value === '' ? '' : Number(value));
  };

  const selectedLeague = myLeagues.find(l => l.id === activeLeagueId);
  const isOwner = selectedLeague?.owner_id === currentUserId;
  const myGuessesUser = allGuesses.filter(g => g.user_id === currentUserId);

  if (loading) return <div className="py-20 text-center animate-pulse text-gray-500 uppercase font-black tracking-widest text-xs">Loading Leagues...</div>;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-slideDown">
          <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md border ${toast.type === 'success' ? 'bg-[#10b981]/20 border-[#10b981]/50 text-[#10b981]' : 'bg-[#ef4444]/20 border-[#ef4444]/50 text-[#ef4444]'}`}>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="flex bg-neutral-900 border border-white/10 rounded-xl p-1 w-full max-w-sm">
        <button onClick={() => { setActiveTab('leagues'); setExpandedUserId(null); if (!activeLeagueId && myLeagues.length > 0) setActiveLeagueId(myLeagues[0].id); }} className={`flex-1 px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'leagues' ? 'bg-white/10 text-white' : 'text-gray-500'}`} style={activeTab === 'leagues' ? { color: userColor } : {}}>🛡️ My Leagues</button>
        <button onClick={() => { setActiveTab('hub'); setExpandedUserId(null); }} className={`flex-1 px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'hub' ? 'bg-white/10 text-white' : 'text-gray-500'}`} style={activeTab === 'hub' ? { color: userColor } : {}}>🏟️ League Hub</button>
      </div>

      {activeTab === 'leagues' && (
        <div className="bg-neutral-900/40 border border-white/5 rounded-xl p-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full no-scrollbar">
              {myLeagues.length === 0 ? <span className="text-xs font-bold text-gray-500 uppercase">No leagues yet.</span> : myLeagues.map(league => (
                <button key={league.id} onClick={() => { setActiveLeagueId(league.id); setExpandedUserId(null); }} className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border ${activeLeagueId === league.id ? 'bg-white/10 text-white' : 'bg-black/40 border-white/5 text-gray-500'}`} style={activeLeagueId === league.id ? { borderColor: userColor } : {}}>{league.name}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button onClick={() => { setShowJoinModal(true); setModalError(''); setModalInput(''); }} className="flex-1 sm:flex-none px-3 py-1.5 bg-black/60 border border-white/10 rounded-md text-[10px] font-black uppercase text-gray-300">Join Code</button>
              <button onClick={openCreateModal} className="flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[10px] font-black uppercase text-black" style={{ backgroundColor: userColor }}>+ Create</button>
            </div>
          </div>
          
          {selectedLeague && (
            <div className="bg-black/40 border border-white/5 rounded-lg p-3 flex justify-between items-center">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{selectedLeague.is_private ? '🔒 Private' : '🔓 Public'}</span>
                  {isOwner && <button onClick={() => openEditModal(selectedLeague)} className="text-gray-500 hover:text-white">⚙️</button>}
                </div>
                <span className="text-sm font-black text-white tracking-widest font-mono">{selectedLeague.invite_code}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Custom Rules</span>
                <p className="text-[10px] font-bold text-white uppercase tracking-widest mt-0.5">
                  {selectedLeague.pts_exact !== null && `EX: ${selectedLeague.pts_exact} `}
                  {selectedLeague.pts_diff !== null && `| DF: ${selectedLeague.pts_diff} `}
                  {selectedLeague.pts_winner !== null && `| WN: ${selectedLeague.pts_winner}`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'hub' && (
        <div className="animate-fadeIn grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allLeagues.map(league => {
            const count = leagueMembersMap[league.id]?.length || 0;
            const isMember = myLeagues.some(l => l.id === league.id);
            const ownerName = allUsers.find(u => u.id === league.owner_id)?.nickname || 'Unknown';

            return (
              <div key={league.id} className="bg-neutral-900/50 border border-white/5 rounded-xl p-5 flex flex-col justify-between shadow-lg">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-black uppercase tracking-wider text-white truncate pr-2">{league.name}</h3>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border shrink-0 ${league.is_private ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>{league.is_private ? '🔒 Private' : '🔓 Public'}</span>
                  </div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Owner: {ownerName}</p>
                </div>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                  <span className="text-xs font-black text-gray-400">{count} / 10 Players</span>
                  {isMember ? <button disabled className="text-[10px] font-black uppercase px-4 py-2 rounded bg-white/5 text-gray-500 border border-white/5">Joined</button> : count >= 10 ? <button disabled className="text-[10px] font-black uppercase px-4 py-2 rounded bg-red-950 text-red-500 border border-red-900">Full</button> : <button onClick={() => onHubJoinClick(league)} className="text-[10px] font-black uppercase px-4 py-2 rounded text-black" style={{ backgroundColor: userColor }}>{league.is_private ? 'Unlock' : 'Join'}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'leagues' && (
        <div className="bg-neutral-900/50 rounded-xl border border-white/5 overflow-hidden shadow-lg animate-fadeIn">
          {displayedLeaderboard.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center gap-4 text-center">
              <span className="text-gray-500 text-xs font-bold uppercase">{myLeagues.length === 0 ? "You are not in any leagues." : "Nobody is here yet."}</span>
              {myLeagues.length === 0 && <button onClick={() => setActiveTab('hub')} className="px-6 py-2.5 rounded-lg text-[10px] font-black uppercase text-black shadow-lg hover:scale-105" style={{ backgroundColor: userColor }}>Browse League Hub</button>}
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

                    return (
                      <React.Fragment key={user.id}>
                        <tr onClick={() => !isCurrentUser && setExpandedUserId(isExpanded ? null : user.id)} className={`transition-colors ${!isCurrentUser ? 'cursor-pointer hover:bg-white/[0.05]' : ''} ${isCurrentUser ? 'bg-white/5' : ''}`}>
                          <td className="px-4 py-4 text-center"><span className={`text-sm font-black ${posColor}`}>{index + 1}</span></td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {user.teams?.logo_url ? <img src={user.teams.logo_url} className="w-6 h-6 object-contain" alt="" /> : <div className="w-6 h-6" />}
                              <span className={`font-bold text-sm ${isCurrentUser ? 'text-white' : 'text-gray-300'}`}>{user.nickname}</span>
                              {selectedLeague?.owner_id === user.id && <span className="text-[8px] uppercase font-black px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 ml-2">👑</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`font-black text-base ${user.projectedPoints > 0 ? 'text-green-400 animate-pulse' : 'text-white'}`}>{user.totalScore}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              {isOwner && !isCurrentUser && <button onClick={(e) => { e.stopPropagation(); handleKickMember(user.id); }} className="px-2 py-1 rounded text-[8px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20">Kick ❌</button>}
                              {!isCurrentUser && <button className="flex items-center gap-1 text-[8px] font-black uppercase px-2 py-1 rounded" style={{ backgroundColor: `${userColor}20`, color: userColor }}>{isExpanded ? 'Hide ▲' : 'Spy 👁️'}</button>}
                            </div>
                          </td>
                        </tr>
                        
                        {/* A CHAMADA DO COMPONENTE LIMPO COM AS REGRAS APLICADAS! */}
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
      )}

      {/* MODAL: CREATE / EDIT LEAGUE */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-950 border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-fadeIn my-auto">
            {!deleteConfirm ? (
              <>
                <h2 className="text-2xl font-black italic uppercase tracking-wider text-white mb-2">{showEditModal ? 'Edit League' : 'Create League'}</h2>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6">Customize your rules.</p>
                
                <input type="text" maxLength={20} placeholder="League Name" value={modalInput} onChange={(e) => setModalInput(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white font-bold placeholder-gray-600 focus:outline-none focus:border-white/30 mb-4" />
                
                {/* TOGGLES PARA REMOVER REGRAS */}
                <div className="mb-4">
                  <span className="text-[11px] font-black uppercase text-gray-500 tracking-widest block mb-2">Custom Points System</span>
                  <span className="text-[8px] font-black uppercase text-green-500 tracking-widest block mb-2">Exact: exact winner and score</span>
                  <span className="text-[8px] font-black uppercase text-blue-500 tracking-widest block mb-2">Diff: correct winner, different score but correct score difference</span>
                  <span className="text-[8px] font-black uppercase text-amber-500 tracking-widest block mb-2">Win: correct winner, different score and score difference</span>
                  <div className="grid grid-cols-3 gap-2">
                    
                    <div className={`border rounded-lg p-2 flex flex-col items-center transition-all ${useExact ? 'bg-black/60 border-white/10' : 'bg-black/20 border-transparent opacity-40 grayscale'}`}>
                      <div className="flex justify-between items-center w-full mb-1">
                        <span className="text-[8px] font-black uppercase text-green-500">Exact</span>
                        <button onClick={() => setUseExact(!useExact)} className="text-[10px] hover:scale-110">{useExact ? '❌' : '➕'}</button>
                      </div>
                      <input type="number" min="1" max="99" disabled={!useExact} value={ptsExact} onChange={e => handleNumberChange(setPtsExact, e.target.value)} className="w-full bg-transparent text-center text-lg font-black text-white focus:outline-none disabled:cursor-not-allowed" />
                    </div>

                    <div className={`border rounded-lg p-2 flex flex-col items-center transition-all ${useDiff ? 'bg-black/60 border-white/10' : 'bg-black/20 border-transparent opacity-40 grayscale'}`}>
                      <div className="flex justify-between items-center w-full mb-1">
                        <span className="text-[8px] font-black uppercase text-blue-500">Diff</span>
                        <button onClick={() => setUseDiff(!useDiff)} className="text-[10px] hover:scale-110">{useDiff ? '❌' : '➕'}</button>
                      </div>
                      <input type="number" min="1" max="99" disabled={!useDiff} value={ptsDiff} onChange={e => handleNumberChange(setPtsDiff, e.target.value)} className="w-full bg-transparent text-center text-lg font-black text-white focus:outline-none disabled:cursor-not-allowed" />
                    </div>

                    <div className={`border rounded-lg p-2 flex flex-col items-center transition-all ${useWinner ? 'bg-black/60 border-white/10' : 'bg-black/20 border-transparent opacity-40 grayscale'}`}>
                      <div className="flex justify-between items-center w-full mb-1">
                        <span className="text-[8px] font-black uppercase text-amber-500">Win</span>
                        <button onClick={() => setUseWinner(!useWinner)} className="text-[10px] hover:scale-110">{useWinner ? '❌' : '➕'}</button>
                      </div>
                      <input type="number" min="1" max="99" disabled={!useWinner} value={ptsWinner} onChange={e => handleNumberChange(setPtsWinner, e.target.value)} className="w-full bg-transparent text-center text-lg font-black text-white focus:outline-none disabled:cursor-not-allowed" />
                    </div>

                  </div>
                </div>

                <div className="flex items-center gap-3 mb-6 bg-black/40 border border-white/5 p-3 rounded-lg cursor-pointer transition-all hover:border-white/10" onClick={() => setIsPrivateLeague(!isPrivateLeague)}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isPrivateLeague ? 'bg-amber-500/20 border-amber-500/50' : 'bg-white/5 border-white/10'}`}>
                    {isPrivateLeague ? <span className="text-amber-500 text-xs">🔒</span> : <span className="text-green-500 text-xs">🔓</span>}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-widest text-white">{isPrivateLeague ? 'Private League' : 'Public League'}</span>
                    <span className="text-[9px] font-bold text-gray-500 uppercase">{isPrivateLeague ? 'Requires invite code to join' : 'Anyone can join directly'}</span>
                  </div>
                </div>

                {modalError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mb-4">{modalError}</p>}
                
                <div className="flex gap-3 mt-2">
                  <button disabled={isProcessing} onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="flex-1 py-3 bg-white/5 rounded-lg text-xs font-black uppercase text-white">Cancel</button>
                  <button disabled={isProcessing} onClick={showEditModal ? handleEditLeague : handleCreateLeague} className="flex-1 py-3 rounded-lg text-xs font-black uppercase text-black" style={{ backgroundColor: userColor }}>{isProcessing ? 'Saving...' : 'Save'}</button>
                </div>

                {showEditModal && (
                  <button onClick={() => setDeleteConfirm(true)} className="w-full mt-6 text-red-500 text-[10px] font-black uppercase tracking-widest hover:text-red-400">Delete League</button>
                )}
              </>
            ) : (
              <div className="text-center animate-fadeIn">
                <h2 className="text-xl font-black italic uppercase tracking-wider mb-4 text-white">Are you sure?</h2>
                <p className="text-xs font-bold text-gray-400 mb-8 uppercase tracking-widest">This will delete the league and remove all members permanently.</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-3 bg-gray-600 rounded-lg text-xs font-black uppercase text-white">No, Keep It</button>
                  <button onClick={handleDeleteLeague} disabled={isProcessing} className="flex-1 py-3 bg-red-600 rounded-lg text-xs font-black uppercase text-white">Yes, Delete</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showJoinModal && targetJoinLeague && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-fadeIn">
            <h2 className="text-2xl font-black italic uppercase tracking-wider text-white mb-2">Join League</h2>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">League: <span className="text-white">{targetJoinLeague.name}</span></p>
            <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest mb-2">🔒 Private League. Enter password.</p>
            <input type="text" maxLength={6} placeholder="Invite Code" value={modalInput} onChange={(e) => setModalInput(e.target.value.toUpperCase())} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white font-black tracking-[0.3em] uppercase text-center focus:outline-none mb-2" />
            {modalError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mb-4">{modalError}</p>}
            <div className="flex gap-3 mt-6">
              <button disabled={isProcessing} onClick={() => { setShowJoinModal(false); setTargetJoinLeague(null); }} className="flex-1 py-3 bg-white/5 rounded-lg text-xs font-black uppercase text-white">Cancel</button>
              <button disabled={isProcessing} onClick={handleJoinPrivateSubmit} className="flex-1 py-3 rounded-lg text-xs font-black uppercase text-black" style={{ backgroundColor: userColor }}>Join</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}