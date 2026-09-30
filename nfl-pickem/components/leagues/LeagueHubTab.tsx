"use client";

import React from 'react';
import { Settings, Lock, LockOpen } from 'lucide-react';
import type { League } from '@/lib/types';

interface LeagueHubTabProps {
  allLeagues: League[];
  myLeagues: League[];
  leagueMembersMap: Record<string, string[]>;
  allUsers: any[];
  currentUserId: string;
  userColor: string;
  onJoinClick: (league: League) => void;
  openEditModal: (league: League) => void;
}

export default function LeagueHubTab({
  allLeagues, myLeagues, leagueMembersMap, allUsers, currentUserId, userColor, onJoinClick, openEditModal
}: LeagueHubTabProps) {
  return (
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
                <button onClick={() => onJoinClick(league)} className="font-sport font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl text-black transition-transform hover:scale-105 shadow-xl" style={{ backgroundColor: userColor, boxShadow: `0 0 15px ${userColor}50` }}>
                  {league.is_private ? 'Unlock' : 'Join'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}