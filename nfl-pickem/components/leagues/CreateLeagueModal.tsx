"use client";

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import type { League } from '@/lib/types';

interface CreateLeagueModalProps {
  onClose: () => void;
  currentUserId: string;
  isAdmin: boolean;
  isVip: boolean;
  userColor: string;
  reload: () => Promise<void>;
  showToast: (msg: string, type: 'success' | 'error') => void;
  setActiveLeague: (id: string) => void;
  setActiveTab: (tab: 'leagues' | 'hub') => void;
}

export default function CreateLeagueModal({
  onClose, currentUserId, isAdmin, isVip, userColor, reload, showToast, setActiveLeague, setActiveTab
}: CreateLeagueModalProps) {
  const supabase = createClient();
  
  const [modalInput, setModalInput] = useState('');
  const [isPrivateLeague, setIsPrivateLeague] = useState(true);
  
  const [ptsExact, setPtsExact] = useState<string | number>('7');
  const [ptsDiff, setPtsDiff] = useState<string | number>('5');
  const [ptsWinner, setPtsWinner] = useState<string | number>('3');
  
  const [modalError, setModalError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCreateLeague = async () => {
    if (!modalInput.trim()) { 
      setModalError('League name cannot be empty.'); 
      return; 
    }
    
    const exactVal = parseInt(String(ptsExact)) || 0;
    const diffVal = parseInt(String(ptsDiff)) || 0;
    const winnerVal = parseInt(String(ptsWinner)) || 0;
    
    setIsProcessing(true);
    setModalError('');
    
    if (!isAdmin) {
      const { count } = await supabase.from('leagues').select('*', { count: 'exact', head: true }).eq('owner_id', currentUserId);
      const limit = isVip ? 10 : 3;
      if (count && count >= limit) { 
        setModalError(`Limit reached! Max ${limit} leagues.`); 
        setIsProcessing(false); 
        return; 
      }
    }
    
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: newLeague, error } = await supabase.from('leagues').insert([{ 
      name: modalInput.trim(), 
      owner_id: currentUserId, 
      invite_code: inviteCode, 
      is_private: isPrivateLeague,
      pts_exact: exactVal, 
      pts_diff: diffVal, 
      pts_winner: winnerVal
    }]).select().single<League>();
    
    if (error || !newLeague) { 
      setModalError('Error creating league.'); 
      setIsProcessing(false); 
      return; 
    }
    
    await supabase.from('league_members').insert({ league_id: newLeague.id, user_id: currentUserId });
    
    setActiveLeague(newLeague.id); 
    setActiveTab('leagues'); 
    showToast("League created!", "success");
    await reload(); 
    setIsProcessing(false);
    onClose();
  };

  return (
    <Modal isOpen={true}>
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
          <button disabled={isProcessing} onClick={onClose} className="flex-1 py-3 bg-white/5 rounded-xl font-sans text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition border border-white/5">Cancel</button>
          <button disabled={isProcessing} onClick={handleCreateLeague} className="flex-1 py-3 rounded-xl font-sport font-bold text-sm uppercase tracking-wider text-black transition shadow-xl" style={{ backgroundColor: userColor, boxShadow: `0 0 15px ${userColor}50` }}>{isProcessing ? '...' : 'Create'}</button>
        </div>
      </div>
    </Modal>
  );
}