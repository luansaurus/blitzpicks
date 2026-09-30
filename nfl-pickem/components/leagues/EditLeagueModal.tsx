"use client";

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import type { League } from '@/lib/types';

interface EditLeagueModalProps {
  onClose: () => void;
  selectedLeague: League;
  userColor: string;
  reload: () => Promise<void>;
  showToast: (msg: string, type: 'success' | 'error') => void;
  onDeleteClick: () => void;
}

export default function EditLeagueModal({
  onClose, selectedLeague, userColor, reload, showToast, onDeleteClick
}: EditLeagueModalProps) {
  const supabase = createClient();
  
  const [modalInput, setModalInput] = useState(selectedLeague.name);
  const [isPrivateLeague, setIsPrivateLeague] = useState(selectedLeague.is_private ?? true);
  
  const [ptsExact, setPtsExact] = useState<string | number>(selectedLeague.pts_exact ?? '7');
  const [ptsDiff, setPtsDiff] = useState<string | number>(selectedLeague.pts_diff ?? '5');
  const [ptsWinner, setPtsWinner] = useState<string | number>(selectedLeague.pts_winner ?? '3');
  
  const [modalError, setModalError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleEditLeague = async () => {
    if (!modalInput.trim()) { 
      setModalError('League name cannot be empty.'); 
      return; 
    }
    
    setIsProcessing(true);
    setModalError('');
    
    const exactVal = parseInt(String(ptsExact)) || 0;
    const diffVal = parseInt(String(ptsDiff)) || 0;
    const winnerVal = parseInt(String(ptsWinner)) || 0;
    
    const { error } = await supabase.from('leagues').update({ 
      name: modalInput.trim(), 
      is_private: isPrivateLeague, 
      pts_exact: exactVal, 
      pts_diff: diffVal, 
      pts_winner: winnerVal 
    }).eq('id', selectedLeague.id);
    
    if (error) {
      showToast("Error updating league.", "error");
    } else { 
      showToast("League rules updated!", "success"); 
      await reload();
      onClose(); 
    }
    setIsProcessing(false);
  };

  return (
    <Modal isOpen={true}>
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
          <button disabled={isProcessing} onClick={onClose} className="flex-1 py-3 bg-white/5 rounded-xl font-sans text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition border border-white/5">Cancel</button>
          <button disabled={isProcessing} onClick={handleEditLeague} className="flex-1 py-3 rounded-xl font-sport font-bold text-sm uppercase tracking-wider text-black transition shadow-xl" style={{ backgroundColor: userColor, boxShadow: `0 0 15px ${userColor}50` }}>{isProcessing ? '...' : 'Save'}</button>
        </div>
        
        <button disabled={isProcessing} onClick={onDeleteClick} className="w-full mt-4 font-sans text-[10px] font-black uppercase tracking-widest text-red-500/70 hover:text-red-400 transition">
          Drop League
        </button>
      </div>
    </Modal>
  );
}