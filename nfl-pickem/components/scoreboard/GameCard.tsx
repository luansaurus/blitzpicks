"use client";

import { useState } from 'react';
import { getPickResult } from '@/utils/scoring';

export default function GameCard({
  game,
  userTeamColor,
  homeTeam,
  awayTeam,
  existingPick,
  onPickChange,
  isUnsaved,
  customRules
}: any) {
  const [showStats, setShowStats] = useState(false);

  const isFinished = game.status === 'finished';
  const isLive = game.status === 'in_progress';
  
  const homeScore = game.home_score;
  const awayScore = game.away_score;

  const pickResult = (isFinished || isLive) && existingPick
    ? getPickResult(game, existingPick, customRules || { exact: 7, diff: 5, winner: 3 })
    : { points: 0, label: '-' };

  // --- LÓGICA DE CORES DINÂMICAS PARA OS PONTOS ---
  let cardBg = 'bg-[#0a0a0a]';
  let cardBorder = 'border-white/10';
  let resultBg = 'bg-black/30';
  let resultBadge = 'bg-white/5 border border-white/10 text-gray-400';

  if (isUnsaved) {
    cardBorder = 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
  } else if ((isFinished || isLive) && existingPick) {
    if (pickResult.points >= 7) {
      // Na mosca (Exato) -> Dourado
      cardBg = 'bg-gradient-to-b from-yellow-900/20 to-[#0a0a0a]';
      cardBorder = 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]';
      resultBg = 'bg-yellow-500/10';
      resultBadge = 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400';
    } else if (pickResult.points >= 3) {
      // Acertou Vencedor ou Diferença -> Verde
      cardBg = 'bg-gradient-to-b from-green-900/20 to-[#0a0a0a]';
      cardBorder = 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]';
      resultBg = 'bg-green-500/10';
      resultBadge = 'bg-green-500/20 border border-green-500/50 text-green-400';
    } else {
      // Errou -> Vermelho sutil
      cardBg = 'bg-gradient-to-b from-red-900/10 to-[#0a0a0a]';
      cardBorder = 'border-red-900/30';
      resultBg = 'bg-red-950/20';
      resultBadge = 'bg-red-900/40 border border-red-900/50 text-red-400';
    }
  } else if (isLive) {
    // Jogo ao vivo sem palpite
    cardBorder = 'border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]';
  }

  // --- FILTRO DE STATS ---
  const filterAndFormatLeaders = (leaders: any[]) => {
    const result: any[] = [];
    
    // 1. Ataque (Remove os Teams para garantir que sejam os jogadores)
    const offensiveCategories = ['PASS', 'RUSH', 'REC'];
    const offensive = leaders.filter(l => {
      const cat = l.category?.toUpperCase() || '';
      return offensiveCategories.some(a => cat.includes(a)) && cat !== 'TEAM_DEF' && cat !== 'TEAM_ST';
    }).map(l => {
      let badge = 'STAT';
      const cat = l.category?.toUpperCase() || '';
      if (cat.includes('PASS')) badge = 'PASS';
      else if (cat.includes('RUSH')) badge = 'RUSH';
      else if (cat.includes('REC')) badge = 'REC';

      let formattedStat = l.stat || '-';
      if (!isNaN(Number(formattedStat))) formattedStat = `${formattedStat} ${badge}`;
      else formattedStat = formattedStat.replace(/YARDS YDS/gi, 'YDS').replace(/YDS YDS/gi, 'YDS');

      return { ...l, badge, formattedStat };
    }).slice(0, 3);
    result.push(...offensive);

    // 2. Defesa 
    const teamDef = leaders.find(l => l.category === 'TEAM_DEF');
    if (teamDef) {
      result.push({ ...teamDef, badge: 'DEF', formattedStat: teamDef.stat });
    } else {
      result.push({ name: 'Team Defense', badge: 'DEF', formattedStat: '0 Sacks, 0 INT, 0 Fum. Rec.' });
    }

    // 3. Special Teams
    const teamSt = leaders.find(l => l.category === 'TEAM_ST');
    if (teamSt) {
      result.push({ ...teamSt, badge: 'ST', formattedStat: teamSt.stat });
    } else {
      result.push({ name: 'Special Teams', badge: 'ST', formattedStat: '0/0 FG | 0/0 XP | 0 Punts' });
    }

    return result;
  };

  let homeLeaders: any[] = [];
  let awayLeaders: any[] = [];
  
  if (game.meta_data && game.meta_data.leaders) {
    homeLeaders = filterAndFormatLeaders(game.meta_data.leaders.home || []);
    awayLeaders = filterAndFormatLeaders(game.meta_data.leaders.away || []);
  }

  const awayLinescores = game.meta_data?.linescores?.away || [];
  const homeLinescores = game.meta_data?.linescores?.home || [];
  const periods = Math.max(4, awayLinescores.length, homeLinescores.length);
  const periodLabels = Array.from({ length: periods }, (_, i) => i < 4 ? (i + 1).toString() : 'OT');

  return (
    <div className={`flex flex-col ${cardBg} border ${cardBorder} rounded-xl overflow-hidden transition-all duration-300`}>
      
      {/* ---------------- CABEÇALHO DO CARD (PLACAR) ---------------- */}
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        
        {/* Rótulos: REAL e PICK */}
        <div className="flex justify-end gap-6 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500 pr-2">
           <span className="w-8 text-center">Real</span>
           <span className="w-12 text-center">Pick</span>
        </div>

        {/* TIME VISITANTE (AWAY) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             {awayTeam.logo && <img src={awayTeam.logo} alt={awayTeam.abbr} className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-md" />}
             <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">{awayTeam.name?.split(' ').pop() || awayTeam.abbr}</span>
                <span className="text-[10px] sm:text-xs font-bold text-gray-500">{awayTeam.record}</span>
             </div>
          </div>
          <div className="flex items-center gap-6">
             <span className="text-2xl sm:text-3xl font-black text-white w-8 text-center">{awayScore !== null ? awayScore : '-'}</span>
             <input 
                type="number" 
                value={existingPick?.away_guess ?? ""} 
                onChange={(e) => onPickChange(game.id, existingPick?.home_guess?.toString() ?? "", e.target.value)}
                disabled={isFinished || isLive}
                className="w-12 h-12 bg-neutral-900 border border-white/10 rounded-xl text-center text-xl font-black text-white focus:outline-none focus:border-red-500 disabled:opacity-50 transition-colors"
             />
          </div>
        </div>

        {/* TIME DA CASA (HOME) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             {homeTeam.logo && <img src={homeTeam.logo} alt={homeTeam.abbr} className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-md" />}
             <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">{homeTeam.name?.split(' ').pop() || homeTeam.abbr}</span>
                <span className="text-[10px] sm:text-xs font-bold text-gray-500">{homeTeam.record}</span>
             </div>
          </div>
          <div className="flex items-center gap-6">
             <span className="text-2xl sm:text-3xl font-black text-white w-8 text-center">{homeScore !== null ? homeScore : '-'}</span>
             <input 
                type="number" 
                value={existingPick?.home_guess ?? ""} 
                onChange={(e) => onPickChange(game.id, e.target.value, existingPick?.away_guess?.toString() ?? "")}
                disabled={isFinished || isLive}
                className="w-12 h-12 bg-neutral-900 border border-white/10 rounded-xl text-center text-xl font-black text-white focus:outline-none focus:border-red-500 disabled:opacity-50 transition-colors"
             />
          </div>
        </div>
      </div>

      {/* ---------------- BARRA DE RESULTADO DO PALPITE ---------------- */}
      <div className={`flex justify-between items-center px-4 sm:px-5 py-3 border-t border-white/5 ${resultBg}`}>
         <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pick Result</span>
         <span className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest ${resultBadge}`}>
           {pickResult.points} PTS
         </span>
      </div>

      {/* ---------------- BOTÃO SANFONA ---------------- */}
      <button 
        onClick={() => setShowStats(!showStats)}
        className="w-full py-3 border-t border-white/5 bg-black/50 hover:bg-black/70 transition-colors flex justify-center items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest"
      >
        {showStats ? 'Hide Game Stats ▲' : 'Show Game Stats ▼'}
      </button>

      {/* ---------------- ESTATÍSTICAS EXPANSÍVEIS ---------------- */}
      {showStats && (
        <div className="p-4 sm:p-5 border-t border-white/5 bg-neutral-950/60 flex flex-col gap-6 animate-fadeIn">
           
           {/* Linescores */}
           {awayLinescores.length > 0 && homeLinescores.length > 0 && (
             <div className="bg-black/50 border border-white/5 rounded-xl p-3 sm:p-4 overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                   <thead>
                      <tr className="text-gray-500 border-b border-white/5">
                         <th className="pb-2 font-black uppercase tracking-widest">Team</th>
                         {periodLabels.map(p => <th key={p} className="pb-2 text-center font-black uppercase w-8">{p}</th>)}
                         <th className="pb-2 text-center font-black uppercase text-white w-8">T</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                      <tr>
                         <td className="py-2.5 font-black text-white uppercase">{awayTeam.abbr}</td>
                         {awayLinescores.map((score:number, i:number) => <td key={i} className="py-2.5 text-center text-gray-400 font-bold">{score}</td>)}
                         <td className="py-2.5 text-center text-white font-black">{awayScore}</td>
                      </tr>
                      <tr>
                         <td className="py-2.5 font-black text-white uppercase">{homeTeam.abbr}</td>
                         {homeLinescores.map((score:number, i:number) => <td key={i} className="py-2.5 text-center text-gray-400 font-bold">{score}</td>)}
                         <td className="py-2.5 text-center text-white font-black">{homeScore}</td>
                      </tr>
                   </tbody>
                </table>
             </div>
           )}

           {/* Grade de Líderes por Time */}
           {(awayLeaders.length > 0 || homeLeaders.length > 0) && (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                
                {/* LÍDERES VISITANTES (AWAY) */}
                <div className="flex flex-col gap-3">
                   <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-white/5 pb-2">
                     {awayTeam.abbr} Leaders
                   </span>
                   <div className="flex flex-col gap-2">
                     {awayLeaders.map((l: any, i: number) => (
                       <div key={i} className="flex flex-col bg-black/40 border border-white/5 rounded-lg p-2.5">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-gray-300 text-xs font-bold truncate pr-2">{l.name}</span>
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${l.badge === 'DEF' || l.badge === 'ST' ? 'bg-transparent text-gray-600' : 'bg-white/5 text-gray-500'}`}>{l.badge}</span>
                          </div>
                          <span className="text-white font-black text-[11px] sm:text-xs leading-tight">{l.formattedStat}</span>
                       </div>
                     ))}
                   </div>
                </div>

                {/* LÍDERES CASA (HOME) */}
                <div className="flex flex-col gap-3">
                   <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-white/5 pb-2">
                     {homeTeam.abbr} Leaders
                   </span>
                   <div className="flex flex-col gap-2">
                     {homeLeaders.map((l: any, i: number) => (
                       <div key={i} className="flex flex-col bg-black/40 border border-white/5 rounded-lg p-2.5">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-gray-300 text-xs font-bold truncate pr-2">{l.name}</span>
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${l.badge === 'DEF' || l.badge === 'ST' ? 'bg-transparent text-gray-600' : 'bg-white/5 text-gray-500'}`}>{l.badge}</span>
                          </div>
                          <span className="text-white font-black text-[11px] sm:text-xs leading-tight">{l.formattedStat}</span>
                       </div>
                     ))}
                   </div>
                </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
}