"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";

interface UserTeamHeroProps {
  teamId: string | number | null;
  score: number;
  lastGame?: any;
  nextGame?: any;
  teamsDataMap?: Record<string, any>;
}

export default function UserTeamHero({ teamId, score, lastGame, nextGame, teamsDataMap }: UserTeamHeroProps) {
  const [teamInfo, setTeamInfo] = useState<any>(null);
  const [teamRecord, setTeamRecord] = useState<string>("0-0-0");

  useEffect(() => {
    async function fetchTeamAndStandings() {
      if (!teamId) return;
      const supabase = createClient();
      
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();
        
      if (teamData) setTeamInfo(teamData);

      const { data: stdData } = await supabase
        .from('standings')
        .select('wins, losses, ties')
        .eq('team_id', teamId)
        .single();
        
      if (stdData) {
        setTeamRecord(`${stdData.wins}-${stdData.losses}-${stdData.ties}`);
      }
    }
    
    fetchTeamAndStandings();
  }, [teamId]);

  if (!teamInfo) {
    return (
      <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6 sm:p-10 text-center animate-pulse">
        <div className="w-16 h-16 bg-neutral-800 rounded-full mx-auto mb-4"></div>
        <div className="h-4 bg-neutral-800 w-32 mx-auto rounded"></div>
      </div>
    );
  }

  const isGenericNFL = teamInfo.abbreviation === 'NFL';

  let wonLast = false;
  let lastOppAbbr = "OPP";
  let lastScoreDisplay = "";
  if (lastGame && teamsDataMap) {
    const isHome = lastGame.home_team_id?.toString() === teamId?.toString();
    const oppId = isHome ? lastGame.away_team_id : lastGame.home_team_id;
    lastOppAbbr = teamsDataMap[oppId?.toString()]?.abbr || "OPP";
    const myScore = isHome ? lastGame.home_score : lastGame.away_score;
    const oppScore = isHome ? lastGame.away_score : lastGame.home_score;
    wonLast = myScore > oppScore;
    lastScoreDisplay = `${myScore} - ${oppScore}`;
  }

  let nextOppAbbr = "OPP";
  let nextDateStr = "";
  let isNextHome = false;
  if (nextGame && teamsDataMap) {
    isNextHome = nextGame.home_team_id?.toString() === teamId?.toString();
    const oppId = isNextHome ? nextGame.away_team_id : nextGame.home_team_id;
    nextOppAbbr = teamsDataMap[oppId?.toString()]?.abbr || "OPP";
    nextDateStr = new Date(nextGame.game_time).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl group flex flex-col bg-neutral-950">
      
      {/* 1. Background dinâmico em Gradiente */}
      <div 
        className="absolute inset-0 opacity-20 transition-all duration-700 group-hover:opacity-30 group-hover:scale-105 z-0"
        style={{ 
          background: `linear-gradient(135deg, ${teamInfo.primary_color} 0%, transparent 100%)`,
        }}
      />

      {/* 2. Escudo Gigante Opaco no Fundo (Canto Superior Direito) */}
      {teamInfo.logo_url && (
        <img 
          src={teamInfo.logo_url} 
          alt="" 
          className="absolute -top-10 -right-6 w-48 h-48 sm:w-64 sm:h-64 object-contain opacity-[0.06] sm:opacity-[0.08] rotate-12 pointer-events-none z-0 mix-blend-screen" 
        />
      )}
      
      {/* Conteúdo Principal do Hero */}
      <div className="relative z-10 flex items-center justify-between p-6 sm:p-10">
        <div className="flex items-center gap-4 sm:gap-6">
          {teamInfo.logo_url ? (
            <div className="w-20 h-20 sm:w-28 sm:h-28 bg-black/40 p-3 sm:p-4 rounded-full border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
              <img src={teamInfo.logo_url} alt={teamInfo.name} className="w-full h-full object-contain drop-shadow-xl" />
            </div>
          ) : (
            <div className="w-20 h-20 sm:w-28 sm:h-28 bg-black/30 rounded-full border border-white/10" />
          )}
          
          <div>
            <h1 className="text-2xl sm:text-4xl font-black italic uppercase tracking-widest text-white drop-shadow-md">
              {teamInfo.name}
            </h1>
            
            {!isGenericNFL ? (
              <p className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">
                {teamRecord} • Locker Room
              </p>
            ) : (
              <p className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">
                Global Locker Room
              </p>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="flex flex-col items-end">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-500">Total Points</span>
            {/* CORREÇÃO AQUI: Texto sempre branco, brilho da cor do time */}
            <span 
              className="text-4xl sm:text-6xl font-black italic tracking-tighter text-white" 
              style={{ textShadow: `0 0 25px ${teamInfo.primary_color}` }}
            >
              {score}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-painel com Último e Próximo Jogo */}
      {(!isGenericNFL && (lastGame || nextGame)) && (
        <div className="relative z-10 bg-black/50 border-t border-white/10 backdrop-blur-xl grid grid-cols-2 divide-x divide-white/10">
          
          {/* Last Match */}
          <div className="p-3 sm:p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Last Match</span>
            {lastGame ? (
              <div className="flex items-center gap-2 font-black text-sm sm:text-base">
                <span className={wonLast ? "text-green-500" : "text-gray-400"}>{lastScoreDisplay.split(' - ')[0]}</span>
                <span className="text-gray-500 text-xs font-bold px-1">{lastGame.home_team_id?.toString() === teamId?.toString() ? "vs" : "@"} {lastOppAbbr}</span>
                <span className={!wonLast && parseInt(lastScoreDisplay.split(' - ')[0]) < parseInt(lastScoreDisplay.split(' - ')[1]) ? "text-red-500" : "text-gray-400"}>{lastScoreDisplay.split(' - ')[1]}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-600 font-bold italic">-</span>
            )}
          </div>

          {/* Next Kickoff */}
          <div className="p-3 sm:p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Next Kickoff</span>
            {nextGame ? (
              <div className="font-black text-sm sm:text-base text-white">
                {isNextHome ? "vs" : "@"} {nextOppAbbr}
                <span className="block text-[9px] sm:text-[10px] text-gray-400 font-bold mt-0.5">
                  {nextDateStr}
                </span>
              </div>
            ) : (
              <span className="text-xs text-gray-600 font-bold italic">-</span>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}