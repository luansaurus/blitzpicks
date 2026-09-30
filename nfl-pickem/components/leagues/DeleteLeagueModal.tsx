"use client";

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { League } from '@/lib/types';

interface DeleteLeagueModalProps {
  onClose: () => void;
  selectedLeague: League;
  currentUserId: string;
  reload: () => Promise<void>;
  showToast: (msg: string, type: 'success' | 'error') => void;
  setActiveLeague: (id: string | null) => void;
  closeEdit?: () => void;
}

export default function DeleteLeagueModal({
  onClose, selectedLeague, currentUserId, reload, showToast, setActiveLeague, closeEdit
}: DeleteLeagueModalProps) {
  const supabase = createClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const isOwner = selectedLeague.owner_id === currentUserId;

  const executeDeleteLeague = async () => {
    setIsProcessing(true);
    const { error } = await supabase.from('leagues').delete().eq('id', selectedLeague.id);
    if (error) {
      showToast("Error processing request.", "error");
    } else { 
      showToast("League dropped.", "success"); 
      setActiveLeague(null); 
      if (closeEdit) closeEdit();
      await reload(); 
      onClose();
    }
    setIsProcessing(false);
  };

  const executeLeaveLeague = async () => {
    setIsProcessing(true);
    const { error } = await supabase.from('league_members').delete().match({ league_id: selectedLeague.id, user_id: currentUserId });
    if (error) {
      showToast("Error leaving league.", "error");
    } else { 
      showToast("You left the league.", "success"); 
      setActiveLeague(null); 
      if (closeEdit) closeEdit();
      await reload(); 
      onClose();
    }
    setIsProcessing(false);
  };

  return (
    <Modal isOpen={true}>
      <div className="bg-black/90 backdrop-blur-2xl border border-white/10 p-6 sm:p-8 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5 shadow-inner">
          <AlertTriangle size={28} className="text-red-500 drop-shadow-md" />
        </div>
        
        <h3 className="font-jersey text-3xl uppercase tracking-widest text-white mb-3 drop-shadow-md">
          {isOwner ? 'DELETE LEAGUE?' : 'LEAVE LEAGUE?'}
        </h3>
        
        <p className="font-sans text-[10px] sm:text-xs text-gray-400 mb-8 font-black uppercase tracking-widest leading-relaxed">
          {isOwner 
            ? 'Are you sure you want to drop this league? This will permanently remove it for all players.' 
            : 'Are you sure you want to leave this league? You will lose your current rank and points associated with it.'}
        </p>
        
        <div className="flex items-center gap-3 w-full">
          <button 
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl font-sans font-black uppercase tracking-widest text-[10px] sm:text-xs transition-colors border border-white/10 text-gray-400 hover:bg-white/[0.02] hover:text-white"
          >
            Cancel
          </button>
          <button 
            onClick={isOwner ? executeDeleteLeague : executeLeaveLeague}
            disabled={isProcessing}
            className="flex-1 py-3.5 rounded-xl font-sans font-black uppercase tracking-widest text-[10px] sm:text-xs transition-colors bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30 shadow-inner disabled:opacity-50"
          >
            {isProcessing ? 'Wait...' : 'Confirm'}
          </button>
        </div>
      </div>
    </Modal>
  );
}