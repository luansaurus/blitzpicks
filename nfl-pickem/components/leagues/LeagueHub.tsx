"use client";

import React, { useState } from 'react';
import { Shield, Landmark } from 'lucide-react';
import { useLeagues } from '@/hooks/useLeagues';
import LeagueList from './LeagueList';
import LeagueDashboard from './LeagueDashboard';
import LeagueHubTab from './LeagueHubTab';
import CreateLeagueModal from './CreateLeagueModal';
import JoinLeagueModal from './JoinLeagueModal';
import EditLeagueModal from './EditLeagueModal';
import DeleteLeagueModal from './DeleteLeagueModal';

interface LeagueHubProps {
  userColor: string;
  currentUserId: string;
  isAdmin: boolean;
  isVip: boolean;
}

export default function LeagueHub({ userColor, currentUserId, isAdmin, isVip }: LeagueHubProps) {
  const { 
    loading, allLeagues, myLeagues, activeLeagueId, setActiveLeagueId,
    allUsers, allGuesses, gamesByWeek, teamsMap, leagueMembersMap, championships,
    displayedLeaderboard, reloadLeagues 
  } = useLeagues(currentUserId);

  const [activeTab, setActiveTab] = useState<'leagues' | 'hub'>('leagues');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [targetJoinLeague, setTargetJoinLeague] = useState<any | null>(null);

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const selectedLeague = myLeagues.find(l => l.id === activeLeagueId);

  if (loading) {
    return <div className="py-20 text-center animate-pulse font-sans text-gray-500 uppercase font-black tracking-widest text-xs">Loading Leagues...</div>;
  }

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
            onClick={() => { setTargetJoinLeague(null); setShowJoinModal(true); }} 
            className="flex-1 sm:flex-none px-5 py-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl font-sans text-[10px] font-black uppercase text-gray-300 transition-all hover:bg-white/10 shadow-lg"
          >
            Join Code
          </button>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-sport font-bold text-sm uppercase tracking-wider text-black transition-transform hover:scale-105 shadow-xl" 
            style={{ backgroundColor: userColor, boxShadow: `0 0 20px ${userColor}50` }}
          >
            + Create
          </button>
        </div>
      </div>

      {activeTab === 'leagues' && (
        <div className="flex flex-col lg:flex-row gap-6 animate-fadeIn items-start">
          <div className="w-full lg:w-1/3 space-y-4">
            <LeagueList 
              myLeagues={myLeagues} 
              activeLeagueId={activeLeagueId} 
              setActiveLeagueId={setActiveLeagueId}
              setExpandedUserId={setExpandedUserId}
              userColor={userColor}
              currentUserId={currentUserId}
              leagueMembersMap={leagueMembersMap}
              allUsers={allUsers}
              allGuesses={allGuesses}
            />
          </div>
          <div className="w-full lg:w-2/3">
            <LeagueDashboard 
              selectedLeague={selectedLeague}
              displayedLeaderboard={displayedLeaderboard}
              currentUserId={currentUserId}
              userColor={userColor}
              allUsers={allUsers}
              leagueMembersMap={leagueMembersMap}
              championships={championships}
              gamesByWeek={gamesByWeek}
              teamsMap={teamsMap}
              allGuesses={allGuesses}
              expandedUserId={expandedUserId}
              setExpandedUserId={setExpandedUserId}
              openEditModal={() => setShowEditModal(true)}
              openDeleteModal={() => setShowDeleteConfirm(true)}
              reloadLeagues={reloadLeagues}
              showToast={showToast}
            />
          </div>
        </div>
      )}

      {activeTab === 'hub' && (
        <LeagueHubTab 
          allLeagues={allLeagues}
          myLeagues={myLeagues}
          leagueMembersMap={leagueMembersMap}
          allUsers={allUsers}
          currentUserId={currentUserId}
          userColor={userColor}
          onJoinClick={(league) => {
            setTargetJoinLeague(league);
            setShowJoinModal(true);
          }}
          openEditModal={(league) => {
            setActiveLeagueId(league.id);
            setShowEditModal(true);
          }}
        />
      )}

      {showCreateModal && <CreateLeagueModal onClose={() => setShowCreateModal(false)} currentUserId={currentUserId} isAdmin={isAdmin} isVip={isVip} userColor={userColor} reload={reloadLeagues} showToast={showToast} setActiveLeague={setActiveLeagueId} setActiveTab={setActiveTab} />}
      
      {showEditModal && selectedLeague && (
        <EditLeagueModal 
          onClose={() => setShowEditModal(false)} 
          selectedLeague={selectedLeague} 
          userColor={userColor} 
          reload={reloadLeagues} 
          showToast={showToast} 
          onDeleteClick={() => setShowDeleteConfirm(true)}
        />
      )}
      
      {showJoinModal && <JoinLeagueModal onClose={() => setShowJoinModal(false)} currentUserId={currentUserId} targetLeague={targetJoinLeague} userColor={userColor} reload={reloadLeagues} showToast={showToast} setActiveLeague={setActiveLeagueId} setActiveTab={setActiveTab} />}
      
      {showDeleteConfirm && selectedLeague && <DeleteLeagueModal onClose={() => setShowDeleteConfirm(false)} selectedLeague={selectedLeague} currentUserId={currentUserId} reload={reloadLeagues} showToast={showToast} setActiveLeague={setActiveLeagueId} closeEdit={() => setShowEditModal(false)} />}
    </div>
  );
}