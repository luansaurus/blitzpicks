"use client";

import { useState, useEffect } from "react";
import BroadcastBadge from '../ui/BroadcastBadge';

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
    stadium?: { name: string; city: string };
  };
  userTeamColor: string;
  homeTeam: { name: string; abbr: string; color: string; logo?: string; conference?: string | null };
  awayTeam: { name: string; abbr: string; color: string; logo?: string; conference?: string | null };
  existingPick?: { home_guess: number; away_guess: number } | null;
  onPickChange?: (gameId: string | number, home: string, away: string) => void;
  isUnsaved?: boolean;
  isPlayoffLocked?: boolean;
  hidePicks?: boolean;
}

export default function GameCard({ game, userTeamColor, homeTeam, awayTeam, existingPick, onPickChange, isUnsaved, isPlayoffLocked = false, hidePicks = false }: GameCardProps) {
  
  // 🛡️ A TRAVA DE SEGURANÇA: Previne render fantasma do Next.js
  if (!game || !game.game_time) return null;

  const [awayPredict, setAwayPredict] = useState(existingPick?.away_guess?.toString() || "");
  const [homePredict, setHomePredict] = useState(existingPick?.home_guess?.toString() || "");
  const [isTimeBlocked, setIsTimeBlocked] = useState(false);
  
  const gameDate = new Date(game.game_time);
  const isFinished = game.status === 'finished';
  const isLive = game.status === 'in_progress';
  const hasGameStarted = isFinished || isLive;
  
  const isInputDisabled = isTimeBlocked || hasGameStarted || isPlayoffLocked;

  useEffect(() => {
    if (!isUnsaved) {
      setAwayPredict(existingPick?.away_guess?.toString() || "");
      setHomePredict(existingPick?.home_guess?.toString() || "");
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

  let pointsEarned = 0;
  let resultColorClass = '';
  
  if (hasGameStarted && existingPick && game.home_score !== undefined && game.away_score !== undefined && !hidePicks) {
    const realDiff = game.home_score - game.away_score;
    const predDiff = existingPick.home_guess - existingPick.away_guess;
    const realWinner = realDiff > 0 ? 'home' : realDiff < 0 ? 'away' : 'tie';
    const predWinner = predDiff > 0 ? 'home' : predDiff < 0 ? 'away' : 'tie';

    if (game.home_score === existingPick.home_guess && game.away_score === existingPick.away_guess) {
      pointsEarned = 7;
      resultColorClass = isLive ? 'border border-green-500/30 bg-[#0A1A0F]/80 shadow-[inset_0_0_15px_rgba(34,197,94,0.05)]' : 'border border-green-500/50 bg-[#0A1A0F] shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]';
    } else if (realWinner === predWinner && realWinner !== 'tie') {
      if (realDiff === predDiff) {
        pointsEarned = 5;
        resultColorClass = isLive ? 'border border-blue-500/30 bg-[#0A1220]/80 shadow-[inset_0_0_15px_rgba(59,130,246,0.05)]' : 'border border-blue-500/50 bg-[#0A1220] shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]';
      } else {
        pointsEarned = 3;
        resultColorClass = isLive ? 'border border-amber-500/30 bg-[#1A1205]/80 shadow-[inset_0_0_15px_rgba(245,158,11,0.05)]' : 'border border-amber-500/50 bg-[#1A1205] shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]';
      }
    } else {
      pointsEarned = 0;
      resultColorClass = isLive ? 'border border-red-500/20 bg-[#1A0505]/80 shadow-[inset_0_0_15px_rgba(239,68,68,0.05)]' : 'border border-red-500/50 bg-[#1A0505] shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]';
    }
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

  let wrapperClass = "transition-all duration-300 rounded-[14px] h-full relative mt-2 ";

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
      if (sortedTags.includes('TNF')) {
        wrapperClass += "bg-gradient-to-br from-[#00A8E1] to-white shadow-[0_0_15px_rgba(0,168,225,0.15)]";
      } else if (sortedTags.includes('SNF')) {
        wrapperClass += "bg-gradient-to-br from-[#E2D82C] to-white shadow-[0_0_15px_rgba(226,216,44,0.15)]";
      } else if (sortedTags.includes('MNF')) {
        wrapperClass += "bg-gradient-to-br from-[#CC0000] to-white shadow-[0_0_15px_rgba(204,0,0,0.15)]";
      } else if (sortedTags.includes('INT')) {
        wrapperClass += "bg-gradient-to-br from-indigo-600 to-cyan-400 shadow-[0_0_15px_rgba(79,70,229,0.15)]";
      } else {
        wrapperClass += "bg-gradient-to-br from-gray-500 to-white shadow-[0_0_15px_rgba(255,255,255,0.1)]";
      }
    } else {
      wrapperClass += "bg-gradient-to-br from-neutral-600 to-black hover:from-neutral-500 shadow-sm";
    }
  }

  let innerCardClass = "rounded-[12px] p-3 sm:p-4 flex flex-col gap-2 relative h-full ";
  if (hasGameStarted && existingPick && !hidePicks) {
    innerCardClass += ` ${resultColorClass}`;
  } else {
    innerCardClass += " bg-neutral-950";
  }
  innerCardClass += isInputDisabled && !isLive ? " opacity-90" : " shadow-sm";

  const blockNegativeKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === ',' || e.key === '.') e.preventDefault();
  };

  const awayWon = hasGameStarted && game.away_score !== undefined && game.home_score !== undefined && game.away_score > game.home_score;
  const homeWon = hasGameStarted && game.away_score !== undefined && game.home_score !== undefined && game.home_score > game.away_score;

  return (
    <div className={wrapperClass} style={isUnsaved ? { background: userTeamColor, boxShadow: `0 0 15px ${userTeamColor}60` } : {}}>
      
      {sortedTags.length > 0 && (
        <div className="absolute -top-[14px] right-3 z-20 flex items-center gap-1.5 scale-90 origin-bottom-right drop-shadow-lg">
          {sortedTags.map(tag => (
            <BroadcastBadge key={tag} tag={tag} />
          ))}
        </div>
      )}

      <div className={innerCardClass}>
        <div className="flex justify-between items-start pb-2 border-b border-white/5 mb-2 gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] text-gray-400 font-bold uppercase truncate leading-none">
              {formattedDate} <span className="mx-1">•</span> {formattedTime}
            </span>
            {game.stadium && (
              <span className="text-[9px] text-gray-500 font-semibold truncate leading-none mt-0.5" title={`${game.stadium.name}, ${game.stadium.city}`}>
                📍 {game.stadium.name}, {game.stadium.city}
              </span>
            )}
          </div>
          
          <div className="flex flex-col items-end shrink-0">
            <div className="text-right leading-none">
              {isFinished ? (
                <span className="text-[9px] font-black uppercase tracking-widest text-green-500">Final</span>
              ) : isLive ? (
                <span className="text-[9px] font-black uppercase tracking-widest text-red-500 animate-pulse">🔴 Live {game.clock ? `- ${game.clock}` : ''}</span>
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
        </div>

        <div className="flex flex-col gap-2">
          {!hidePicks && (
            <div className="flex justify-end">
              <div className="flex items-center gap-2">
                {hasGameStarted && (
                  <span className="w-6 text-center text-[7px] font-black uppercase tracking-widest text-gray-500">{isLive ? 'Live' : 'Real'}</span>
                )}
                <span className="w-12 text-center text-[7px] font-black uppercase tracking-widest text-gray-500">Pick</span>
              </div>
            </div>
          )}
          
          {/* AWAY TEAM */}
          <div className="flex items-center justify-between gap-2">
            <div className={`flex items-center gap-1.5 min-w-0 transition-opacity ${hidePicks && hasGameStarted && !awayWon ? 'opacity-40' : 'opacity-100'}`}>
              {awayTeam?.logo && <img src={awayTeam.logo} className="w-5 h-5 object-contain shrink-0" alt="" />}
              <span className="font-black text-xs text-white uppercase truncate">
                <span className="sm:hidden">{awayTeam?.abbr || 'AWAY'}</span>
                <span className="hidden sm:inline">{awayTeam?.name || awayTeam?.abbr || 'AWAY'}</span>
              </span>
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
                  <input
                    type="number" min="0" onKeyDown={blockNegativeKeys} disabled={isInputDisabled} value={awayPredict} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || parseInt(val) >= 0) {
                        setAwayPredict(val);
                        if (onPickChange) onPickChange(game.id, homePredict, val);
                      }
                    }} 
                    placeholder="-"
                    className="w-12 h-10 bg-black/50 border border-white/20 rounded text-center text-sm font-black text-white focus:outline-none focus:border-white transition p-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </>
              )}
            </div>
          </div>

          {/* HOME TEAM */}
          <div className="flex items-center justify-between gap-2">
            <div className={`flex items-center gap-1.5 min-w-0 transition-opacity ${hidePicks && hasGameStarted && !homeWon ? 'opacity-40' : 'opacity-100'}`}>
              {homeTeam?.logo && <img src={homeTeam.logo} className="w-5 h-5 object-contain shrink-0" alt="" />}
              <span className="font-black text-xs text-white uppercase truncate">
                <span className="sm:hidden">{homeTeam?.abbr || 'HOME'}</span>
                <span className="hidden sm:inline">{homeTeam?.name || homeTeam?.abbr || 'HOME'}</span>
              </span>
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
                  <input
                    type="number" min="0" onKeyDown={blockNegativeKeys} disabled={isInputDisabled} value={homePredict} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || parseInt(val) >= 0) {
                        setHomePredict(val);
                        if (onPickChange) onPickChange(game.id, val, awayPredict);
                      }
                    }} 
                    placeholder="-"
                    className="w-12 h-10 bg-black/50 border border-white/20 rounded text-center text-sm font-black text-white focus:outline-none focus:border-white transition p-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* CÁLCULO DE PONTOS - Só renderiza se hidePicks for false */}
        {!hidePicks && hasGameStarted && existingPick && (
          <div className="mt-1 pt-2 border-t border-white/5 flex justify-between items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Pick Result {isLive && <span className="text-red-400"> (Proj)</span>}</span>
            <div className={`text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 ${pointsEarned > 0 ? (isLive ? 'bg-black/50 border border-white/10' : 'bg-black/50') : 'bg-red-950/50'}`}>
              <span className={isLive && pointsEarned > 0 ? 'animate-pulse text-green-400' : ''}>{pointsEarned} PTS</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}