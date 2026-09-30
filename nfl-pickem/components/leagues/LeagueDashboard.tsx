"use client";

import React, { useState } from 'react';
import { Settings, Lock, LockOpen, Crown, Star, X, Eye, ChevronUp, Copy, Check } from 'lucide-react';
import SpyLockerRoom from '../scoreboard/SpyLockerRoom';
import { EyeIcon, EyeOffIcon } from '@/components/ui/icons';
import type { League } from '@/lib/types';

interface LeagueDashboardProps {
  selectedLeague?: League;
  displayedLeaderboard: any[];
  currentUserId: string;
  userColor: string;
  allUsers: any[];
  leagueMembersMap: Record<string, string[]>;
  championships: any[];
  gamesByWeek: Record<string, any[]>;
  teamsMap: Record<string, any>;
  allGuesses: any[];
  expandedUserId: string | null;
  setExpandedUserId: (id: string | null) => void;
  openEditModal: () => void;
  openDeleteModal: () => void;
  reloadLeagues: () => void;
  showToast: (msg: string, type: 'success'|'error') => void;
}

export default function LeagueDashboard({
  selectedLeague, displayedLeaderboard, currentUserId, userColor, allUsers,
  leagueMembersMap, championships, gamesByWeek, teamsMap, allGuesses,
  expandedUserId, setExpandedUserId, openEditModal, openDeleteModal, reloadLeagues, showToast
}: LeagueDashboardProps) {
  const [showCode, setShowCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!selectedLeague) {
    return (
      <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-12 text-center h-full flex flex-col justify-center items-center shadow-xl">
         <ShieldIcon />
         <h2 className="font-sport font-bold text-2xl text-gray-500 uppercase tracking-wider mb-2">Select a League</h2>
         <p className="font-sans text-xs font-black uppercase tracking-widest text-gray-600">Choose a league from the side menu to view its details and leaderboard.</p>
      </div>
    );
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleKickMember = async (targetUserId: string) => {
    // Usando import dinâmico apenas para ação pontual
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { error } = await supabase.from('league_members').delete().eq('league_id', selectedLeague.id).eq('user_id', targetUserId);
    
    if (!error) { showToast("Player removed.", "success"); setExpandedUserId(null); reloadLeagues(); } 
    else showToast("Error removing player.", "error");
  };

  return (
    <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-8 animate-fadeIn shadow-2xl flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: userColor }} />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex flex-col">
          <h2 className="font-sport font-bold text-2xl sm:text-3xl text-white uppercase tracking-wider drop-shadow-md leading-none mb-2">{selectedLeague.name}</h2>
          <div className="flex items-center gap-3 font-sans text-[10px] font-black uppercase tracking-widest">
             <span className="text-gray-400">Created by {selectedLeague.owner_id === currentUserId ? 'You' : (allUsers.find(u => u.id === selectedLeague.owner_id)?.nickname || 'Unknown')}</span>
             <span className="text-gray-600">|</span>
             <span className="text-gray-400">{leagueMembersMap[selectedLeague.id]?.length || 0} Players</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedLeague.owner_id === currentUserId ? (
            <button onClick={openEditModal} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2 shadow-sm">
              <Settings size={14} /> Settings
            </button>
          ) : (
            <button onClick={openDeleteModal} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-2 shadow-sm">
               Leave League
            </button>
          )}
        </div>
      </div>

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
                  const leagueWinsCount = championships.filter(c => c.league_id === selectedLeague.id && c.winner_id === user.id).length;
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
                          gamesByWeek={gamesByWeek} teamsMap={teamsMap} myGuesses={allGuesses.filter(g => g.user_id === user.id)} 
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
  );
}

// Pequeno ícone SVG local
const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700 mb-4">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>
  </svg>
);