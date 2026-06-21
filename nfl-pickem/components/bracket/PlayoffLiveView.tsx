"use client";

import React from 'react';

type Team = { id: string | number; name: string; abbreviation: string; logo_url: string; seed: number; conference: string };

const TBD_TEAM = { abbreviation: 'TBD', logo_url: 'https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg' };

interface PlayoffLiveViewProps {
  userAccentColor: string;
  userInitialSeeds: { AFC: Record<number, Team>; NFC: Record<number, Team> };
  realResults: Record<string, Team | null>;
}

export default function PlayoffLiveView({ userAccentColor, userInitialSeeds, realResults }: PlayoffLiveViewProps) {
  
  const getThemeWrapper = (conf: 'AFC' | 'NFC' | 'SB') => {
    if (conf === 'AFC') return "p-[1.5px] bg-gradient-to-br from-[#E31837] to-white shadow-[0_0_15px_rgba(227,24,55,0.15)] rounded-lg";
    if (conf === 'NFC') return "p-[1.5px] bg-gradient-to-br from-[#013369] to-white shadow-[0_0_15px_rgba(1,51,105,0.15)] rounded-lg";
    return "p-[2px] bg-gradient-to-br from-purple-600 via-pink-500 to-amber-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] rounded-lg";
  };

  const TeamRowLive = ({ team, matchupId, conf, isTopRow }: any) => {
    const teamSigla = team?.abbreviation || team?.name || 'TBD';
    const logoToUse = team?.logo_url || 'https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg';
    
    let statusColor = 'text-gray-400';
    let bgColor = 'bg-neutral-950/95';
    let label = '';
    
    const winnerReal = realResults[`${conf.toLowerCase()}_${matchupId}`];
    
    if (team?.id && winnerReal?.id) {
      if (team.id === winnerReal.id) {
        statusColor = 'text-green-400 drop-shadow-md';
        bgColor = 'bg-green-500/10';
        label = '✓';
      } else {
        statusColor = 'text-red-500 line-through opacity-70';
        bgColor = 'bg-red-500/5';
        label = '✕';
      }
    } else if (team?.id) {
      statusColor = 'text-white';
    }

    return (
      <div className={`flex items-center gap-2.5 p-2.5 h-12 transition-colors ${isTopRow ? 'border-b border-white/5' : ''} ${bgColor}`}>
        <span className="text-[11px] font-bold text-gray-500 w-4 text-center">{team?.seed || '-'}</span>
        <img src={logoToUse} className="w-6 h-6 object-contain opacity-90" alt="" />
        <span className={`text-sm font-black uppercase truncate flex-1 ${statusColor}`}>
          {teamSigla}
        </span>
        {label && <span className={`text-xs font-bold ${label === '✓' ? 'text-green-400' : 'text-red-500'}`}>{label}</span>}
      </div>
    );
  };

  const MatchupBoxLive = ({ teamA, teamB, matchupId, label, conf }: any) => (
    <div className={getThemeWrapper(conf)}>
      <div className="bg-neutral-950/95 rounded-[7px] overflow-hidden flex flex-col w-44 shrink-0 z-10">
        <div className="bg-black/60 px-3 py-1.5 border-b border-white/5 text-center">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</span>
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
    <div className="w-full overflow-x-auto pb-8 scrollbar-hide">
      {/* CORREÇÃO: min-w expandido para 1600px. 
        Isso garante que a matemática do Flexbox não esmague a NFC do lado direito.
      */}
      <div className="min-w-[1600px] h-[720px] flex items-stretch justify-between relative bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] rounded-3xl border border-white/10 py-8 px-10 shadow-2xl overflow-hidden">
        
        <div className="absolute top-0 left-0 w-1/3 h-full bg-red-600/5 blur-[120px] pointer-events-none z-0"></div>
        <div className="absolute top-0 right-0 w-1/3 h-full bg-blue-600/5 blur-[120px] pointer-events-none z-0"></div>

        {/* AFC - COLUNA 1 */}
        <div className="flex flex-col justify-between z-10 py-4 shrink-0">
          <div className="flex flex-col items-center gap-1 z-10">
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest text-center">AFC 1st Seed (BYE)</span>
            <div className={getThemeWrapper('AFC')}>
              <div className="bg-neutral-950/95 rounded-[7px] w-44 p-2.5 flex items-center gap-3 border border-white/5">
                <span className="text-[11px] font-bold text-amber-500 w-4 text-center">1</span>
                <img src={userInitialSeeds.AFC[1]?.logo_url || TBD_TEAM.logo_url} className="w-6 h-6 object-contain" alt="" /> 
                <span className="font-black text-sm uppercase text-white truncate">{userInitialSeeds.AFC[1]?.abbreviation || 'TBD'}</span>
              </div>
            </div>
          </div>
          {afc.wcMatchups.map(m => <MatchupBoxLive key={m.id} {...m} matchupId={m.id} conf="AFC" />)}
        </div>

        {/* AFC - COLUNA 2 */}
        <div className="flex flex-col justify-around z-10 pl-8 border-l border-dashed border-white/10 shrink-0">
          <MatchupBoxLive {...afc.div1} matchupId="div_1" conf="AFC" />
          <MatchupBoxLive {...afc.div2} matchupId="div_2" conf="AFC" />
        </div>

        {/* AFC - COLUNA 3 */}
        <div className="flex flex-col justify-center z-10 pl-8 border-l border-dashed border-white/10 shrink-0">
          <MatchupBoxLive {...afc.champ} matchupId="champ" conf="AFC" />
        </div>

        {/* CENTRO: SUPER BOWL LXI */}
        <div className="shrink-0 flex flex-col justify-center items-center z-10 px-8 mx-4 pb-12 relative min-w-[260px]">
          <img src="https://upload.wikimedia.org/wikipedia/fr/7/74/Super_Bowl_LXI_Logo.png" alt="SB LXI" className="h-32 mb-6 drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]" />
          
          <MatchupBoxLive {...superBowl} matchupId="sb" conf="SB" label="Championship Game" />

          {sbWinnerReal && (
            <div className="absolute bottom-10 animate-slideUp">
              <div className="bg-neutral-950 p-[2px] rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_40px_rgba(245,158,11,0.6)]">
                <div className="bg-black rounded-[14px] px-8 py-4 flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-1">Super Bowl Champion</span>
                  <div className="flex items-center gap-3 mt-1">
                      <img src={sbWinnerReal.logo_url} className="w-10 h-10 object-contain drop-shadow-md" alt="" />
                      <span className="font-black text-2xl text-white drop-shadow-md">{sbWinnerReal.abbreviation || sbWinnerReal.name}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* NFC - COLUNA 3 */}
        <div className="flex flex-col justify-center z-10 pr-8 border-r border-dashed border-white/10 shrink-0">
          <MatchupBoxLive {...nfc.champ} matchupId="champ" conf="NFC" />
        </div>

        {/* NFC - COLUNA 2 */}
        <div className="flex flex-col justify-around z-10 pr-8 border-r border-dashed border-white/10 shrink-0">
          <MatchupBoxLive {...nfc.div1} matchupId="div_1" conf="NFC" />
          <MatchupBoxLive {...nfc.div2} matchupId="div_2" conf="NFC" />
        </div>

        {/* NFC - COLUNA 1 */}
        <div className="flex flex-col justify-between z-10 py-4 shrink-0">
          <div className="flex flex-col items-center gap-1 z-10">
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest text-center">NFC 1st Seed (BYE)</span>
            <div className={getThemeWrapper('NFC')}>
              <div className="bg-neutral-950/95 rounded-[7px] w-44 p-2.5 flex items-center gap-3 border border-white/5">
                <span className="text-[11px] font-bold text-amber-500 w-4 text-center">1</span>
                <img src={userInitialSeeds.NFC[1]?.logo_url || TBD_TEAM.logo_url} className="w-6 h-6 object-contain" alt="" /> 
                <span className="font-black text-sm uppercase text-white truncate">{userInitialSeeds.NFC[1]?.abbreviation || 'TBD'}</span>
              </div>
            </div>
          </div>
          {nfc.wcMatchups.map(m => <MatchupBoxLive key={m.id} {...m} matchupId={m.id} conf="NFC" />)}
        </div>
        
        {/* Marca d'água */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-30 flex flex-col items-center pointer-events-none z-0">
          <span className="font-black italic uppercase tracking-tighter text-white text-2xl">
            Blitz<span style={{ color: userAccentColor }}>Picks</span>
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-white mt-1">Live Bracket Results</span>
        </div>

      </div>
    </div>
  );
}