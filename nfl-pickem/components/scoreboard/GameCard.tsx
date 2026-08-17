"use client";

import { useState, useEffect, useRef } from "react";
import BroadcastBadge from '../ui/BroadcastBadge';
import { getPickResult } from '@/utils/scoring';
import { Circle, MapPin } from 'lucide-react';

interface GameCardProps {
  game: {
    id: string | number;
    home_team_id: number;
    away_team_id: number;
    game_time: string;
    week: string;
    broadcast_tag?: string;
    status?: string;
    home_score?: number;
    away_score?: number;
    clock?: string;
    meta_data?: any;
    stadium?: { name: string; city: string };
  };
  userTeamColor: string;
  homeTeam: { name: string; abbr: string; color: string; logo?: string; conference?: string | null; record?: string };
  awayTeam: { name: string; abbr: string; color: string; logo?: string; conference?: string | null; record?: string };
  existingPick?: { home_guess: number; away_guess: number } | null;
  onPickChange?: (gameId: string | number, home: string, away: string) => void;
  isUnsaved?: boolean;
  isPlayoffLocked?: boolean;
  hidePicks?: boolean;
  customRules?: { exact: number | null, diff: number | null, winner: number | null };
}

const formatRecord = (recordStr?: string) => {
  if (!recordStr) return "";
  const parts = recordStr.split('-');
  if (parts.length === 3 && parts[2] === '0') {
    return `${parts[0]}-${parts[1]}`;
  }
  return recordStr;
};

export default function GameCard({ game, userTeamColor, homeTeam, awayTeam, existingPick, onPickChange, isUnsaved, isPlayoffLocked = false, hidePicks = false, customRules }: GameCardProps) {
  if (!game || !game.game_time) return null;

  const [awayPredict, setAwayPredict] = useState(existingPick?.away_guess?.toString() || "");
  const [homePredict, setHomePredict] = useState(existingPick?.home_guess?.toString() || "");
  
  // REFS: Previnem o bug de apagar dois campos rápido e o estado antigo sobrescrever o novo
  const awayRef = useRef(existingPick?.away_guess?.toString() || "");
  const homeRef = useRef(existingPick?.home_guess?.toString() || "");

  const [scoreError, setScoreError] = useState(false);
  const [isTimeBlocked, setIsTimeBlocked] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const gameDate = new Date(game.game_time);
  const isFinished = game.status === 'finished';
  const isLive = game.status === 'in_progress';
  const hasGameStarted = isFinished || isLive;
  
  const isInputDisabled = isTimeBlocked || hasGameStarted || isPlayoffLocked;

  useEffect(() => {
    if (!isUnsaved) {
      const newAway = existingPick?.away_guess?.toString() || "";
      const newHome = existingPick?.home_guess?.toString() || "";
      setAwayPredict(newAway);
      setHomePredict(newHome);
      awayRef.current = newAway;
      homeRef.current = newHome;
    }
  }, [existingPick, isUnsaved]);

  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const diffMs = gameDate.getTime() - now.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins <= 15) setIsTimeBlocked(true);
    };
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, [gameDate]);

  // VALIDAÇÃO SCORIGAMI (Regra do 1 Ponto)
  const handleScoreBlur = () => {
    const h = parseInt(homeRef.current);
    const a = parseInt(awayRef.current);
    
    let isInvalid = false;
    let newHome = homeRef.current;
    let newAway = awayRef.current;

    if (!isNaN(h) && !isNaN(a)) {
      if (h === 1 && (a < 6 || a === 7)) { isInvalid = true; newHome = ""; }
      if (a === 1 && (h < 6 || h === 7)) { isInvalid = true; newAway = ""; }
    }

    if (isInvalid) {
      setScoreError(true);
      setHomePredict(newHome);
      setAwayPredict(newAway);
      homeRef.current = newHome;
      awayRef.current = newAway;
      
      if (onPickChange) onPickChange(game.id, newHome, newAway);
      
      // Remove o aviso da tela após 3 segundos
      setTimeout(() => setScoreError(false), 3000);
    }
  };

  let pointsEarned = 0;
  let resultColorClass = '';
  
  if (hasGameStarted && existingPick && game.home_score !== undefined && game.away_score !== undefined && !hidePicks) {
    const resultData = getPickResult(game, existingPick, customRules);
    pointsEarned = resultData.points;
    resultColorClass = resultData.colorClass;
  }

  const formattedDate = gameDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const formattedTime = gameDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  
  const isPlayoff = ['WC', 'DR', 'AFCC', 'NFCC', 'CC', 'SB'].includes(game.week);
  const conf = homeTeam?.conference || awayTeam?.conference;
  
  const rawTags = game.broadcast_tag ? game.broadcast_tag.split(',').map(t => t.trim()) : [];
  const sortedTags = [...rawTags].sort((a, b) => {
    if (a === 'INT') return -1;
    if (b === 'INT') return 1;
    return 0;
  });

  let wrapperClass = "transition-all duration-300 rounded-[14px] h-full relative mt-2 flex flex-col ";

  if (hasGameStarted && existingPick && !hidePicks) {
    wrapperClass += "p-0";
  } else {
    wrapperClass += "p-[2px] hover:-translate-y-[1px] ";
    if (isLive) {
      wrapperClass += "bg-gradient-to-br from-red-600 to-black shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse";
    } else if (game.week === 'SB') {
      wrapperClass += "bg-gradient-to-br from-purple-600 via-pink-500 to-amber-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]";
    } else if (isPlayoff) {
      if (game.week === 'AFCC' || conf === 'AFC') {
        wrapperClass += "bg-gradient-to-br from-[#E31837] to-white shadow-[0_0_15px_rgba(227,24,55,0.15)]";
      } else if (game.week === 'NFCC' || conf === 'NFC') {
        wrapperClass += "bg-gradient-to-br from-[#013369] to-white shadow-[0_0_15px_rgba(1,51,105,0.15)]";
      } else {
        wrapperClass += "bg-gradient-to-br from-neutral-600 to-black shadow-sm";
      }
    } else if (sortedTags.length > 0) {
      if (sortedTags.includes('TNF')) wrapperClass += "bg-gradient-to-br from-[#00A8E1] to-white shadow-[0_0_15px_rgba(0,168,225,0.15)]";
      else if (sortedTags.includes('SNF')) wrapperClass += "bg-gradient-to-br from-[#E2D82C] to-white shadow-[0_0_15px_rgba(226,216,44,0.15)]";
      else if (sortedTags.includes('MNF')) wrapperClass += "bg-gradient-to-br from-[#CC0000] to-white shadow-[0_0_15px_rgba(204,0,0,0.15)]";
      else if (sortedTags.includes('INT')) wrapperClass += "bg-gradient-to-br from-indigo-600 to-cyan-400 shadow-[0_0_15px_rgba(79,70,229,0.15)]";
      else wrapperClass += "bg-gradient-to-br from-gray-500 to-white shadow-[0_0_15px_rgba(255,255,255,0.1)]";
    } else {
      wrapperClass += "bg-gradient-to-br from-neutral-600 to-black hover:from-neutral-500 shadow-sm";
    }
  }

  let innerCardClass = "rounded-[12px] p-3 sm:p-4 flex flex-col gap-2 relative grow ";
  if (hasGameStarted && existingPick && !hidePicks) innerCardClass += ` ${resultColorClass}`;
  else innerCardClass += " bg-neutral-950";
  innerCardClass += isInputDisabled && !isLive ? " opacity-90" : " shadow-sm";

  const blockNegativeKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === ',' || e.key === '.') e.preventDefault();
  };

  const awayWon = hasGameStarted && game.away_score !== undefined && game.home_score !== undefined && game.away_score > game.home_score;
  const homeWon = hasGameStarted && game.away_score !== undefined && game.home_score !== undefined && game.home_score > game.away_score;
  const hasMetaData = game.meta_data && hasGameStarted;

  return (
    <div className={wrapperClass} style={isUnsaved ? { background: userTeamColor, boxShadow: `0 0 15px ${userTeamColor}60` } : {}}>
      
      {sortedTags.length > 0 && (
        <div className="absolute -top-[12px] right-3 z-20 flex items-center gap-1 scale-[0.85] origin-bottom-right drop-shadow-md">
          {sortedTags.map(tag => (
            <BroadcastBadge key={tag} tag={tag} />
          ))}
        </div>
      )}

      <div className={innerCardClass}>
        
        <div className="flex flex-col gap-1.5 pb-2 border-b border-white/5 mb-1 w-full">
          <div className="flex justify-between items-start gap-2">
            <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase truncate leading-none">
              {formattedDate} <span className="mx-1">•</span> {formattedTime}
            </span>
            <div className="text-right leading-none shrink-0">
              {isFinished ? (
                <span className="text-[9px] font-black uppercase tracking-widest text-green-500">Final</span>
              ) : isLive ? (
                <span className="text-[9px] font-black uppercase tracking-widest text-red-500 animate-pulse flex items-center gap-1"><Circle size={7} fill="currentColor" /> Live {game.clock ? `- ${game.clock}` : ''}</span>
              ) : isPlayoffLocked && !hidePicks ? (
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">Locked</span>
              ) : isTimeBlocked && !hidePicks ? (
                <span className="text-[9px] font-black uppercase tracking-widest text-red-500">Locked</span>
              ) : isUnsaved ? (
                <span className="text-[9px] font-black uppercase tracking-widest animate-pulse" style={{ color: '#FFFFFF' }}>Unsaved</span>
              ) : (
                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Pending</span>
              )}
            </div>
          </div>
          
          {game.stadium && (
            <span className="text-[8px] sm:text-[9px] text-gray-500 font-semibold uppercase tracking-widest truncate leading-none w-full flex items-center gap-1" title={`${game.stadium.name}, ${game.stadium.city}`}>
              <MapPin size={10} /> {game.stadium.name}, {game.stadium.city}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3 w-full relative">
          {!hidePicks && (
            <div className="flex justify-end mb-[-4px]">
              <div className="flex items-center gap-2">
                {hasGameStarted && (
                  <span className="w-6 text-center text-[7px] font-black uppercase tracking-widest text-gray-500">{isLive ? 'Live' : 'Real'}</span>
                )}
                <span className="w-12 text-center text-[7px] font-black uppercase tracking-widest text-gray-500">Pick</span>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between gap-3 w-full">
            <div className={`flex items-center gap-2 sm:gap-3 flex-1 min-w-0 transition-opacity ${hidePicks && hasGameStarted && !awayWon ? 'opacity-40' : 'opacity-100'}`}>
              {awayTeam?.logo ? (
                <img src={awayTeam.logo} className="w-6 h-6 sm:w-7 sm:h-7 object-contain shrink-0" alt={awayTeam?.abbr} />
              ) : (
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white/5 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-black">{awayTeam?.abbr?.[0]}</span>
                </div>
              )}
              
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <span className="font-black text-xs sm:text-sm text-white uppercase truncate leading-none" style={{ fontSize: (awayTeam?.name?.length || 0) > 10 ? '0.75rem' : '' }}>
                  {awayTeam?.name?.split(' ').pop() || awayTeam?.abbr || 'AWAY'}
                </span>
                {awayTeam?.record && (
                  <span className="text-[9px] text-gray-500 font-bold tracking-widest leading-none shrink-0 whitespace-nowrap mt-0.5">
                    {formatRecord(awayTeam.record)}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {hidePicks ? (
                <span className={`font-black text-lg ${hasGameStarted ? (awayWon ? 'text-white' : 'text-gray-400') : 'text-neutral-700'}`}>
                  {hasGameStarted ? game.away_score : '-'}
                </span>
              ) : (
                <>
                  {hasGameStarted && (
                    <span className={`font-black text-sm w-6 text-center ${awayWon ? 'text-white' : 'text-gray-500'}`}>
                      {game.away_score}
                    </span>
                  )}
                  {/* O CSS abaixo [appearance:textfield]... garante que as setinhas desapareçam no PC */}
                  <input
                    type="number" min="0" onKeyDown={blockNegativeKeys} onBlur={handleScoreBlur} disabled={isInputDisabled} value={awayPredict} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || parseInt(val) >= 0) { 
                        setAwayPredict(val); 
                        awayRef.current = val;
                        if (onPickChange) onPickChange(game.id, homeRef.current, val); 
                      }
                    }} 
                    placeholder="-"
                    className="w-12 h-9 sm:h-10 bg-black/50 border border-white/20 rounded-md text-center text-sm sm:text-base font-black text-white focus:outline-none focus:border-white transition p-0 disabled:opacity-60 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 w-full">
            <div className={`flex items-center gap-2 sm:gap-3 flex-1 min-w-0 transition-opacity ${hidePicks && hasGameStarted && !homeWon ? 'opacity-40' : 'opacity-100'}`}>
              {homeTeam?.logo ? (
                <img src={homeTeam.logo} className="w-6 h-6 sm:w-7 sm:h-7 object-contain shrink-0" alt={homeTeam?.abbr} />
              ) : (
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white/5 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-black">{homeTeam?.abbr?.[0]}</span>
                </div>
              )}
              
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <span className="font-black text-xs sm:text-sm text-white uppercase truncate leading-none" style={{ fontSize: (homeTeam?.name?.length || 0) > 10 ? '0.75rem' : '' }}>
                  {homeTeam?.name?.split(' ').pop() || homeTeam?.abbr || 'HOME'}
                </span>
                {homeTeam?.record && (
                  <span className="text-[9px] text-gray-500 font-bold tracking-widest leading-none shrink-0 whitespace-nowrap mt-0.5">
                    {formatRecord(homeTeam.record)}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {hidePicks ? (
                <span className={`font-black text-lg ${hasGameStarted ? (homeWon ? 'text-white' : 'text-gray-400') : 'text-neutral-700'}`}>
                  {hasGameStarted ? game.home_score : '-'}
                </span>
              ) : (
                <>
                  {hasGameStarted && (
                    <span className={`font-black text-sm w-6 text-center ${homeWon ? 'text-white' : 'text-gray-500'}`}>
                      {game.home_score}
                    </span>
                  )}
                  {/* O CSS abaixo [appearance:textfield]... garante que as setinhas desapareçam no PC */}
                  <input
                    type="number" min="0" onKeyDown={blockNegativeKeys} onBlur={handleScoreBlur} disabled={isInputDisabled} value={homePredict} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || parseInt(val) >= 0) { 
                        setHomePredict(val); 
                        homeRef.current = val;
                        if (onPickChange) onPickChange(game.id, val, awayRef.current); 
                      }
                    }} 
                    placeholder="-"
                    className="w-12 h-9 sm:h-10 bg-black/50 border border-white/20 rounded-md text-center text-sm sm:text-base font-black text-white focus:outline-none focus:border-white transition p-0 disabled:opacity-60 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </>
              )}
            </div>
          </div>
          
          {/* MENSAGEM DE ERRO (SCORIGAMI) */}
          {scoreError && (
            <div className="mt-1 w-full flex justify-center animate-fadeIn absolute -bottom-5">
              <span className="text-[8px] font-black uppercase tracking-widest text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-500/30">
                Invalid NFL Score (1-Pt Rule)
              </span>
            </div>
          )}
        </div>

        {!hidePicks && hasGameStarted && existingPick && (
          <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Pick Result {isLive && <span className="text-red-400"> (Proj)</span>}</span>
            <div className={`text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 ${pointsEarned > 0 ? (isLive ? 'bg-black/50 border border-white/10' : 'bg-black/50') : 'bg-red-950/50'}`}>
              <span className={isLive && pointsEarned > 0 ? 'animate-pulse text-green-400' : ''}>{pointsEarned} PTS</span>
            </div>
          </div>
        )}

        {hasMetaData && (
          <div className="mt-3">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full pt-2 pb-1 border-t border-white/5 text-[9px] font-bold text-gray-500 uppercase tracking-widest hover:text-white transition flex justify-center items-center gap-1"
            >
              {isExpanded ? 'Hide Game Stats ▲' : 'View Game Stats ▼'}
            </button>

            {isExpanded && (
              <div className="pt-2 flex flex-col gap-3 animate-fadeIn">
                <div className="bg-black/40 rounded-lg p-2 border border-white/5">
                  <table className="w-full text-[9px] font-bold text-center">
                    <thead>
                      <tr className="text-gray-500 border-b border-white/5">
                        <th className="text-left pb-1 pl-1">Team</th>
                        <th className="pb-1 w-6">1</th><th className="pb-1 w-6">2</th>
                        <th className="pb-1 w-6">3</th><th className="pb-1 w-6">4</th>
                        <th className="pb-1 w-8 text-white">T</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <tr>
                        <td className="text-left pt-1 pl-1 text-white">{awayTeam?.abbr}</td>
                        <td className="pt-1 text-gray-400">{game.meta_data.linescores?.away?.[0] ?? '-'}</td>
                        <td className="pt-1 text-gray-400">{game.meta_data.linescores?.away?.[1] ?? '-'}</td>
                        <td className="pt-1 text-gray-400">{game.meta_data.linescores?.away?.[2] ?? '-'}</td>
                        <td className="pt-1 text-gray-400">{game.meta_data.linescores?.away?.[3] ?? '-'}</td>
                        <td className="pt-1 text-white">{game.away_score}</td>
                      </tr>
                      <tr>
                        <td className="text-left pt-1 pl-1 text-white">{homeTeam?.abbr}</td>
                        <td className="pt-1 text-gray-400">{game.meta_data.linescores?.home?.[0] ?? '-'}</td>
                        <td className="pt-1 text-gray-400">{game.meta_data.linescores?.home?.[1] ?? '-'}</td>
                        <td className="pt-1 text-gray-400">{game.meta_data.linescores?.home?.[2] ?? '-'}</td>
                        <td className="pt-1 text-gray-400">{game.meta_data.linescores?.home?.[3] ?? '-'}</td>
                        <td className="pt-1 text-white">{game.home_score}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2 text-[9px]">
                  <div className="flex-1 bg-black/40 rounded-lg p-2 border border-white/5">
                    <span className="font-black text-gray-500 uppercase tracking-widest block mb-2">{awayTeam?.abbr} Leaders</span>
                    <div className="flex flex-col gap-1.5">
                      {game.meta_data.leaders?.away?.map((l: any, i: number) => {
                        const formattedStat = l.stat ? l.stat.replace('YDS', `${l.category.toUpperCase()} YDS`) : '-';
                        return (
                          <div key={i} className="flex flex-col bg-white/5 rounded p-1.5">
                            <span className="text-gray-300 font-bold truncate leading-tight mb-0.5">{l.name}</span>
                            <span className="text-white font-black text-[8px] leading-tight">{formattedStat}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="flex-1 bg-black/40 rounded-lg p-2 border border-white/5">
                    <span className="font-black text-gray-500 uppercase tracking-widest block mb-2">{homeTeam?.abbr} Leaders</span>
                    <div className="flex flex-col gap-1.5">
                      {game.meta_data.leaders?.home?.map((l: any, i: number) => {
                        const formattedStat = l.stat ? l.stat.replace('YDS', `${l.category.toUpperCase()} YDS`) : '-';
                        return (
                          <div key={i} className="flex flex-col bg-white/5 rounded p-1.5">
                            <span className="text-gray-300 font-bold truncate leading-tight mb-0.5">{l.name}</span>
                            <span className="text-white font-black text-[8px] leading-tight">{formattedStat}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}