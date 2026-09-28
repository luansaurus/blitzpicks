"use client";

import React from 'react';
import { Check, X } from 'lucide-react';

type Team = { id: string | number; name: string; abbreviation: string; logo_url: string; seed: number; conference: string };

const TBD_TEAM = { abbreviation: 'TBD', logo_url: 'https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg' };

interface PlayoffLiveViewProps {
  userAccentColor: string;
  userInitialSeeds: { AFC: Record<number, any>; NFC: Record<number, any> }; 
  realResults: Record<string, Team | null>;
}

export default function PlayoffLiveView({ userAccentColor, userInitialSeeds, realResults }: PlayoffLiveViewProps) {
  
  const getThemeWrapper = (conf: 'AFC' | 'NFC' | 'SB') => {
    if (conf === 'AFC') return "p-[1px] bg-gradient-to-br from-[#E31837] to-white/10 shadow-[0_0_15px_rgba(227,24,55,0.15)] rounded-xl";
    if (conf === 'NFC') return "p-[1px] bg-gradient-to-br from-[#013369] to-white/10 shadow-[0_0_15px_rgba(1,51,105,0.15)] rounded-xl";
    return "p-[1.5px] bg-gradient-to-br from-purple-600 via-pink-500 to-amber-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] rounded-xl";
  };

  const TeamRowLive = ({ team, matchupId, conf, isTopRow }: any) => {
    const teamSigla = team?.abbreviation || team?.name || 'TBD';
    const logoToUse = team?.logo_url || 'https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg';
    
    let statusColor = 'text-gray-400';
    let bgColor = 'bg-[#0a0a0a]/90';
    let label: 'win' | 'loss' | '' = '';
    
    const winnerReal = realResults[`${conf.toLowerCase()}_${matchupId}`];
    
    if (team?.id && winnerReal?.id) {
      if (team.id === winnerReal.id) {
        statusColor = 'text-green-400 drop-shadow-md';
        bgColor = 'bg-green-500/10';
        label = 'win';
      } else {
        statusColor = 'text-red-500/60 line-through';
        bgColor = 'bg-red-500/5';
        label = 'loss';
      }
    } else if (team?.id) {
      statusColor = 'text-white';
    }

    return (
      <div className={`flex items-center gap-2.5 p-2.5 h-11 transition-colors ${isTopRow ? 'border-b border-white/5' : ''} ${bgColor}`}>
        <span className="font-jersey text-base sm:text-lg text-gray-500 w-4 text-center leading-none pt-0.5">{team?.seed || '-'}</span>
        <img src={logoToUse} className="w-5 h-5 sm:w-6 sm:h-6 object-contain opacity-90 drop-shadow-sm" alt="" />
        <span className={`font-sport font-bold text-xs sm:text-sm uppercase tracking-wider truncate flex-1 leading-none pb-0.5 ${statusColor}`}>
          {teamSigla}
        </span>
        {label === 'win' && <Check size={14} className="text-green-400 shrink-0" />}
        {label === 'loss' && <X size={14} className="text-red-500/60 shrink-0" />}
      </div>
    );
  };

  const MatchupBoxLive = ({ teamA, teamB, matchupId, label, conf }: any) => (
    <div className={getThemeWrapper(conf)}>
      <div className="bg-[#050505]/95 backdrop-blur-md rounded-[11px] overflow-hidden flex flex-col w-40 sm:w-44 shrink-0 z-10">
        <div className="bg-black/80 px-3 py-1.5 border-b border-white/5 text-center shadow-inner">
          <span className="font-sans text-[8px] font-black uppercase tracking-widest text-gray-400">{label}</span>
        </div>
        <TeamRowLive team={teamA} matchupId={matchupId} conf={conf} isTopRow={true} />
        <TeamRowLive team={teamB} matchupId={matchupId} conf={conf} isTopRow={false} />
      </div>
    </div>
  );

  const getConferenceData = (conf: 'AFC' | 'NFC') => {
    const seedsIniciais = userInitialSeeds[conf] || {};
    const confLower = conf.toLowerCase();

    const wcMatchups = [
      { id: 'wc_1', label: `${conf} Wild Card`, teamA: seedsIniciais[2], teamB: seedsIniciais[7] },
      { id: 'wc_2', label: `${conf} Wild Card`, teamA: seedsIniciais[3], teamB: seedsIniciais[6] },
      { id: 'wc_3', label: `${conf} Wild Card`, teamA: seedsIniciais[4], teamB: seedsIniciais[5] },
    ];

    const realWcWinners = [realResults[`${confLower}_wc_1`], realResults[`${confLower}_wc_2`], realResults[`${confLower}_wc_3`]].filter(Boolean) as Team[];
    realWcWinners.sort((a, b) => a.seed - b.seed);

    const div1 = { label: `${conf} Divisional`, teamA: seedsIniciais[1], teamB: realWcWinners[2] || { abbreviation: 'TBD', logo_url: TBD_TEAM.logo_url } };
    const div2 = { label: `${conf} Divisional`, teamA: realWcWinners[0] || { abbreviation: 'TBD', logo_url: TBD_TEAM.logo_url }, teamB: realWcWinners[1] || { abbreviation: 'TBD', logo_url: TBD_TEAM.logo_url } };

    const div1WinnerReal = realResults[`${confLower}_div_1`];
    const div2WinnerReal = realResults[`${confLower}_div_2`];

    const champ = {
      label: `${conf} Championship`,
      teamA: div1WinnerReal || { abbreviation: 'TBD', logo_url: TBD_TEAM.logo_url },
      teamB: div2WinnerReal || { abbreviation: 'TBD', logo_url: TBD_TEAM.logo_url },
    };

    return { wcMatchups, div1, div2, champ, champWinnerReal: realResults[`${confLower}_champ`] };
  };

  const afc = getConferenceData('AFC');
  const nfc = getConferenceData('NFC');
  const sbWinnerReal = realResults['sb_winner'];
  
  const superBowl = { 
    label: 'Championship Game', 
    teamA: afc.champWinnerReal || { abbreviation: 'TBD', logo_url: TBD_TEAM.logo_url }, 
    teamB: nfc.champWinnerReal || { abbreviation: 'TBD', logo_url: TBD_TEAM.logo_url } 
  };

  return (
    <div className="w-full overflow-x-auto pb-4 scrollbar-hide">
      <div className="min-w-[1400px] h-[640px] sm:min-w-[1500px] sm:h-[680px] flex items-stretch justify-between relative bg-black/40 rounded-2xl py-6 px-6 sm:px-10 overflow-hidden">
        
        {/* AFC - COLUNA 1 */}
        <div className="flex flex-col justify-between z-10 py-4 shrink-0">
          <div className="flex flex-col items-center gap-1.5 z-10">
            <span className="font-sans text-[8px] sm:text-[9px] font-black uppercase text-gray-500 tracking-widest text-center shadow-inner px-2 py-0.5 rounded bg-black/40 border border-white/5">AFC 1st Seed (BYE)</span>
            <div className={getThemeWrapper('AFC')}>
              <div className="bg-[#050505]/95 backdrop-blur-md rounded-[11px] w-40 sm:w-44 p-2.5 flex items-center gap-3 border border-white/5">
                <span className="font-jersey text-base sm:text-lg text-amber-500 w-4 text-center leading-none pt-0.5 drop-shadow-md">1</span>
                <img src={userInitialSeeds.AFC[1]?.logo_url || TBD_TEAM.logo_url} className="w-5 h-5 sm:w-6 sm:h-6 object-contain drop-shadow-md" alt="" /> 
                <span className="font-sport font-bold text-xs sm:text-sm uppercase text-white truncate tracking-wider pb-0.5 leading-none">{userInitialSeeds.AFC[1]?.abbreviation || 'TBD'}</span>
              </div>
            </div>
          </div>
          {afc.wcMatchups.map(m => <MatchupBoxLive key={m.id} {...m} matchupId={m.id} conf="AFC" />)}
        </div>

        {/* AFC - COLUNA 2 */}
        <div className="flex flex-col justify-around z-10 pl-6 sm:pl-8 border-l border-dashed border-white/10 shrink-0">
          <MatchupBoxLive {...afc.div1} matchupId="div_1" conf="AFC" />
          <MatchupBoxLive {...afc.div2} matchupId="div_2" conf="AFC" />
        </div>

        {/* AFC - COLUNA 3 */}
        <div className="flex flex-col justify-center z-10 pl-6 sm:pl-8 border-l border-dashed border-white/10 shrink-0">
          <MatchupBoxLive {...afc.champ} matchupId="champ" conf="AFC" />
        </div>

        {/* CENTRO: SUPER BOWL LXI */}
        <div className="shrink-0 flex flex-col justify-center items-center z-10 px-6 sm:px-8 mx-2 sm:mx-4 pb-12 relative min-w-[240px] sm:min-w-[260px]">
          <img src="https://upload.wikimedia.org/wikipedia/fr/7/74/Super_Bowl_LXI_Logo.png" alt="SB LXI" className="h-28 sm:h-32 mb-6 drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]" />
          
          <MatchupBoxLive {...superBowl} matchupId="sb" conf="SB" label="Championship Game" />

          {sbWinnerReal && (
            <div className="absolute bottom-6 sm:bottom-10 animate-slideUp">
              <div className="bg-neutral-950 p-[1.5px] sm:p-[2px] rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                <div className="bg-black/90 backdrop-blur-xl rounded-[14px] px-6 py-3 sm:px-8 sm:py-4 flex flex-col items-center">
                  <span className="font-sans text-[8px] sm:text-[10px] font-black uppercase text-amber-500 tracking-widest mb-1">Super Bowl Champion</span>
                  <div className="flex items-center gap-2.5 sm:gap-3 mt-1">
                      <img src={sbWinnerReal.logo_url} className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-lg" alt="" />
                      <span className="font-sport font-bold text-xl sm:text-2xl text-white drop-shadow-md tracking-wider leading-none">{sbWinnerReal.abbreviation || sbWinnerReal.name}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* NFC - COLUNA 3 */}
        <div className="flex flex-col justify-center z-10 pr-6 sm:pr-8 border-r border-dashed border-white/10 shrink-0">
          <MatchupBoxLive {...nfc.champ} matchupId="champ" conf="NFC" />
        </div>

        {/* NFC - COLUNA 2 */}
        <div className="flex flex-col justify-around z-10 pr-6 sm:pr-8 border-r border-dashed border-white/10 shrink-0">
          <MatchupBoxLive {...nfc.div1} matchupId="div_1" conf="NFC" />
          <MatchupBoxLive {...nfc.div2} matchupId="div_2" conf="NFC" />
        </div>

        {/* NFC - COLUNA 1 */}
        <div className="flex flex-col justify-between z-10 py-4 shrink-0">
          <div className="flex flex-col items-center gap-1.5 z-10">
            <span className="font-sans text-[8px] sm:text-[9px] font-black uppercase text-gray-500 tracking-widest text-center shadow-inner px-2 py-0.5 rounded bg-black/40 border border-white/5">NFC 1st Seed (BYE)</span>
            <div className={getThemeWrapper('NFC')}>
              <div className="bg-[#050505]/95 backdrop-blur-md rounded-[11px] w-40 sm:w-44 p-2.5 flex items-center gap-3 border border-white/5">
                <span className="font-jersey text-base sm:text-lg text-amber-500 w-4 text-center leading-none pt-0.5 drop-shadow-md">1</span>
                <img src={userInitialSeeds.NFC[1]?.logo_url || TBD_TEAM.logo_url} className="w-5 h-5 sm:w-6 sm:h-6 object-contain drop-shadow-md" alt="" /> 
                <span className="font-sport font-bold text-xs sm:text-sm uppercase text-white truncate tracking-wider pb-0.5 leading-none">{userInitialSeeds.NFC[1]?.abbreviation || 'TBD'}</span>
              </div>
            </div>
          </div>
          {nfc.wcMatchups.map(m => <MatchupBoxLive key={m.id} {...m} matchupId={m.id} conf="NFC" />)}
        </div>
        
        {/* Marca d'água */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-20 flex flex-col items-center pointer-events-none z-0">
          <span className="font-jersey uppercase tracking-widest text-white text-3xl leading-none">
            BLITZ<span style={{ color: userAccentColor, textShadow: `0 0 10px ${userAccentColor}80` }}>PICKS</span>
          </span>
          <span className="font-sans text-[8px] font-black uppercase tracking-widest text-white mt-1.5">Live Bracket Results</span>
        </div>

      </div>
    </div>
  );
}