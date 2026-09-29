"use client";

import React, { useEffect, useState, useRef } from 'react';
import Header from '../../components/layout/header';
import { createClient } from '../../utils/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { Repeat, Save, Loader2, Camera, X, AlertTriangle } from 'lucide-react';
import { PLAYOFF_ORDER, PLAYOFF_NAMES } from '@/lib/constants/playoffs';
import { getBestColor } from '@/lib/color';

const TBD_TEAM = { 
  name: 'To Be Determined', 
  abbr: 'TBD', 
  color: '#333333', 
  logo_url: 'https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg'
};

type Team = { id: string | number; name: string; abbreviation?: string; abbr?: string; logo_url: string; seed: number; conference: string; division: string };
type ConfSeeds = Record<number, Team | null>;


export default function BracketPage() {
  const [loading, setLoading] = useState(true);
  
const [userColor, setUserColor] = useState(() => {
  if (typeof window !== 'undefined') return localStorage.getItem('blitz_accent') || '#E31837';
  return '#E31837';
});
const [ambientPrimary, setAmbientPrimary] = useState(() => {
  if (typeof window !== 'undefined') return localStorage.getItem('blitz_header_bg') || '#013369';
  return '#013369';
});
const [ambientSecondary, setAmbientSecondary] = useState(() => {
  if (typeof window !== 'undefined') return localStorage.getItem('blitz_header_sec') || '#E31837';
  return '#E31837';
});

  const [allTeams, setAllTeams] = useState<any[]>([]);
  
  const bracketRef = useRef<HTMLDivElement>(null);

  const [seeds, setSeeds] = useState<{ AFC: ConfSeeds, NFC: ConfSeeds }>({
    AFC: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
    NFC: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null }
  });

  const [picks, setPicks] = useState<Record<string, Team | null>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<{ conf: 'AFC'|'NFC', seed: number } | null>(null);
  
  const [isCapturing, setIsCapturing] = useState(false); 
  const [isSaving, setIsSaving] = useState(false);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: teamsData } = await supabase.from('teams').select('*').order('name');
      if (teamsData) setAllTeams(teamsData);

      if (user) {
        const { data: profile } = await supabase.from('profiles').select('favorite_team_id').eq('id', user.id).single();
        if (profile?.favorite_team_id && teamsData) {
          const tInfo = teamsData.find(t => t.id === profile.favorite_team_id);
          if (tInfo) {
            setUserColor(getBestColor(tInfo.primary_color, tInfo.secondary_color));
            setAmbientPrimary(tInfo.primary_color || '#013369');
            setAmbientSecondary(tInfo.secondary_color || '#E31837');
          }
        } else if (typeof window !== "undefined") {
          const savedAccent = localStorage.getItem('blitz_accent');
          if (savedAccent) setUserColor(savedAccent);
        }

        const { data: savedBracket } = await supabase.from('user_brackets')
          .select('seeds, picks')
          .eq('user_id', user.id)
          .eq('season', '2026')
          .maybeSingle();

        if (savedBracket) {
          if (savedBracket.seeds && Object.keys(savedBracket.seeds).length > 0) setSeeds(savedBracket.seeds);
          if (savedBracket.picks && Object.keys(savedBracket.picks).length > 0) setPicks(savedBracket.picks);
        }
      }

      setLoading(false);
    }
    loadData();
  }, [supabase]);

  const handleSaveBracket = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast("You need to be logged in to save your bracket.", "error");
        return;
      }

      const { error } = await supabase.from('user_brackets').upsert({
        user_id: user.id,
        season: '2026',
        seeds: seeds,
        picks: picks,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, season' });

      if (error) throw error;
      showToast("Bracket saved successfully!", "success");
    } catch (error) {
      console.error("Error saving bracket:", error);
      showToast("Failed to save bracket.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const getDivMatchups = (conf: 'AFC' | 'NFC') => {
    const s1 = seeds[conf][1];
    
    const confLower = conf.toLowerCase(); 
    const w1 = picks[`${confLower}_wc_1`];
    const w2 = picks[`${confLower}_wc_2`];
    const w3 = picks[`${confLower}_wc_3`];

    const fav1 = seeds[conf][2] || { seed: 2 };
    const fav2 = seeds[conf][3] || { seed: 3 };
    const fav3 = seeds[conf][4] || { seed: 4 };

    const p1 = w1 ? { ...w1, picked: true } : { ...fav1, picked: false };
    const p2 = w2 ? { ...w2, picked: true } : { ...fav2, picked: false };
    const p3 = w3 ? { ...w3, picked: true } : { ...fav3, picked: false };

    const projected = [p1, p2, p3].sort((a, b) => a.seed - b.seed);

    const formatSlot = (teamData: any, fallbackStr: string) => {
      if (teamData.picked) return teamData;
      return { abbreviation: fallbackStr };
    };

    return {
      m1: { 
        teamA: s1 || { abbreviation: 'Seed 1 (BYE)' }, 
        teamB: formatSlot(projected[2], 'Lowest Seed')
      },
      m2: { 
        teamA: formatSlot(projected[0], 'Highest Adv.'), 
        teamB: formatSlot(projected[1], '2nd Highest') 
      }
    };
  };

  const afcDiv = getDivMatchups('AFC');
  const nfcDiv = getDivMatchups('NFC');

  const handleEditSeedClick = (conf: 'AFC' | 'NFC', seed: number) => {
    setActiveSlot({ conf, seed });
    setIsModalOpen(true);
  };

  const handleSetSeed = (team: any) => {
    if (!activeSlot) return;
    
    const currentTeamInSlot = seeds[activeSlot.conf][activeSlot.seed];
    if (currentTeamInSlot && currentTeamInSlot.id !== team.id) {
      setPicks({});
    }

    setSeeds(prev => ({
      ...prev,
      [activeSlot.conf]: {
        ...prev[activeSlot.conf],
        [activeSlot.seed]: { ...team, seed: activeSlot.seed, conference: activeSlot.conf }
      }
    }));
    setIsModalOpen(false);
  };

  const advanceTeam = (team: Team, nextSlot: string) => {
    setPicks(prev => ({ ...prev, [nextSlot]: team }));
  };

  const confirmReset = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error } = await supabase.from('user_brackets')
          .delete()
          .eq('user_id', user.id)
          .eq('season', '2026');

        if (error) throw error;
      }

      setPicks({});
      setSeeds({
        AFC: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
        NFC: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null }
      });
      
      setShowClearConfirm(false);
      showToast("Bracket completely wiped from cloud and screen.", "info");
    } catch (err) {
      console.error("Error deleting bracket row:", err);
      showToast("Failed to delete bracket from database.", "error");
    }
  };

  const handleShare = async () => {
    if (!bracketRef.current) return;
    try {
      setIsCapturing(true); 
      await new Promise(resolve => setTimeout(resolve, 300));

      const htmlToImage = await import('html-to-image');
      const config = { 
        quality: 1, 
        backgroundColor: '#050505',
        pixelRatio: 2,
        cacheBust: true, 
      };

      const dataUrl = await htmlToImage.toPng(bracketRef.current, config);
      
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'blitzpicks-road-to-sb.png', { type: blob.type });

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Road to Super Bowl LXI',
          text: 'Check out my playoff predictions on BlitzPicks!',
          files: [file],
        });
      } else {
        const link = document.createElement('a');
        link.download = 'blitzpicks-road-to-sb.png';
        link.href = dataUrl;
        link.click();
        showToast("Image downloaded successfully!", "success");
      }
    } catch (err) {
      console.error('Failed to capture bracket', err);
      showToast("Error sharing the bracket. Try again.", "error");
    } finally {
      setIsCapturing(false);
    }
  };

  const getTakenDivisions = (conf: 'AFC' | 'NFC', currentSeedToIgnore: number) => {
    const taken = new Set<string>();
    for (let i = 1; i <= 4; i++) {
      if (i !== currentSeedToIgnore) {
        const teamInSlot = seeds[conf][i];
        if (teamInSlot && teamInSlot.division) taken.add(teamInSlot.division);
      }
    }
    return taken;
  };

  const TeamRow = ({ team, nextSlotId, isBaseSeed, conf, isTopRow }: any) => {
    const isSelected = picks[nextSlotId]?.id === team?.id && team?.id;
    const teamSigla = team?.abbreviation || team?.abbr || team?.name || 'TBD';
    const logoToUse = team?.logo_url || TBD_TEAM.logo_url;
    
    return (
      <div className={`flex items-stretch transition-colors border-white/5 ${isTopRow ? 'border-b' : ''} ${isSelected ? 'bg-white/10 border-l-2 border-white' : 'hover:bg-white/5'}`}>
        <button 
          onClick={() => {
            if (isBaseSeed && !team?.id) handleEditSeedClick(conf, team?.seedNum);
            else if (team?.id) advanceTeam(team, nextSlotId);
          }}
          className="flex-1 flex items-center gap-2.5 p-2.5 h-11"
        >
          <span className="font-jersey text-base sm:text-lg text-gray-500 w-4 text-center leading-none pt-0.5">{team?.seed || team?.seedNum || '-'}</span>
          <img src={logoToUse} crossOrigin="anonymous" className="w-5 h-5 sm:w-6 sm:h-6 object-contain opacity-90 drop-shadow-sm" alt="Team Logo" />
          <span className={`font-sport font-bold text-xs sm:text-sm uppercase tracking-wider truncate flex-1 leading-none pb-0.5 text-left ${isSelected ? 'text-white drop-shadow-md' : 'text-gray-300'}`}>
            {teamSigla}
          </span>
        </button>

        {isBaseSeed && team?.id && (
          <button 
            onClick={() => handleEditSeedClick(conf, team.seed)}
            className="px-3 flex items-center justify-center border-l border-white/5 hover:bg-white/20 text-gray-500 hover:text-white transition-colors"
            title="Swap Team"
          >
            <Repeat size={14} />
          </button>
        )}
      </div>
    );
  };

  const MatchupBox = ({ teamA, teamB, nextSlotId, label, isBaseSeed = false, conf }: any) => {
    let themeClass = "border border-white/10 bg-black/60";
    let innerClass = "bg-black/80 backdrop-blur-md w-full h-full flex flex-col overflow-hidden rounded-[10px]";

    if (conf === 'AFC') {
      themeClass = "p-[1px] bg-gradient-to-br from-[#E31837] to-white/10 shadow-[0_0_15px_rgba(227,24,55,0.15)] rounded-[11px]";
      innerClass = "bg-[#050505]/95 backdrop-blur-md rounded-[10px] w-full h-full flex flex-col overflow-hidden";
    } else if (conf === 'NFC') {
      themeClass = "p-[1px] bg-gradient-to-br from-[#013369] to-white/10 shadow-[0_0_15px_rgba(1,51,105,0.15)] rounded-[11px]";
      innerClass = "bg-[#050505]/95 backdrop-blur-md rounded-[10px] w-full h-full flex flex-col overflow-hidden";
    } else if (conf === 'SB') {
      themeClass = "p-[1.5px] bg-gradient-to-br from-purple-600 via-pink-500 to-amber-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] rounded-[12px]";
      innerClass = "bg-[#050505]/95 backdrop-blur-md rounded-[11px] w-full h-full flex flex-col overflow-hidden";
    }

    return (
      <div className={`w-40 sm:w-44 shrink-0 z-10 ${isCapturing ? 'shadow-none' : ''} ${themeClass}`}>
        <div className={innerClass}>
          <div className="bg-black/80 px-2 py-1.5 border-b border-white/5 text-center shadow-inner">
            <span className="font-sans text-[8px] font-black uppercase tracking-widest text-gray-400">{label}</span>
          </div>
          <TeamRow team={teamA} nextSlotId={nextSlotId} isBaseSeed={isBaseSeed} conf={conf} isTopRow={true} />
          <TeamRow team={teamB} nextSlotId={nextSlotId} isBaseSeed={isBaseSeed} conf={conf} isTopRow={false} />
        </div>
      </div>
    );
  };

  const Seed1Box = ({ conf }: { conf: 'AFC' | 'NFC' }) => {
    const team = seeds[conf][1];
    const teamSigla = team?.abbreviation || team?.abbr || 'Select';
    const logoToUse = team?.logo_url || TBD_TEAM.logo_url;

    let themeClass = "";
    let innerClass = "";
    
    if (conf === 'AFC') {
      themeClass = "p-[1px] bg-gradient-to-br from-[#E31837] to-white/10 shadow-[0_0_15px_rgba(227,24,55,0.15)] rounded-[11px]";
      innerClass = "bg-[#050505]/95 backdrop-blur-md rounded-[10px] flex items-stretch w-full overflow-hidden";
    } else {
      themeClass = "p-[1px] bg-gradient-to-br from-[#013369] to-white/10 shadow-[0_0_15px_rgba(1,51,105,0.15)] rounded-[11px]";
      innerClass = "bg-[#050505]/95 backdrop-blur-md rounded-[10px] flex items-stretch w-full overflow-hidden";
    }

    return (
      <div className="flex flex-col items-center gap-1.5 z-10">
        <span className="font-sans text-[8px] sm:text-[9px] font-black uppercase text-gray-500 tracking-widest text-center shadow-inner px-2 py-0.5 rounded bg-black/40 border border-white/5">{conf} 1st Seed (BYE)</span>
        <div className={`w-40 sm:w-44 shrink-0 ${isCapturing ? 'shadow-none' : ''} ${themeClass}`}>
          <div className={innerClass}>
            <button 
              onClick={() => { if(!team?.id) handleEditSeedClick(conf, 1); }}
              className="flex-1 p-2.5 h-11 flex items-center gap-2 hover:bg-white/10 transition"
            >
              <span className="font-jersey text-base sm:text-lg text-amber-500 w-4 text-center leading-none pt-0.5 drop-shadow-md">1</span>
              <img src={logoToUse} crossOrigin="anonymous" className="w-5 h-5 sm:w-6 sm:h-6 object-contain opacity-90 drop-shadow-sm" alt="Team Logo" />
              <span className="font-sport font-bold text-xs sm:text-sm uppercase text-white truncate tracking-wider pb-0.5 leading-none">{teamSigla}</span>
            </button>
            
            {team?.id && (
              <button 
                onClick={() => handleEditSeedClick(conf, 1)}
                className="px-3 flex items-center justify-center border-l border-white/5 hover:bg-white/20 text-gray-500 hover:text-white transition-colors"
                title="Swap Team"
              >
                <Repeat size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <LoadingScreen />;

  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans pb-32 relative overflow-hidden">
      
      {/* Spotlights Fundo Geral */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[150px] opacity-30 transition-colors duration-1000"
          style={{ backgroundColor: ambientPrimary }}
        />
        <div 
          className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full blur-[150px] opacity-20 transition-colors duration-1000"
          style={{ backgroundColor: ambientSecondary }}
        />
        <div 
          className="absolute inset-0 opacity-20 mix-blend-overlay"
          style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)' }}
        />
      </div>
      
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-slideDown">
          <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-xl border 
            ${toast.type === 'success' ? 'bg-[#10b981]/20 border-[#10b981]/50 text-[#10b981]' : 
              toast.type === 'info' ? 'bg-[#3b82f6]/20 border-[#3b82f6]/50 text-[#3b82f6]' : 
              'bg-[#ef4444]/20 border-[#ef4444]/50 text-[#ef4444]'}`}>
            <span className="font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="relative z-10">
        <Header />
        
        <div className="p-4 sm:p-6 space-y-6 mt-4 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between sm:items-end border-b border-white/10 pb-6 gap-6">
            <div>
              {/* Título com fonte Jersey ajustada */}
              <h1 className="font-jersey text-4xl sm:text-5xl uppercase tracking-widest mb-1 text-white">
                ROAD TO <span style={{ color: userColor, textShadow: `0 0 15px ${userColor}80` }}>SUPER BOWL LXI</span>
              </h1>
              <p className="font-sans text-xs sm:text-sm font-bold uppercase tracking-widest text-gray-400 mt-1">Click the teams to pick the winners and advance them.</p>
            </div>
            
            <div className="flex bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 shadow-xl w-full sm:w-auto overflow-hidden">
              <button 
                onClick={() => setShowClearConfirm(true)} 
                className="px-4 sm:px-5 py-2.5 rounded-lg font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest transition flex items-center gap-2 hover:bg-white/[0.02] text-gray-400 border border-transparent"
              >
                Clear
              </button>
              <button 
                onClick={handleSaveBracket} 
                disabled={isSaving}
                className="px-4 sm:px-5 py-2.5 rounded-lg font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest transition flex items-center gap-2 hover:bg-green-500/10 text-green-400 border border-transparent disabled:opacity-50 mx-1"
              >
                {isSaving ? 'Saving...' : 'Save'} <Save size={14} />
              </button>
              <button 
                onClick={handleShare} 
                disabled={isCapturing}
                className="px-4 sm:px-5 py-2.5 rounded-lg font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest transition shadow-lg flex items-center gap-2 hover:scale-105 disabled:opacity-70 disabled:cursor-wait" 
                style={{ backgroundColor: userColor, color: '#000' }}
              >
                {isCapturing ? 'Processing...' : 'Share'} {isCapturing ? <Loader2 size={14} className="animate-spin text-black" /> : <Camera size={14} className="text-black" />}
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto pb-8 scrollbar-hide">
            {/* LARGURA FIXA DE 1600px PARA GARANTIR ESPAÇO SEM CORTAR */}
            <div 
              ref={bracketRef} 
              className="min-w-[1600px] h-[680px] flex items-stretch justify-between relative bg-[#050505]/80 backdrop-blur-2xl rounded-3xl border border-white/10 py-8 px-12 shadow-2xl overflow-hidden"
            >
              
              {/* SPOTLIGHTS DE IMPRESSÃO VISÍVEIS NO PRINT */}
              <div className="absolute top-1/2 left-0 w-[550px] h-[550px] bg-[#E31837]/30 blur-[140px] pointer-events-none -translate-y-1/2 -translate-x-1/3 rounded-full z-0"></div>
              <div className="absolute top-1/2 right-0 w-[550px] h-[550px] bg-[#013369]/40 blur-[140px] pointer-events-none -translate-y-1/2 translate-x-1/3 rounded-full z-0"></div>

              <div className="flex flex-col justify-between z-10 py-4 shrink-0">
                <Seed1Box conf="AFC" />
                <div className="space-y-4">
                  <MatchupBox label="AFC Wild Card" teamA={seeds.AFC[2] || {seedNum:2}} teamB={seeds.AFC[7] || {seedNum:7}} nextSlotId="afc_wc_1" isBaseSeed conf="AFC" />
                  <MatchupBox label="AFC Wild Card" teamA={seeds.AFC[3] || {seedNum:3}} teamB={seeds.AFC[6] || {seedNum:6}} nextSlotId="afc_wc_2" isBaseSeed conf="AFC" />
                  <MatchupBox label="AFC Wild Card" teamA={seeds.AFC[4] || {seedNum:4}} teamB={seeds.AFC[5] || {seedNum:5}} nextSlotId="afc_wc_3" isBaseSeed conf="AFC" />
                </div>
              </div>

              <div className="flex flex-col justify-around z-10 pl-8 border-l border-dashed border-white/10 shrink-0">
                <MatchupBox label="AFC Divisional" teamA={afcDiv.m1.teamA} teamB={afcDiv.m1.teamB} nextSlotId="afc_div_1" conf="AFC" />
                <MatchupBox label="AFC Divisional" teamA={afcDiv.m2.teamA} teamB={afcDiv.m2.teamB} nextSlotId="afc_div_2" conf="AFC" />
              </div>

              <div className="flex flex-col justify-center z-10 pl-8 border-l border-dashed border-white/10 shrink-0">
                <MatchupBox label="AFC Championship" teamA={picks.afc_div_1} teamB={picks.afc_div_2} nextSlotId="sb_teamA" conf="AFC" />
              </div>

              <div className="shrink-0 flex flex-col justify-center items-center z-10 px-8 mx-4 pb-16 relative min-w-[260px]">
                <img 
                  crossOrigin="anonymous"
                  src="https://upload.wikimedia.org/wikipedia/fr/7/74/Super_Bowl_LXI_Logo.png" 
                  alt="Super Bowl LXI Logo" 
                  className={`h-32 mx-auto object-contain mb-6 ${isCapturing ? 'drop-shadow-none' : 'drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]'}`}
                />
                
                <MatchupBox label="Championship Game" teamA={picks.sb_teamA} teamB={picks.sb_teamB} nextSlotId="sb_winner" conf="SB" />
                
                <div className="h-24 mt-8 w-full flex justify-center items-center relative z-20">
                  {picks.sb_winner && (
                    <div className={`absolute bottom-2 animate-slideUp bg-neutral-950 p-[1.5px] sm:p-[2px] rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 ${isCapturing ? 'shadow-none' : 'shadow-[0_0_40px_rgba(245,158,11,0.6)]'}`}>
                      <div className="bg-black/90 backdrop-blur-xl rounded-[14px] px-8 py-4 flex flex-col items-center">
                        <span className="font-sans text-[10px] font-black uppercase text-amber-500 tracking-widest mb-1">Super Bowl Champion</span>
                        <div className="flex items-center gap-3 mt-1">
                            {picks.sb_winner.logo_url && <img src={picks.sb_winner.logo_url} crossOrigin="anonymous" className="w-10 h-10 object-contain drop-shadow-md" alt="" />}
                            <span className="font-sport font-bold text-2xl text-white drop-shadow-md tracking-wider leading-none">{picks.sb_winner.abbreviation || picks.sb_winner.abbr}</span>
                          </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col justify-center z-10 pr-8 border-r border-dashed border-white/10 shrink-0">
                <MatchupBox label="NFC Championship" teamA={picks.nfc_div_1} teamB={picks.nfc_div_2} nextSlotId="sb_teamB" conf="NFC" />
              </div>

              <div className="flex flex-col justify-around z-10 pr-8 border-r border-dashed border-white/10 shrink-0">
                <MatchupBox label="NFC Divisional" teamA={nfcDiv.m1.teamA} teamB={nfcDiv.m1.teamB} nextSlotId="nfc_div_1" conf="NFC" />
                <MatchupBox label="NFC Divisional" teamA={nfcDiv.m2.teamA} teamB={nfcDiv.m2.teamB} nextSlotId="nfc_div_2" conf="NFC" />
              </div>

              <div className="flex flex-col justify-between z-10 py-4 shrink-0">
                <Seed1Box conf="NFC" />
                <div className="space-y-4">
                  <MatchupBox label="NFC Wild Card" teamA={seeds.NFC[2] || {seedNum:2}} teamB={seeds.NFC[7] || {seedNum:7}} nextSlotId="nfc_wc_1" isBaseSeed conf="NFC" />
                  <MatchupBox label="NFC Wild Card" teamA={seeds.NFC[3] || {seedNum:3}} teamB={seeds.NFC[6] || {seedNum:6}} nextSlotId="nfc_wc_2" isBaseSeed conf="NFC" />
                  <MatchupBox label="NFC Wild Card" teamA={seeds.NFC[4] || {seedNum:4}} teamB={seeds.NFC[5] || {seedNum:5}} nextSlotId="nfc_wc_3" isBaseSeed conf="NFC" />
                </div>
              </div>

              {/* MARCA D'ÁGUA EM CAIXA PREMIUM NO CENTRO INFERIOR */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-0">
                <div 
                  className="px-10 py-3 rounded-2xl border flex flex-col items-center shadow-2xl backdrop-blur-md"
                  style={{ 
                    background: `linear-gradient(135deg, ${ambientPrimary}40, ${ambientSecondary}40)`,
                    borderColor: `${userColor}70`,
                    boxShadow: `0 0 35px ${userColor}50`
                  }}
                >
                  <span className="font-jersey uppercase tracking-widest text-white text-4xl leading-none drop-shadow-md pt-1">
                    BLITZ<span style={{ color: userColor, textShadow: `0 0 10px ${userColor}` }}>PICKS</span>
                  </span>
                  <span className="font-sans text-[10px] font-black uppercase tracking-widest text-white/90 mt-1.5">Bracket Challenge 2026</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {isModalOpen && activeSlot && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[999999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-5 border-b border-white/10 pb-4">
              <h3 className="font-jersey text-3xl sm:text-4xl uppercase tracking-widest text-white drop-shadow-md">
                Select <span className={activeSlot.conf === 'AFC' ? 'text-red-500' : 'text-blue-500'}>{activeSlot.conf}</span> Seed <span className="text-amber-500">{activeSlot.seed}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full p-2"><X size={20} /></button>
            </div>
            
            <div className="overflow-y-auto space-y-2.5 pr-2 custom-scrollbar">
              {allTeams
                .filter(team => team.conference === activeSlot.conf)
                .map(team => {
                  let isDivisionTaken = false;
                  const isTop4Seed = activeSlot.seed <= 4;
                  
                  if (isTop4Seed) {
                    const takenDivisions = getTakenDivisions(activeSlot.conf, activeSlot.seed);
                    if (takenDivisions.has(team.division)) {
                      isDivisionTaken = true;
                    }
                  }

                  const isAlreadySelected = Object.values(seeds[activeSlot.conf]).some(s => s && s.id === team.id && s.seed !== activeSlot.seed);
                  const isDisabled = isDivisionTaken || isAlreadySelected;

                  return (
                    <button 
                      key={team.id}
                      disabled={isDisabled}
                      onClick={() => handleSetSeed(team)}
                      className={`w-full flex items-center justify-between p-3.5 sm:p-4 border rounded-xl transition-all text-left ${isDisabled ? 'opacity-40 cursor-not-allowed bg-black/60 border-transparent' : 'bg-black/40 border-white/10 hover:border-white/30 hover:bg-white/[0.02] shadow-inner'}`}
                    >
                      <div className="flex items-center gap-4">
                        {team.logo_url && <img src={team.logo_url} alt="" className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-md" />}
                        <span className="font-sport font-bold text-sm sm:text-base uppercase tracking-wider text-white">{team.name}</span>
                      </div>
                      
                      {isDivisionTaken && (
                        <span className="font-sans text-[8px] sm:text-[9px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                          {team.division} Taken
                        </span>
                      )}
                      {isAlreadySelected && !isDivisionTaken && (
                        <span className="font-sans text-[8px] sm:text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                          In Bracket Challenge
                        </span>
                      )}
                    </button>
                  );
              })}
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[999999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-black/90 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-sm p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5 shadow-inner">
              <AlertTriangle size={28} className="text-red-500 drop-shadow-md" />
            </div>
            <h3 className="font-jersey text-3xl sm:text-4xl uppercase tracking-widest mb-3 text-white">RESET BRACKET?</h3>
            <p className="font-sans text-[10px] sm:text-xs text-gray-400 mb-8 font-black uppercase tracking-widest leading-relaxed">
              Are you sure you want to clear your entire bracket? This action will permanently delete your selections from the database.
            </p>
            
            <div className="flex items-center gap-3 w-full">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3.5 rounded-xl font-sans font-black uppercase tracking-widest text-[10px] sm:text-xs transition-colors border border-white/10 text-gray-400 hover:bg-white/[0.02] hover:text-white"
              >
                Cancel
              </button>
              <button 
                onClick={confirmReset}
                className="flex-1 py-3.5 rounded-xl font-sans font-black uppercase tracking-widest text-[10px] sm:text-xs transition-colors bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30 shadow-inner"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
      `}</style>
    </main>
  );
}