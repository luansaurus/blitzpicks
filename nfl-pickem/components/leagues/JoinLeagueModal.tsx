"use client";

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Lock } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { League } from '@/lib/types';

interface JoinLeagueModalProps {
  onClose: () => void;
  currentUserId: string;
  targetLeague: League | null;
  userColor: string;
  reload: () => Promise<void>;
  showToast: (msg: string, type: 'success' | 'error') => void;
  setActiveLeague: (id: string) => void;
  setActiveTab: (tab: 'leagues' | 'hub') => void;
}

export default function JoinLeagueModal({
  onClose, currentUserId, targetLeague, userColor, reload, showToast, setActiveLeague, setActiveTab
}: JoinLeagueModalProps) {
  const supabase = createClient();
  const [modalInput, setModalInput] = useState('');
  const [modalError, setModalError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const executeJoin = async (leagueId: string, leagueName: string) => {
    const { error } = await supabase.from('league_members').insert({ league_id: leagueId, user_id: currentUserId });
    
    if (error) {
      showToast("Error joining league.", "error");
    } else { 
      setActiveLeague(leagueId); 
      setActiveTab('leagues'); 
      showToast(`Joined ${leagueName}!`, "success"); 
      await reload(); 
      onClose();
    }
  };

  const handleJoinSubmit = async () => {
    setIsProcessing(true);
    setModalError('');

    if (targetLeague) {
      if (modalInput.trim().toUpperCase() !== targetLeague.invite_code) { 
        setModalError('Incorrect Password.'); 
        setIsProcessing(false);
        return; 
      }
      await executeJoin(targetLeague.id, targetLeague.name);
      setIsProcessing(false);
      return;
    } 
    
    const code = modalInput.trim().toUpperCase();

    if (code.length !== 6) {
      setModalError('Code must be 6 characters.');
      setIsProcessing(false);
      return;
    }

    const { data: leagueId, error } = await supabase.rpc('join_league_by_code', { p_code: code });

    if (error) {
      if (error.message.includes('invalid_code')) setModalError('Invalid invite code.');
      else if (error.message.includes('already_member')) setModalError('Already in this league.');
      else if (error.message.includes('league_full')) setModalError('League is full.');
      else if (error.message.includes('not_authenticated')) setModalError('Not authenticated.');
      else setModalError('Error joining league.');
      setIsProcessing(false);
      return;
    }

    setActiveLeague(leagueId as string); 
    setActiveTab('leagues'); 
    showToast('Joined league!', "success"); 
    await reload(); 
    onClose();
  };

  return (
    <Modal isOpen={true}>
      <div className="bg-black/90 backdrop-blur-2xl border border-white/10 p-6 sm:p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center">
        <h2 className="font-jersey text-3xl uppercase tracking-widest text-white mb-2 drop-shadow-md">JOIN LEAGUE</h2>
        
        {targetLeague ? (
          <>
            <p className="font-sans text-xs font-black uppercase tracking-widest text-gray-400 mb-4">League: <span className="text-white">{targetLeague.name}</span></p>
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
          <button disabled={isProcessing} onClick={onClose} className="flex-1 py-3 bg-white/5 rounded-xl font-sans text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition border border-white/5">Cancel</button>
          <button disabled={isProcessing} onClick={handleJoinSubmit} className="flex-1 py-3 rounded-xl font-sport font-bold text-sm uppercase tracking-wider text-black transition shadow-xl" style={{ backgroundColor: userColor, boxShadow: `0 0 15px ${userColor}50` }}>{isProcessing ? '...' : 'Join'}</button>
        </div>
      </div>
    </Modal>
  );
}