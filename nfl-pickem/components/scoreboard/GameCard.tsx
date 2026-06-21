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
  };
  userTeamColor: string;
  homeTeam: { name: string; abbr: string; color: string; logo?: string; conference?: string | null };
  awayTeam: { name: string; abbr: string; color: string; logo?: string; conference?: string | null };
  existingPick?: { home_guess: number; away_guess: number } | null;
  onPickChange?: (gameId: string | number, home: string, away: string) => void;
  isUnsaved?: boolean;
}

export default function GameCard({ game, userTeamColor, homeTeam, awayTeam, existingPick, onPickChange, isUnsaved }: GameCardProps) {
  const [awayPredict, setAwayPredict] = useState(existingPick?.away_guess?.toString() || "");
  const [homePredict, setHomePredict] = useState(existingPick?.home_guess?.toString() || "");
  const [isTimeBlocked, setIsTimeBlocked] = useState(false);
  
  const gameDate = new Date(game.game_time);
  const isFinished = game.status === 'finished';

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

  // Lógica de Acertos e Pontos (CORRIGIDA: Usando fundo sólido escuro para bloquear o gradiente)
  let pointsEarned = 0;
  let resultColorClass = '';
  
  if (isFinished && existingPick && game.home_score !== undefined && game.away_score !== undefined) {
    const realDiff = game.home_score - game.away_score;
    const predDiff = existingPick.home_guess - existingPick.away_guess;
    const realWinner = realDiff > 0 ? 'home' : realDiff < 0 ? 'away' : 'tie';
    const predWinner = predDiff > 0 ? 'home' : predDiff < 0 ? 'away' : 'tie';

    if (game.home_score === existingPick.home_guess && game.away_score === existingPick.away_guess) {
      pointsEarned = 7;
      resultColorClass = 'border-green-500 bg-[#0A1A0F] shadow-[0_0_15px_rgba(34,197,94,0.15)]';
    } else if (realWinner === predWinner && realWinner !== 'tie') {
      if (realDiff === predDiff) {
        pointsEarned = 5;
        resultColorClass = 'border-blue-500 bg-[#0A1220] shadow-[0_0_15px_rgba(59,130,246,0.15)]';
      } else {
        pointsEarned = 3;
        resultColorClass = 'border-amber-500 bg-[#1A1205] shadow-[0_0_15px_rgba(245,158,11,0.15)]';
      }
    } else {
      pointsEarned = 0;
      resultColorClass = 'border-red-500 bg-[#1A0505] shadow-[0_0_15px_rgba(239,68,68,0.1)]';
    }
  }

  const formattedDate = gameDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const formattedTime = gameDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  
  // --- MÁQUINA DE TEMATIZAÇÃO (GRADIENTES) ---
  const isPlayoff = ['WC', 'DR', 'AFCC', 'NFCC', 'CC', 'SB'].includes(game.week);
  const conf = homeTeam?.conference || awayTeam?.conference;
  
  let wrapperClass = "transition-all duration-300 rounded-[14px] h-full ";
  let innerCardClass = "rounded-[12px] p-3 sm:p-4 flex flex-col gap-2 relative h-full ";
  let hasGradient = false;

  if (game.week === 'SB') {
    wrapperClass += "p-[2px] bg-gradient-to-br from-purple-600 via-pink-500 to-amber-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]";
    hasGradient = true;
  } else if (isPlayoff) {
    if (game.week === 'AFCC' || conf === 'AFC') {
      wrapperClass += "p-[1.5px] bg-gradient-to-br from-[#E31837] to-white shadow-[0_0_15px_rgba(227,24,55,0.15)]";
      hasGradient = true;
    } else if (game.week === 'NFCC' || conf === 'NFC') {
      wrapperClass += "p-[1.5px] bg-gradient-to-br from-[#013369] to-white shadow-[0_0_15px_rgba(1,51,105,0.15)]";
      hasGradient = true;
    }
  } else if (game.broadcast_tag) {
    hasGradient = true;
    switch(game.broadcast_tag) {
      case 'TNF': 
        wrapperClass += "p-[1.5px] bg-gradient-to-br from-[#00A8E1] to-white shadow-[0_0_15px_rgba(0,168,225,0.15)]";
        break;
      case 'SNF': 
        wrapperClass += "p-[1.5px] bg-gradient-to-br from-[#E2D82C] to-white shadow-[0_0_15px_rgba(226,216,44,0.15)]";
        break;
      case 'MNF': 
        wrapperClass += "p-[1.5px] bg-gradient-to-br from-[#CC0000] to-white shadow-[0_0_15px_rgba(204,0,0,0.15)]";
        break;
      case 'INT': 
        wrapperClass += "p-[1.5px] bg-gradient-to-br from-indigo-600 to-cyan-400 shadow-[0_0_15px_rgba(79,70,229,0.15)]";
        break;
      default:
        wrapperClass += "p-[1.5px] bg-gradient-to-br from-gray-500 to-white shadow-[0_0_15px_rgba(255,255,255,0.1)]";
    }
  } else {
    wrapperClass += "p-0";
  }

  if (hasGradient) {
    innerCardClass += isFinished && existingPick ? resultColorClass : "bg-neutral-950";
  } else {
    if (isFinished && existingPick) {
      innerCardClass += resultColorClass;
    } else if (isUnsaved) {
      innerCardClass += "bg-neutral-900 border-2";
    } else {
      innerCardClass += "bg-neutral-900 border border-white/5 hover:border-white/20";
    }
  }

  const cardOpacity = isTimeBlocked || isFinished ? "opacity-90" : "shadow-sm";
  innerCardClass += ` ${cardOpacity}`;

  const blockNegativeKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === ',' || e.key === '.') e.preventDefault();
  };

  return (
    <div className={wrapperClass}>
      <div 
        className={innerCardClass}
        style={isUnsaved && !hasGradient ? { borderColor: userTeamColor, boxShadow: `0 0 15px ${userTeamColor}30` } : {}}
      >
        <div className="flex justify-between items-center pb-2 border-b border-white/5 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[9px] text-gray-500 font-bold uppercase truncate leading-none">
              {formattedDate}
            </span>
            {game.broadcast_tag && (
              <div className="shrink-0 scale-[0.85] origin-left">
                <BroadcastBadge tag={game.broadcast_tag} />
              </div>
            )}
          </div>
          
          <div className="text-right shrink-0 ml-2">
            {isFinished ? (
              <span className="text-[8px] font-black uppercase tracking-widest text-green-500">Final</span>
            ) : isTimeBlocked ? (
              <span className="text-[8px] font-black uppercase tracking-widest text-red-500">Locked</span>
            ) : isUnsaved ? (
              <span className="text-[8px] font-black uppercase tracking-widest animate-pulse" style={{ color: hasGradient ? '#FFFFFF' : userTeamColor }}>Unsaved</span>
            ) : (
              <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500">{formattedTime}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-end">
            <div className="flex items-center gap-2">
              {isFinished && (
                <span className="w-6 text-center text-[7px] font-black uppercase tracking-widest text-gray-500">Real</span>
              )}
              <span className="w-9 text-center text-[7px] font-black uppercase tracking-widest text-gray-500">Pick</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {awayTeam?.logo && <img src={awayTeam.logo} className="w-5 h-5 object-contain shrink-0" alt="" />}
              <span className="font-black text-xs text-white uppercase truncate">{awayTeam?.abbr || 'AWAY'}</span>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {isFinished && (
                <span className={`font-black text-sm w-6 text-center ${game.away_score !== undefined && game.home_score !== undefined && game.away_score > game.home_score ? 'text-white' : 'text-gray-500'}`}>
                  {game.away_score}
                </span>
              )}
              <input
                type="number" min="0" onKeyDown={blockNegativeKeys} disabled={isTimeBlocked || isFinished} value={awayPredict} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || parseInt(val) >= 0) {
                    setAwayPredict(val);
                    if (onPickChange) onPickChange(game.id, homePredict, val);
                  }
                }} 
                placeholder="-"
                className={`w-9 h-8 border rounded text-center text-xs font-black text-white focus:outline-none transition p-0 disabled:opacity-60 disabled:cursor-not-allowed ${hasGradient ? 'bg-black/50 border-white/20 focus:border-white' : 'bg-black border-white/10 focus:border-white'}`}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {homeTeam?.logo && <img src={homeTeam.logo} className="w-5 h-5 object-contain shrink-0" alt="" />}
              <span className="font-black text-xs text-white uppercase truncate">{homeTeam?.abbr || 'HOME'}</span>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {isFinished && (
                <span className={`font-black text-sm w-6 text-center ${game.away_score !== undefined && game.home_score !== undefined && game.home_score > game.away_score ? 'text-white' : 'text-gray-500'}`}>
                  {game.home_score}
                </span>
              )}
              <input
                type="number" min="0" onKeyDown={blockNegativeKeys} disabled={isTimeBlocked || isFinished} value={homePredict} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || parseInt(val) >= 0) {
                    setHomePredict(val);
                    if (onPickChange) onPickChange(game.id, val, awayPredict);
                  }
                }} 
                placeholder="-"
                className={`w-9 h-8 border rounded text-center text-xs font-black text-white focus:outline-none transition p-0 disabled:opacity-60 disabled:cursor-not-allowed ${hasGradient ? 'bg-black/50 border-white/20 focus:border-white' : 'bg-black border-white/10 focus:border-white'}`}
              />
            </div>
          </div>
        </div>

        {isFinished && existingPick && (
          <div className="mt-1 pt-2 border-t border-white/5 flex justify-between items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Pick Result</span>
            <div className={`text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 ${pointsEarned > 0 ? 'bg-black/50' : 'bg-red-950/50'}`}>
              <span>{pointsEarned} PTS</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}