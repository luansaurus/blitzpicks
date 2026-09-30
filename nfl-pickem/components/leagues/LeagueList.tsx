"use client";

import React from 'react';
import { Users, Lock, LockOpen, Crown } from 'lucide-react';
import { getPickResult } from '@/lib/scoring';
import type { League } from '@/lib/types';

interface LeagueListProps {
  myLeagues: League[];
  activeLeagueId: string | null;
  setActiveLeagueId: (id: string) => void;
  setExpandedUserId: (id: string | null) => void;
  userColor: string;
  currentUserId: string;
  leagueMembersMap: Record<string, string[]>;
  allUsers: any[];
  allGuesses: any[];
}

export default function LeagueList({ myLeagues, activeLeagueId, setActiveLeagueId, setExpandedUserId, userColor, currentUserId, leagueMembersMap, allUsers, allGuesses }: LeagueListProps) {
  if (myLeagues.length === 0) {
    return (
      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center shadow-xl">
        <span className="font-sans text-xs font-black text-gray-500 uppercase tracking-widest">No leagues yet.</span>
      </div>
    );
  }

  return (
    <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-2 shadow-xl flex flex-col gap-1 max-h-[600px] overflow-y-auto custom-scrollbar">
      {myLeagues.map(league => {
        const membersInLeague = leagueMembersMap[league.id] || [];
        const rules = { exact: league.pts_exact ?? 7, diff: league.pts_diff ?? 5, winner: league.pts_winner ?? 3 };
        const usersInLeague = allUsers.filter(u => membersInLeague.includes(u.id));
        
        const sorted = usersInLeague.map(u => {
          let score = 0;
          allGuesses.filter(g => g.user_id === u.id).forEach(guess => {
            score += getPickResult({ status: 'finished' } as any, guess, rules).points; // Simplificação visual para rank
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
            onClick={() => { setActiveLeagueId(league.id); setExpandedUserId(null); }} 
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
  );
}